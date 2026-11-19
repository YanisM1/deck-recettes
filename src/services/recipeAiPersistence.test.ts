import { expect, it, vi } from "vitest";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { recipeFingerprint, type CaloriesInfo } from "./calorieAnalysis";
import { createLocalRecipeAi } from "./recipeAiFallback";
import { fromRecipeRow, readCompatible, saveCompatible, toRecipeRow } from "./recipeFields";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";

const key = "a".repeat(64);
const base: Recipe = { ...starterRecipes[0], servings: 4 };
const info: CaloriesInfo = { type: "plat_sale", basis: "100g", totalKcal: 1600, cookedWeightGrams: 1000, kcal: 160,
  estimated: true, assumptions: ["Poids cuit estimé"], model: "gemini-3.5-flash-lite", analyzedAt: "2026-11-19T10:00:00Z", fingerprint: recipeFingerprint(base) };
const metadata = createLocalRecipeAi({ ...base, caloriesInfo: info });
const memory = () => {
  const values = new Map<string, string>();
  return { getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => { values.set(name, value); } };
};

it("conserve les variantes et projections caloriques dans le cache et le mapping SQL", () => {
  const cache = memory(), store = new RecipeStore(cache, null);
  const saved = store.save({ ...base, aiScalingData: metadata });
  const reloaded = new RecipeStore(cache, null).getSnapshot().recipes.find(recipe => recipe.id === saved.id)!;
  expect(reloaded).toMatchObject({ aiScalingData: metadata, caloriesInfo: info, caloriesValue: 160, caloriesUnit: "kcal / 100g" });
  const row = toRecipeRow(saved, key);
  expect(row.ai_scaling_data).toEqual(metadata);
  expect(row.calories_value).toBe(160);
  for (const name of ["aiScalingData", "caloriesValue", "caloriesUnit", "caloriesNote", "caloriesInfo", "linkedRecipeIds"]) expect(row).not.toHaveProperty(name);
  expect(fromRecipeRow(row)).toMatchObject({ aiScalingData: metadata, caloriesInfo: info, caloriesValue: 160 });
});

it("invalide ensemble les variantes et les valeurs dérivées après modification", () => {
  const store = new RecipeStore(memory(), null);
  const saved = store.save({ ...base, aiScalingData: metadata });
  const edited = store.save({ ...saved, steps: ["Faire frire 20 minutes dans l’huile."] }, saved.id);
  expect(edited.aiScalingData).toBeUndefined();
  expect(edited.caloriesInfo).toBeUndefined();
  expect(edited.caloriesValue).toBeUndefined();
  expect(edited.caloriesUnit).toBeUndefined();
  const row = toRecipeRow({ ...saved, steps: edited.steps }, key);
  expect(row.ai_scaling_data).toBeNull();
  expect(row.calories_value).toBeNull();
});

it("ignore les colonnes scalaires isolées et les caches JSON périmés à la lecture", () => {
  const row = { ...toRecipeRow(base, key), calories_value: 999, calories_unit: "kcal / 100g", calories_note: "Ancienne analyse",
    ai_scaling_data: metadata, steps: ["Une cuisson différente"] };
  expect(fromRecipeRow(row)).toMatchObject({ aiScalingData: undefined, caloriesInfo: undefined, caloriesValue: undefined, caloriesUnit: undefined });
  const cache = memory();
  cache.setItem("deckchef.recipes.v1.local", JSON.stringify({ recipes: [{ ...base, steps: row.steps, aiScalingData: metadata, caloriesValue: 999 }], queue: [] }));
  expect(new RecipeStore(cache, null).getSnapshot().recipes[0].caloriesValue).toBeUndefined();
});

it("retombe seulement sur le précédent schéma quand les colonnes IA manquent", async () => {
  const child = starterRecipes[1];
  const row = toRecipeRow({ ...base, caloriesInfo: info, linkedRecipeIds: [child.id] }, key, true, true, true, false);
  const read = vi.fn().mockResolvedValueOnce({ error: { code: "42703", message: "column ai_scaling_data missing" }, data: null })
    .mockResolvedValueOnce({ error: null, data: [row] });
  const recipes = await readCompatible(read);
  expect(read).toHaveBeenCalledTimes(2);
  expect(read.mock.calls[1][0]).toContain("linked_recipe_ids");
  expect(read.mock.calls[1][0]).not.toContain("ai_scaling_data");
  expect(recipes[0]).toMatchObject({ servings: 4, caloriesValue: 160, linkedRecipeIds: [child.id] });
});

it("garde les variantes en attente sur un ancien serveur puis les envoie après migration", async () => {
  const cache = memory(); let migrated = false, row = toRecipeRow(base, key);
  const remote: RemoteRecipes = {
    initialize: async () => {}, fetch: async () => [fromRecipeRow(row)], remove: async () => {}, reset: async () => {},
    save: recipe => saveCompatible(recipe, key, async value => {
      if (!migrated && "ai_scaling_data" in value) return { error: { code: "PGRST204", message: "ai_scaling_data missing" } };
      row = value; return { error: null };
    }),
  };
  const store = new RecipeStore(cache, remote), saved = store.save({ ...base, aiScalingData: metadata });
  await store.sync();
  expect(store.getSnapshot().pending).toBe(1);
  const reloaded = new RecipeStore(cache, remote);
  expect(reloaded.getSnapshot().recipes.find(recipe => recipe.id === saved.id)?.aiScalingData).toEqual(metadata);
  migrated = true; await reloaded.sync();
  expect(reloaded.getSnapshot().pending).toBe(0);
  expect(row.ai_scaling_data).toEqual(metadata);
  expect(row.calories_value).toBe(160);
});

it("enrichit la dernière version sans écraser une photo ou une liaison modifiée pendant l’analyse", () => {
  const store = new RecipeStore(memory(), null), saved = store.save(base);
  const fingerprint = recipeFingerprint(saved);
  store.save({ ...saved, image_url: "https://example.com/new.jpg", linkedRecipeIds: [starterRecipes[1].id] }, saved.id);
  expect(store.enrichAi(saved.id, fingerprint, metadata)).toBe(true);
  expect(store.getSnapshot().recipes.find(recipe => recipe.id === saved.id)).toMatchObject({ image_url: "https://example.com/new.jpg", linkedRecipeIds: [starterRecipes[1].id], aiScalingData: metadata });
});

it("refuse l’enrichissement périmé ou la résurrection d’une recette supprimée", () => {
  const store = new RecipeStore(memory(), null), saved = store.save(base), fingerprint = recipeFingerprint(saved);
  store.save({ ...saved, ingredients: ["500 g de beurre"] }, saved.id);
  expect(store.enrichAi(saved.id, fingerprint, metadata)).toBe(false);
  store.remove(saved.id);
  expect(store.enrichAi(saved.id, fingerprint, metadata)).toBe(false);
  expect(store.getSnapshot().recipes.some(recipe => recipe.id === saved.id)).toBe(false);
});

it("enrichit aussi une recette dont un lien a disparu sans modifier son contenu", () => {
  const store = new RecipeStore(memory(), null), child = starterRecipes[1];
  const saved = store.save({ ...base, linkedRecipeIds: [child.id] });
  store.remove(child.id);
  expect(store.enrichAi(saved.id, recipeFingerprint(saved), metadata)).toBe(true);
  expect(store.getSnapshot().recipes.find(recipe => recipe.id === saved.id)?.linkedRecipeIds).toEqual([child.id]);
});

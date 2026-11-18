import { expect, it, vi } from "vitest";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { recipeFingerprint, type CaloriesInfo } from "./calorieAnalysis";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";
import { fromRecipeRow, readCompatible, saveCompatible, toRecipeRow } from "./recipeFields";
const key = "a".repeat(64);
const base: Recipe = { ...starterRecipes[0], servings: 4 };
const info: CaloriesInfo = { type: "plat_sale", totalKcal: 1600, cookedWeightGrams: 1000, kcal: 160, basis: "100g", estimated: true, assumptions: ["Poids cuit estimé"], model: "gemini-3.8-flash", analyzedAt: "2026-11-18T10:00:00Z", fingerprint: recipeFingerprint(base) };
const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
it("conserve les portions et calories dans le cache et la traduction SQL", () => {
  const memory = storage(), store = new RecipeStore(memory, null);
  const saved = store.save({ ...base, caloriesInfo: info });
  expect(new RecipeStore(memory, null).getSnapshot().recipes.find(r => r.id === saved.id)?.caloriesInfo).toEqual(info);
  const row = toRecipeRow(saved, key);
  expect(row).not.toHaveProperty("caloriesInfo");
  expect(row.calories_info).toEqual(info);
  expect(fromRecipeRow(row)).toMatchObject({ servings: 4, caloriesInfo: info });
});
it("retire une estimation périmée après changement de cuisson et refuse les portions invalides", () => {
  const store = new RecipeStore(storage(), null);
  const saved = store.save({ ...base, caloriesInfo: info });
  expect(store.save({ ...saved, steps: ["Frire dans beaucoup d’huile"] }, saved.id).caloriesInfo).toBeUndefined();
  expect(() => store.save({ ...base, servings: 0 })).toThrow("portions");
  expect(toRecipeRow({ ...base, ingredients: ["500 g de beurre"], caloriesInfo: info }, key).calories_info).toBeNull();
});
it("relit un ancien schéma sans calories en conservant les champs moule", async () => {
  const read = vi.fn().mockResolvedValueOnce({ error: { code: "42703", message: "column calories_info missing" }, data: null }).mockResolvedValueOnce({ error: null, data: [{ ...base, is_cake: true, pan_size: 26 }] });
  const result = await readCompatible(read);
  expect(result[0]).toMatchObject({ panSize: 26, isCake: true });
  expect(read.mock.calls[1][0]).toContain("pan_size");
});
it("garde les nouvelles informations en attente sur un ancien serveur, puis les synchronise", async () => {
  const memory = storage(); let upgraded = false, row = toRecipeRow(base, key);
  const remote: RemoteRecipes = {
    initialize: async () => {}, fetch: async () => [fromRecipeRow(row)], remove: async () => {}, reset: async () => {},
    save: recipe => saveCompatible(recipe, key, async value => {
      if (!upgraded && "calories_info" in value) return { error: { code: "PGRST204", message: "calories_info missing" } };
      row = value; return { error: null };
    }),
  };
  const store = new RecipeStore(memory, remote), saved = store.save({ ...base, caloriesInfo: info });
  await store.sync();
  expect(store.getSnapshot().pending).toBe(1);
  const reloaded = new RecipeStore(memory, remote);
  expect(reloaded.getSnapshot().recipes.find(r => r.id === saved.id)?.caloriesInfo).toEqual(info);
  upgraded = true;
  await reloaded.sync();
  expect(reloaded.getSnapshot().pending).toBe(0);
  expect(row.calories_info).toEqual(info);
});

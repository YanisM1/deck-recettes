import { expect, it, vi } from "vitest";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { MANUAL_CALORIES_UNITS } from "./manualCalories";
import { readRecipeAdaptations, recipeFingerprint, SERVING_TARGETS } from "./recipeAiTypes";
import { fromRecipeRow, readCompatible, saveCompatible, toRecipeRow } from "./recipeFields";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";

const key = "a".repeat(64);
const base: Recipe = { ...starterRecipes[0], servings: 4 };
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => { values.set(name, value); },
  };
}
const historicalCalories = { kcal: 160, model: "gemini-3.5-flash-lite" };
const historicalAdaptations = {
  version: 1,
  fingerprint: recipeFingerprint(base),
  source: "gemini",
  model: "gemini-3.5-flash-lite",
  generatedAt: "2026-11-19T10:00:00.000Z",
  kind: "sale",
  caloriesInfo: historicalCalories,
  note: "Ancienne analyse",
  servingsMap: Object.fromEntries(SERVING_TARGETS.map(target => [String(target), {
    ingredients: base.ingredients,
    cookingNote: "Ajuster la cuisson.",
    caloriesInfo: historicalCalories,
  }])),
};

it.each(MANUAL_CALORIES_UNITS)("conserve %s dans localStorage et dans les colonnes SQL", caloriesUnit => {
  const cache = memory(), store = new RecipeStore(cache, null);
  const saved = store.save({ ...base, caloriesValue: 320, caloriesUnit });
  const row = toRecipeRow(saved, key);
  expect(row).toMatchObject({ calories_value: 320, calories_unit: caloriesUnit, servings: 4 });
  expect(row).not.toHaveProperty("caloriesValue");
  expect(row).not.toHaveProperty("calories_info");
  expect(row).not.toHaveProperty("calories_note");
  expect(fromRecipeRow(row)).toMatchObject({ caloriesValue: 320, caloriesUnit });
  const reloaded = new RecipeStore(cache, null).getSnapshot().recipes.find(recipe => recipe.id === saved.id);
  expect(reloaded).toMatchObject({ caloriesValue: 320, caloriesUnit });
});

it("conserve une modification des calories ainsi que la valeur zéro", async () => {
  const cache = memory();
  let row = toRecipeRow(base, key);
  const remote: RemoteRecipes = {
    initialize: async () => {},
    fetch: async () => [fromRecipeRow(row)],
    remove: async () => {},
    reset: async () => {},
    save: recipe => saveCompatible(recipe, key, async value => {
      row = value;
      return { error: null };
    }),
  };
  const store = new RecipeStore(cache, remote);
  const saved = store.save({ ...base, caloriesValue: 220, caloriesUnit: "total" });
  await store.sync();
  expect(row).toMatchObject({ calories_value: 220, calories_unit: "total" });

  store.save({ ...saved, caloriesValue: 0, caloriesUnit: "per_serving" }, saved.id);
  await store.sync();
  expect(row).toMatchObject({ calories_value: 0, calories_unit: "per_serving" });
  expect(store.getSnapshot().recipes[0]).toMatchObject({ caloriesValue: 0, caloriesUnit: "per_serving" });

  store.save({ ...saved, caloriesValue: null, caloriesUnit: null }, saved.id);
  await store.sync();
  expect(row).toMatchObject({ calories_value: null, calories_unit: null });
  expect(new RecipeStore(cache, null).getSnapshot().recipes[0]).toMatchObject({ caloriesValue: null, caloriesUnit: null });
});

it("refuse des valeurs invalides et une unité inconnue avant toute sauvegarde", () => {
  const store = new RecipeStore(memory(), null);
  const count = store.getSnapshot().recipes.length;
  for (const caloriesValue of [NaN, Infinity, -1, 1.5, 100_001]) {
    expect(() => store.save({ ...base, caloriesValue, caloriesUnit: "total" })).toThrow("nombre entier de calories");
  }
  expect(() => store.save({ ...base, caloriesValue: 42, caloriesUnit: null })).toThrow("unité");
  expect(() => store.save({ ...base, servings: 0 })).toThrow("portions");
  expect(store.getSnapshot().recipes).toHaveLength(count);
});

it("écarte les estimations historiques en conservant les adaptations de quantités valides", () => {
  const cache = memory();
  cache.setItem("deckchef.recipes.v1.local", JSON.stringify({
    recipes: [{
      ...base, caloriesValue: 160, caloriesUnit: "kcal / 100g", caloriesInfo: historicalCalories,
      caloriesNote: "Ancienne analyse", aiScalingData: historicalAdaptations,
    }],
    queue: [],
  }));
  const fromCache = new RecipeStore(cache, null).getSnapshot().recipes[0];
  const fromCloud = fromRecipeRow({
    ...toRecipeRow(base, key), calories_value: 160, calories_unit: "kcal / 100g",
    calories_info: historicalCalories, ai_scaling_data: historicalAdaptations,
  });
  for (const recipe of [fromCache, fromCloud]) {
    expect(recipe.caloriesValue).toBeUndefined();
    expect(recipe.caloriesUnit).toBeUndefined();
    expect(recipe).not.toHaveProperty("caloriesInfo");
    expect(recipe).not.toHaveProperty("caloriesNote");
    expect(recipe.aiScalingData?.servingsMap?.["4"]).toEqual({
      ingredients: base.ingredients,
      cookingNote: "Ajuster la cuisson.",
    });
    expect(recipe.aiScalingData).not.toHaveProperty("caloriesInfo");
    expect(recipe.aiScalingData).not.toHaveProperty("note");
  }

  const store = new RecipeStore(cache, null);
  const photo = store.save({ ...fromCache, image_url: "nouvelle-photo" }, fromCache.id);
  expect(photo.aiScalingData).toEqual(readRecipeAdaptations(historicalAdaptations, base));
  const edited = store.save({ ...photo, steps: ["Une autre cuisson."], caloriesValue: 420, caloriesUnit: "total" }, photo.id);
  expect(edited.aiScalingData).toBeUndefined();
  expect(edited).toMatchObject({ caloriesValue: 420, caloriesUnit: "total" });
});

it("conserve les calories à la lecture si seul le cache d’adaptation manque dans le schéma", async () => {
  const row = toRecipeRow({ ...base, caloriesValue: 100, caloriesUnit: "per_100g" }, key);
  const read = vi.fn()
    .mockResolvedValueOnce({ data: null, error: { code: "42703", message: "column ai_scaling_data missing" } })
    .mockResolvedValueOnce({ data: [row], error: null });
  const recipes = await readCompatible(read);
  expect(read.mock.calls[1][0]).toContain("calories_value,calories_unit");
  expect(read.mock.calls[1][0]).not.toContain("ai_scaling_data");
  expect(recipes[0]).toMatchObject({ servings: 4, caloriesValue: 100, caloriesUnit: "per_100g" });
});

it("garde la saisie manuelle locale en cas de retard de migration puis la synchronise", async () => {
  const cache = memory();
  let upgraded = false, row = toRecipeRow(base, key);
  const remote: RemoteRecipes = {
    initialize: async () => {},
    fetch: async () => [fromRecipeRow(row)],
    remove: async () => {},
    reset: async () => {},
    save: recipe => saveCompatible(recipe, key, async value => {
      if (!upgraded && "calories_value" in value) return { error: { code: "PGRST204", message: "calories_value missing" } };
      row = value;
      return { error: null };
    }),
  };
  const store = new RecipeStore(cache, remote);
  const saved = store.save({ ...base, caloriesValue: 30, caloriesUnit: "per_serving" });
  await store.sync();
  expect(store.getSnapshot().pending).toBe(1);
  const reloaded = new RecipeStore(cache, remote);
  expect(reloaded.getSnapshot().recipes.find(recipe => recipe.id === saved.id)).toMatchObject({ caloriesValue: 30, caloriesUnit: "per_serving" });
  upgraded = true;
  await reloaded.sync();
  expect(reloaded.getSnapshot().pending).toBe(0);
  expect(row).toMatchObject({ calories_value: 30, calories_unit: "per_serving" });
});

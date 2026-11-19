import { beforeEach, expect, it, vi } from "vitest";
import type { RecipeAiData } from "./recipeAiTypes";
import { createLocalRecipeAi } from "./recipeAiFallback";
import { analyzeAndEnrichRecipe } from "./recipeAiEnrichment";
import { RecipeStore } from "./recipeStore";
import { analyzeRecipeAi } from "./recipeAiService";
import { starterRecipes } from "../data/recipes";
import { recipeAiVariantInput } from "./recipeAiTypes";
import { recipeFingerprint, type CaloriesInfo } from "./calorieAnalysis";

const state = vi.hoisted(() => ({ key: "a".repeat(64) }));
vi.mock("./recipeSync", () => ({ getCollectionKey: () => state.key }));
vi.mock("./recipeAiService", () => ({ analyzeRecipeAi: vi.fn() }));
const analyze = vi.mocked(analyzeRecipeAi);
const memory = () => { const values = new Map<string, string>(); return {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
}; };
function setup() { const store = new RecipeStore(memory(), null); const recipe = store.save({ ...starterRecipes[0], servings: 2 }); return { store, recipe }; }
function deferred() { let resolve!: (value: RecipeAiData) => void; const promise = new Promise<RecipeAiData>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { state.key = "a".repeat(64); analyze.mockReset(); });

it("démarre après la sauvegarde immédiate et déduplique les appels pour le même contenu", async () => {
  const { store, recipe } = setup(), result = deferred(), onStatus = vi.fn(); analyze.mockReturnValue(result.promise);
  const first = analyzeAndEnrichRecipe(store, recipe, { onStatus }), second = analyzeAndEnrichRecipe(store, recipe);
  expect(first).toBe(second); expect(analyze).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().recipes.find(item => item.id === recipe.id)?.title).toBe(recipe.title);
  expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ state: "analyzing" }));
  expect(analyze.mock.calls[0][1]?.collectionKey).toBe(state.key);
  const data = createLocalRecipeAi(recipe); result.resolve(data);
  expect(await first).toEqual(data);
  expect(store.getSnapshot().recipes.find(item => item.id === recipe.id)?.aiScalingData).toEqual(data);
});

it("ignore une réponse arrivée après modification des ingrédients ou suppression", async () => {
  for (const remove of [false, true]) {
    const { store, recipe } = setup(), result = deferred(); analyze.mockReturnValueOnce(result.promise);
    const pending = analyzeAndEnrichRecipe(store, recipe);
    if (remove) store.remove(recipe.id); else store.save({ ...recipe, ingredients: ["250 g de riz"] }, recipe.id);
    result.resolve(createLocalRecipeAi(recipe));
    expect(await pending).toBeNull();
    expect(store.getSnapshot().recipes.find(item => item.id === recipe.id)?.aiScalingData).toBeUndefined();
  }
});

it("ignore une réponse quand le carnet courant ou son store a changé", async () => {
  const { store, recipe } = setup(), result = deferred(); let current = true; analyze.mockReturnValue(result.promise);
  const pending = analyzeAndEnrichRecipe(store, recipe, { isCurrent: () => current });
  current = false; state.key = "b".repeat(64); result.resolve(createLocalRecipeAi(recipe));
  expect(await pending).toBeNull();
  expect(store.getSnapshot().recipes.find(item => item.id === recipe.id)?.aiScalingData).toBeUndefined();
});

it("annule l’ancien travail lorsque le nouveau contenu est analysé", async () => {
  const { store, recipe } = setup(), old = deferred(), latest = deferred(); analyze.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const oldJob = analyzeAndEnrichRecipe(store, recipe);
  const edited = store.save({ ...recipe, ingredients: ["250 g de riz"] }, recipe.id);
  const newJob = analyzeAndEnrichRecipe(store, edited);
  expect(analyze.mock.calls[0][1]?.signal?.aborted).toBe(true);
  old.resolve(createLocalRecipeAi(recipe)); latest.resolve(createLocalRecipeAi(edited));
  expect(await oldJob).toBeNull(); expect(await newJob).toEqual(createLocalRecipeAi(edited));
  expect(store.getSnapshot().recipes.find(item => item.id === recipe.id)?.ingredients).toEqual(["250 g de riz"]);
});

it("ne remplace pas les variantes Gemini valides par un secours local lors d’une panne", async () => {
  const { store, recipe } = setup(), local = createLocalRecipeAi(recipe);
  const info = (input: typeof recipe, totalKcal: number): CaloriesInfo => ({ type: "plat_sale", basis: "100g", totalKcal, cookedWeightGrams: 500, kcal: Math.round(totalKcal / 5), estimated: true, assumptions: [], model: "gemini-3.5-flash-lite", analyzedAt: "2026-11-19T10:00:00Z", fingerprint: recipeFingerprint(input) });
  const gemini: RecipeAiData = { ...local, source: "gemini", model: "gemini-3.5-flash-lite", caloriesInfo: info(recipe, 800), servingsMap: Object.fromEntries(Object.entries(local.servingsMap!).map(([target, variant]) => [target, { ...variant, caloriesInfo: info(recipeAiVariantInput(recipe, variant, Number(target)) as typeof recipe, 800 * Number(target) / 2) }])) };
  expect(store.enrichAi(recipe.id, recipeFingerprint(recipe), gemini)).toBe(true);
  analyze.mockResolvedValue(local);
  const status = vi.fn(); expect(await analyzeAndEnrichRecipe(store, recipe, { onStatus: status })).toEqual(gemini);
  expect(store.getSnapshot().recipes.find(item => item.id === recipe.id)?.aiScalingData?.source).toBe("gemini");
  expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ state: "ready" }));
});

it("termine sans rejet non géré si le service échoue", async () => {
  const { store, recipe } = setup(), onStatus = vi.fn(); analyze.mockRejectedValue(new Error("unavailable"));
  expect(await analyzeAndEnrichRecipe(store, recipe, { onStatus })).toBeNull();
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: "error" }));
  expect(store.getSnapshot().recipes.find(item => item.id === recipe.id)?.title).toBe(recipe.title);
});

it("signale un quota local plein sans perdre la recette sauvegardée ni prétendre avoir enregistré l’analyse", async () => {
  let full = false;
  const storage = memory(), store = new RecipeStore({ getItem: storage.getItem, setItem: (key, value) => {
    if (full) throw new Error("QuotaExceededError");
    storage.setItem(key, value);
  } }, null);
  const recipe = store.save({ ...starterRecipes[0], servings: 2 }), onStatus = vi.fn();
  const result = deferred(); analyze.mockReturnValue(result.promise);
  const pending = analyzeAndEnrichRecipe(store, recipe, { onStatus });
  full = true; result.resolve(createLocalRecipeAi(recipe));
  expect(await pending).toBeNull();
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: "error" }));
  const unchanged = store.getSnapshot().recipes.find(item => item.id === recipe.id)!;
  expect(unchanged.title).toBe(recipe.title);
  expect(unchanged.aiScalingData).toBeUndefined();
});

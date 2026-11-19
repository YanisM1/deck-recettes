import { describe, expect, it } from "vitest";
import { hasFreshCalories, isCaloriesInfo, normalizeAnalysisInput, recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis";
const recipe: AnalysisInput = { title: "Gâteau", category: "sucre", ingredients: ["200 g de farine", "2 œufs"], steps: ["Cuire 30 minutes à 180 °C."], isCake: true, panSize: 26 };
const info: CaloriesInfo = { type: "gateau", totalKcal: 1600, cookedWeightGrams: 600, kcal: 200, basis: "part", parts: 8, estimated: true, assumptions: ["Perte d’eau à la cuisson estimée."], analyzedAt: "2026-11-18T10:00:00.000Z", model: "gemini-3.8-flash", fingerprint: recipeFingerprint(recipe) };
describe("validité des estimations", () => {
  it("normalise les espaces et les valeurs par défaut sans périmer l’analyse", () => {
    const cleaned = normalizeAnalysisInput({ ...recipe, title: " Gâteau ", ingredients: [" 200 g de farine ", "", "2 œufs"], steps: ["Cuire 30 minutes à 180 °C.", ""] });
    expect(recipeFingerprint(cleaned)).toBe(info.fingerprint);
    expect(hasFreshCalories({ ...cleaned, caloriesInfo: info })).toBe(true);
    expect(recipeFingerprint({ ...recipe, servings: 2 })).toBe(info.fingerprint);
  });
  it("périme l’analyse quand la cuisson, les quantités, le moule ou les portions changent", () => {
    for (const change of [{ ingredients: ["400 g de farine", "2 œufs"] }, { steps: ["Faire frire dans de l’huile."] }, { panSize: 28 as const }, { servings: 4 }]) expect(hasFreshCalories({ ...recipe, ...change, caloriesInfo: info })).toBe(false);
    expect(hasFreshCalories({ ...recipe, caloriesInfo: undefined })).toBe(false);
  });
  it("accepte un brouillon vide pour l’empreinte mais le refuse avant l’appel réseau", () => {
    expect(() => recipeFingerprint({ title: "", category: "sale", ingredients: [""], steps: [""] })).not.toThrow();
    expect(() => normalizeAnalysisInput({ ...recipe, ingredients: [""] })).toThrow();
    expect(() => normalizeAnalysisInput({ ...recipe, panSize: "26" })).toThrow();
    expect(() => normalizeAnalysisInput({ ...recipe, category: ["sale"] })).toThrow();
    expect(() => normalizeAnalysisInput({ ...recipe, servings: -1 })).toThrow();
    expect(() => normalizeAnalysisInput({ ...recipe, steps: ["x".repeat(2001)] })).toThrow();
  });
  it("ignore le moule pour un plat salé ordinaire et les propriétés étrangères à l’analyse", () => {
    const savory = { ...recipe, category: "sale" as const, isCake: false };
    expect(recipeFingerprint({ ...savory, panSize: 26 })).toBe(recipeFingerprint({ ...savory, panSize: undefined }));
    expect(normalizeAnalysisInput(savory).panSize).toBeUndefined();
    expect(recipeFingerprint({ ...recipe, image_url: "secret", linkedRecipeIds: ["ignored"] } as AnalysisInput)).toBe(info.fingerprint);
  });
  it("canonicalise les recettes sucrées anciennes avec un moule par défaut stable", () => {
    const legacy = { ...recipe, isCake: false, panSize: undefined };
    expect(normalizeAnalysisInput(legacy)).toMatchObject({ isCake: true, panSize: 26 });
    expect(recipeFingerprint(legacy)).toBe(recipeFingerprint(normalizeAnalysisInput(legacy)));
    expect(recipeFingerprint({ ...legacy, panSize: 20 })).not.toBe(recipeFingerprint(legacy));
  });
  it("refuse les incohérences arithmétiques et les réponses non estimatives", () => {
    expect(isCaloriesInfo(info)).toBe(true);
    for (const change of [{ type: ["gateau"] }, { totalKcal: NaN }, { cookedWeightGrams: 0 }, { kcal: 450 }, { parts: 6 }, { estimated: false }, { basis: "100g" }, { analyzedAt: "invalid" }, { fingerprint: "arbitrary" }]) expect(isCaloriesInfo({ ...info, ...change })).toBe(false);
  });
});

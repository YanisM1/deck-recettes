import { describe, expect, it } from "vitest";
import { createLocalRecipeAi, scaleRecipeIngredients } from "./recipeAiFallback";
import { isRecipeAiData, hasFreshRecipeAi, recipeAiVariantInput } from "./recipeAiTypes";
import { recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis";
const dish: AnalysisInput = { title: "Steaks et oignons", category: "sale", ingredients: ["2 steaks", "1 oignon", "10 g de sel", "20 ml d’huile"], steps: ["Cuire à la poêle."], servings: 2 };
const cake: AnalysisInput = { title: "Gâteau", category: "sucre", ingredients: ["200 g de farine", "2 œufs", "100 g de sucre", "4 g de levure"], steps: ["Cuire 30 minutes à 180 °C."], isCake: true, panSize: 20 };
describe("adaptations locales pré-calculées", () => {
  it("génère toutes les variantes sans réseau, ni calories inventées", () => {
    const result = createLocalRecipeAi(dish);
    expect(isRecipeAiData(result, dish)).toBe(true);
    expect(Object.keys(result.servingsMap!)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(result.caloriesInfo).toBeUndefined();
    expect(result.source).toBe("local");
    expect(createLocalRecipeAi(dish)).toEqual(result);
  });
  it("arrondit les pièces entières et modère les assaisonnements", () => {
    const three = createLocalRecipeAi(dish).servingsMap!["3"];
    expect(three.ingredients.slice(0, 2)).toEqual(["3 steaks", "2 oignon"]);
    expect(three.ingredients[2]).not.toBe("15 g de sel");
    expect(three.ingredients[3]).not.toBe("30 ml d’huile");
    expect(scaleRecipeIngredients({ ...dish, ingredients: ["½ oignon", "1,5 steak", "0,75 œuf"] }, 1)).toEqual(["1 oignon", "2 steak", "1 œuf"]);
  });
  it("rééquilibre la pâtisserie sur les œufs entiers, dans les trois moules", () => {
    const result = createLocalRecipeAi(cake);
    expect(isRecipeAiData(result, cake)).toBe(true);
    expect(result.panSizesMap!["20"].ingredients).toEqual(cake.ingredients);
    expect(result.panSizesMap!["26"].ingredients).toEqual(["300 g de farine", "3 œufs", "150 g de sucre", "6 g de levure"]);
    expect(result.panSizesMap!["28"].ingredients).toEqual(["400 g de farine", "4 œufs", "200 g de sucre", "8 g de levure"]);
    expect(result.panSizesMap!["26"].cookingNote).toContain("Vérifiez");
  });
  it("préserve seulement une estimation fraîche de la variante d’origine", () => {
    const known: CaloriesInfo = { type: "gateau", basis: "part", parts: 8, totalKcal: 1600, cookedWeightGrams: 600, kcal: 200, estimated: true, assumptions: [], analyzedAt: "2026-11-19T10:00:00Z", model: "gemini-3.5-flash-lite", fingerprint: recipeFingerprint(cake) };
    const result = createLocalRecipeAi({ ...cake, caloriesInfo: known });
    expect(result.caloriesInfo).toEqual(known);
    expect(result.panSizesMap!["20"].caloriesInfo?.fingerprint).toBe(recipeFingerprint(recipeAiVariantInput(cake, result.panSizesMap!["20"], 20)));
    expect(result.panSizesMap!["26"].caloriesInfo).toBeUndefined();
    expect(createLocalRecipeAi({ ...cake, steps: ["Frire."], caloriesInfo: known }).caloriesInfo).toBeUndefined();
  });
  it("refuse une table partielle, un contenu périmé et les fractions de pièces", () => {
    const result = createLocalRecipeAi(dish);
    expect(hasFreshRecipeAi({ ...dish, aiScalingData: result })).toBe(true);
    expect(hasFreshRecipeAi({ ...dish, ingredients: ["4 steaks"], aiScalingData: result })).toBe(false);
    expect(isRecipeAiData({ ...result, servingsMap: { "1": result.servingsMap!["1"] } }, dish)).toBe(false);
    const invalid = structuredClone(result); invalid.servingsMap!["3"].ingredients[0] = "1,5 steak";
    expect(isRecipeAiData(invalid, dish)).toBe(false);
  });
  it("refuse les unités inversées et les densités physiquement impossibles", () => {
    const known: CaloriesInfo = { type: "plat_sale", basis: "100g", totalKcal: 1600, cookedWeightGrams: 800, kcal: 200, estimated: true, assumptions: [], analyzedAt: "2026-11-19T10:00:00Z", model: "gemini-3.5-flash-lite", fingerprint: recipeFingerprint(dish) };
    const result = createLocalRecipeAi({ ...dish, caloriesInfo: known });
    expect(isRecipeAiData(result, dish)).toBe(true);
    const wrongKind = structuredClone(result); wrongKind.caloriesInfo = { ...known, type: "gateau", basis: "part", parts: 8 };
    expect(isRecipeAiData(wrongKind, dish)).toBe(false);
    const impossible = structuredClone(result); impossible.caloriesInfo = { ...known, totalKcal: 16000, kcal: 2000 };
    expect(isRecipeAiData(impossible, dish)).toBe(false);
  });
});

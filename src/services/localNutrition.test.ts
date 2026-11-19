import { describe, expect, it } from "vitest";
import { estimateLocalNutrition } from "./localNutrition";
import { hasFreshCalories } from "./calorieAnalysis";
import type { AnalysisInput } from "./calorieAnalysis";

const cake: AnalysisInput = {
  title: "Gâteau chocolat",
  category: "sucre",
  panSize: 26,
  ingredients: ["— Base gâteau —", "200 g de farine", "2 œufs", "100 g de sucre", "100 g de chocolat noir"],
  steps: ["Mélanger puis cuire 30 minutes au four."],
};
const dish: AnalysisInput = {
  title: "Poulet au riz",
  category: "sale",
  servings: 2,
  ingredients: ["250 g de poulet", "150 g de riz", "15 ml d’huile d’olive", "200 ml d’eau", "1 pincée de sel"],
  steps: ["Faire bouillir le riz, puis cuire le poulet à la poêle."],
};

describe("calcul calorique local", () => {
  it("estime un gâteau par huitième et saute les séparateurs fusionnés", () => {
    const result = estimateLocalNutrition(cake);
    expect(result).toMatchObject({ type: "gateau", basis: "part", parts: 8, model: "local-nutrition-v1", kcal: expect.any(Number) });
    expect(result!.kcal).toBeGreaterThan(200);
    expect(result!.kcal).toBeLessThan(400);
    expect(hasFreshCalories(cake && { ...cake, caloriesInfo: result })).toBe(true);
  });
  it("estime le plat sur sa masse cuite indiquée par 100 g", () => {
    const result = estimateLocalNutrition(dish);
    expect(result).toMatchObject({ type: "plat_sale", basis: "100g", model: "local-nutrition-v1", kcal: expect.any(Number) });
    expect(result!.cookedWeightGrams).toBeLessThan(615);
    expect(result!.kcal).toBeGreaterThan(100);
    expect(result!.kcal).toBeLessThan(400);
  });
  it("n’affiche pas une valeur locale si un ingrédient calorique est inconnu", () => {
    expect(estimateLocalNutrition({ ...dish, ingredients: [...dish.ingredients, "1 portion de poudre magique"] })).toBeUndefined();
  });
  it("accepte les unités françaises usuelles et reconnaît sel, poivre et eau", () => {
    expect(estimateLocalNutrition({ ...dish, ingredients: ["2 œufs", "1 c. à soupe d’huile", "10 g de farine", "Sel, poivre et eau"] })).toBeDefined();
  });
});

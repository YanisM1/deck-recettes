import { describe, expect, it } from "vitest";
import { createLocalRecipeAdaptations, scaleRecipeIngredients } from "./recipeAdaptation";
import { hasFractionalIndivisible, isRecipeAiData, type RecipeAdaptationInput } from "./recipeAiTypes";
const dish: RecipeAdaptationInput = { title: "Pièces et fractions", category: "sale", servings: 2, ingredients: ["1½ œuf", "1 1/2 steak", "⅜ oignon"], steps: ["Cuire à la poêle."] };
describe("fractions mixtes et quantités indivisibles", () => {
  it.each(["1½ œuf", "1 1/2 steak", "1 1 / 2 oignon", "⅜ oignon", "1⅝ œuf", "1,5 steak", "1/2 œuf"])("détecte la pièce fractionnaire %s", line => {
    expect(hasFractionalIndivisible(line)).toBe(true);
  });
  it.each(["1.5 g de levure", "1½ g de levure", "1 1/2 g de sel", "2 œufs", "1 à 2 steaks", "1 2/2 œufs"])("accepte les mesures ou pièces entières %s", line => {
    expect(hasFractionalIndivisible(line)).toBe(false);
  });
  it("préserve les quantités d’origine et arrondit les variantes hors ligne", () => {
    const data = createLocalRecipeAdaptations(dish);
    expect(isRecipeAiData(data, dish)).toBe(true);
    expect(data.servingsMap!["2"].ingredients).toEqual(dish.ingredients);
    for (const [target, variant] of Object.entries(data.servingsMap!)) {
      if (target !== "2") expect(variant.ingredients.some(hasFractionalIndivisible)).toBe(false);
    }
  });
  it("rééquilibre les quantités pâtissières autour des œufs d’origine mixtes", () => {
    const input = { ...dish, category: "sucre" as const, isCake: true, panSize: 20 as const, ingredients: ["1½ œuf", "150 g de farine"] };
    expect(scaleRecipeIngredients(input, 2, { pastry: true })).toEqual(["3 œuf", "300 g de farine"]);
  });
  it("conserve les décimales légales des ingrédients pesés", () => {
    expect(scaleRecipeIngredients({ ...dish, ingredients: ["1.5 g de levure", "1½ g de levure", "1 1/2 g de levure"] }, 2)).toEqual(["3 g de levure", "3 g de levure", "3 g de levure"]);
  });
  it("laisse les plages et les concentrations explicites sans les corrompre", () => {
    const lines = ["1 à 2 œufs", "1–2 steaks", "1 - 2 oignons", "20 % de crème", "2 x 200 g de tomates"];
    expect(scaleRecipeIngredients({ ...dish, ingredients: lines }, 2)).toEqual(lines);
  });
  it("arrondit les pièces de la salade réelle sans confondre le citron avec son assaisonnement", () => {
    const salad = { ...dish, ingredients: ["1 petit concombre", "3 c. à soupe d’huile d’olive", "1 citron, sel et poivre"] };
    const result = createLocalRecipeAdaptations(salad);
    expect(result.servingsMap!["8"].ingredients).toEqual(["4 petit concombre", "7,5 c. à soupe d’huile d’olive", "4 citron, sel et poivre"]);
    expect(isRecipeAiData(result, salad)).toBe(true);
    const cucumberCounts = Object.values(result.servingsMap!).map(variant => Number(variant.ingredients[0].split(" ")[0]));
    expect(cucumberCounts).toEqual([...cucumberCounts].sort((a, b) => a - b));
    for (const variant of Object.values(result.servingsMap!)) expect(variant.ingredients.some(hasFractionalIndivisible)).toBe(false);
  });
  it.each(["1,33 petit concombre", "2,46 citron, sel et poivre", "0,75 avocat", "1⅝ gros poivron", "1 1/3 grand brocoli", "⅝ moyenne aubergine"])("refuse les fractions arbitraires de légumes %s", line => {
    expect(hasFractionalIndivisible(line)).toBe(true);
  });
  it.each(["0.5 petit concombre", "1.5 avocat", "1.5 citron, sel et poivre", "½ citron", "1½ gros poivron", "1 1/2 grand brocoli"])("accepte les demi-légumes usuels %s", line => {
    expect(hasFractionalIndivisible(line)).toBe(false);
  });
  it("préserve les fractions pesées et les doses d’origine, puis arrondit les cuillères au quart", () => {
    const ingredients = ["1.5 g de levure", "1/8 c. à café de sel", "1 cuil. à soupe d’huile", "2 c. à café de cumin"];
    const input = { ...dish, ingredients };
    expect(scaleRecipeIngredients(input, 1)).toEqual(ingredients);
    expect(scaleRecipeIngredients(input, 2)[0]).toBe("3 g de levure");
    const result = scaleRecipeIngredients(input, 4);
    expect(result.slice(1)).toEqual(["0,25 c. à café de sel", "2,5 cuil. à soupe d’huile", "5 c. à café de cumin"]);
  });
});

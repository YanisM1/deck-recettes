import { describe, expect, it } from "vitest";
import { createLocalRecipeAdaptations } from "./recipeAdaptation";
import { isRecipeAiData, readRecipeAdaptations, recipeAiKind, recipeFingerprint, type RecipeAdaptationInput } from "./recipeAiTypes";

const dish: RecipeAdaptationInput = {
  title: "Steaks et oignons", category: "sale", servings: 2,
  ingredients: ["2 steaks", "1 oignon", "10 g de sel", "20 ml d’huile"],
  steps: ["Cuire à la poêle."],
};
const cake: RecipeAdaptationInput = {
  title: "Gâteau", category: "sucre", isCake: true, panSize: 20,
  ingredients: ["200 g de farine", "2 œufs", "100 g de sucre", "4 g de levure"],
  steps: ["Cuire 30 minutes à 180 °C."],
};

describe("variantes de portions et de moules", () => {
  it("prépare les huit portions, préserve la base et modère les assaisonnements", () => {
    const result = createLocalRecipeAdaptations(dish);
    expect(isRecipeAiData(result, dish)).toBe(true);
    expect(Object.keys(result.servingsMap!)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(result.servingsMap!["2"].ingredients).toEqual(dish.ingredients);
    const three = result.servingsMap!["3"];
    expect(three.ingredients.slice(0, 2)).toEqual(["3 steaks", "2 oignon"]);
    expect(three.ingredients[2]).not.toBe("15 g de sel");
    expect(three.ingredients[3]).not.toBe("30 ml d’huile");
    expect(createLocalRecipeAdaptations(dish)).toEqual(result);
  });

  it("rééquilibre la pâtisserie sur les œufs entiers dans les trois moules", () => {
    const result = createLocalRecipeAdaptations(cake);
    expect(isRecipeAiData(result, cake)).toBe(true);
    expect(result.panSizesMap!["20"].ingredients).toEqual(cake.ingredients);
    expect(result.panSizesMap!["26"].ingredients).toEqual(["300 g de farine", "3 œufs", "150 g de sucre", "6 g de levure"]);
    expect(result.panSizesMap!["28"].ingredients).toEqual(["400 g de farine", "4 œufs", "200 g de sucre", "8 g de levure"]);
    expect(result.panSizesMap!["26"].cookingNote).toContain("Vérifiez");
  });

  it("affiche des portions pour une recette sucrée explicitement sans moule", () => {
    const result = createLocalRecipeAdaptations({ ...cake, isCake: false, panSize: undefined });
    expect(result.servingsMap).toBeDefined();
    expect(result.panSizesMap).toBeUndefined();
  });

  it("retrouve le moule d’un ancien sucré si ses variantes historiques correspondent encore", () => {
    const older = { ...cake, isCake: false, panSize: undefined };
    const legacyCache = createLocalRecipeAdaptations({ ...older, isCake: true });
    expect(readRecipeAdaptations(legacyCache, older)?.panSizesMap).toEqual(legacyCache.panSizesMap);
    expect(recipeAiKind({ ...older, aiScalingData: legacyCache })).toBe("sucre");
    expect(recipeAiKind({ ...older, aiScalingData: legacyCache, steps: ["Nouvelle cuisson."] })).toBe("sale");
  });

  it("lit les ingrédients et conseils historiques en ignorant les estimations", () => {
    const local = createLocalRecipeAdaptations(cake);
    const stored = {
      ...local, source: "gemini", model: "gemini-3.5-flash-lite", note: "Estimation IA",
      caloriesInfo: { kcal: 200 },
      panSizesMap: {
        ...local.panSizesMap,
        "26": { ingredients: ["310 g de farine", "3 œufs", "160 g de sucre", "6 g de levure"], cookingNote: "Surveiller le centre.", caloriesInfo: { kcal: 300 } },
      },
    };
    const read = readRecipeAdaptations(stored, cake);
    expect(read?.panSizesMap?.["26"]).toEqual({
      ingredients: stored.panSizesMap["26"].ingredients, cookingNote: "Surveiller le centre.",
    });
    expect(read).not.toHaveProperty("caloriesInfo");
    expect(read).not.toHaveProperty("note");
  });

  it("refuse une table partielle, un contenu périmé et les fractions de pièces adaptées", () => {
    const result = createLocalRecipeAdaptations(dish);
    expect(readRecipeAdaptations(result, { ...dish, steps: ["Frire."] })).toBeUndefined();
    expect(readRecipeAdaptations({ ...result, servingsMap: { "1": result.servingsMap!["1"] } }, dish)).toBeUndefined();
    const invalid = structuredClone(result);
    invalid.servingsMap!["3"].ingredients[0] = "1,5 steak";
    expect(readRecipeAdaptations(invalid, dish)).toBeUndefined();
  });

  it("préserve l’empreinte des variantes historiques quand seul un espacement varie", () => {
    const legacy = { ...cake, title: " Gâteau ", ingredients: [" 200 g de farine ", "", ...cake.ingredients.slice(1)] };
    expect(recipeFingerprint(legacy)).toBe(recipeFingerprint(cake));
    expect(recipeFingerprint({ ...cake, servings: 2 })).toBe(recipeFingerprint(cake));
    expect(recipeFingerprint({ ...cake, panSize: 28 })).not.toBe(recipeFingerprint(cake));
  });
});

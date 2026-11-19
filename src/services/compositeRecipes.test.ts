import { describe, expect, it } from "vitest";
import { composeRecipes, normalizeLinkedRecipeIds, validateRecipeLinks, type CompositeRecipe } from "./compositeRecipes";
import { hasFreshCalories, isCaloriesInfo, recipeFingerprint, type CaloriesInfo } from "./calorieAnalysis";
import { scaleIngredients } from "../utils/recipePortions";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
function recipe(value: number, patch: Partial<CompositeRecipe> = {}): CompositeRecipe {
  return { id: id(value), title: `Recette ${value}`, category: "sale", ingredients: [`100 g ingrédient ${value}`], steps: [`Cuire la préparation ${value}.`], image_url: "", created_at: "2026-11-18T10:00:00.000Z", updated_at: "2026-11-18T10:00:00.000Z", servings: 2, ...patch };
}
function analyzed(value: CompositeRecipe, totalKcal = 800, cookedWeightGrams = 400): CompositeRecipe {
  const cake = value.isCake === true;
  const caloriesInfo: CaloriesInfo = {
    type: cake ? "gateau" : "plat_sale", basis: cake ? "part" : "100g",
    ...(cake ? { parts: 8 as const } : {}), totalKcal, cookedWeightGrams,
    kcal: Math.round(cake ? totalKcal / 8 : totalKcal / cookedWeightGrams * 100),
    estimated: true, assumptions: ["Masse cuite estimée après évaporation."],
    analyzedAt: "2026-11-18T10:00:00.000Z", model: "gemini-2.5-flash", fingerprint: recipeFingerprint(value),
  };
  return { ...value, caloriesInfo };
}

describe("assemblage des recettes", () => {
  it("garde une recette simple intacte et clone ses tableaux", () => {
    const base = analyzed(recipe(1));
    const result = composeRecipes(base, [base]);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({ title: base.title, isBase: true });
    expect(result.sections[0].ingredients).toEqual(base.ingredients);
    expect(result.sections[0].ingredients).not.toBe(base.ingredients);
    expect(result.steps).toEqual(base.steps);
    expect(result.assemblyStep).toBeUndefined();
    expect(result.caloriesInfo).toBe(base.caloriesInfo);
    expect(result.warnings).toEqual([]);
  });

  it("conserve les préparations entières par sections et applique un seul facteur de portions", () => {
    const base = recipe(1, { servings: 8, linkedRecipeIds: [id(2)] });
    const ganache = recipe(2, { servings: 2, ingredients: ["200 g chocolat", "100 ml crème"] });
    const result = composeRecipes(base, [base, ganache]);
    expect(result.sections.map(section => [section.recipeId, section.isBase])).toEqual([[id(1), true], [id(2), false]]);
    expect(result.ingredients).toEqual(["100 g ingrédient 1", "200 g chocolat", "100 ml crème"]);
    expect(scaleIngredients(result.ingredients, 8, 4)).toEqual(["50 g ingrédient 1", "100 g chocolat", "50 ml crème"]);
    expect(result.steps).toEqual([...base.steps, ...ganache.steps, "Assembler les préparations selon les indications de la recette de base."]);
    expect(ganache.ingredients).toEqual(["200 g chocolat", "100 ml crème"]);
  });

  it("additionne les kcal et divise un gâteau assemblé en huit parts, sans double compte", () => {
    const base = analyzed(recipe(1, { isCake: true, panSize: 26, servings: 2, linkedRecipeIds: [id(2)] }), 3200, 800);
    const ganache = analyzed(recipe(2), 800, 200);
    const result = composeRecipes(base, [base, ganache]);
    expect(result.caloriesInfo).toMatchObject({ type: "gateau", basis: "part", parts: 8, totalKcal: 4000, cookedWeightGrams: 1000, kcal: 500, model: "composite-v1", estimated: true });
    expect(isCaloriesInfo(result.caloriesInfo)).toBe(true);
    expect(result.caloriesInfo!.fingerprint).not.toBe(base.caloriesInfo!.fingerprint);
    expect(hasFreshCalories({ ...base, caloriesInfo: result.caloriesInfo })).toBe(false);
    expect(hasFreshCalories({ ...base, ingredients: result.ingredients, steps: result.steps, caloriesInfo: result.caloriesInfo })).toBe(true);
    expect(base.caloriesInfo!.totalKcal).toBe(3200);
  });

  it("pondère le plat par la masse cuite globale au lieu de moyenner les concentrations", () => {
    const base = analyzed(recipe(1, { linkedRecipeIds: [id(2)] }), 1000, 500);
    const sauce = analyzed(recipe(2), 500, 1000);
    const result = composeRecipes(base, [base, sauce]);
    expect(result.caloriesInfo).toMatchObject({ type: "plat_sale", basis: "100g", totalKcal: 1500, cookedWeightGrams: 1500, kcal: 100 });
    expect(result.caloriesInfo!.parts).toBeUndefined();
  });

  it.each([true, false])("conserve les calories d’une copie partagée complète sans liaison (gâteau=%s)", cake => {
    const base = analyzed(recipe(1, { isCake: cake, linkedRecipeIds: [id(2)] }), 1600, 800);
    const child = analyzed(recipe(2), 800, 200);
    const combined = composeRecipes(base, [base, child]);
    const portable = { ...base, linkedRecipeIds: undefined, ingredients: combined.ingredients, steps: combined.steps, caloriesInfo: combined.caloriesInfo };
    expect(hasFreshCalories(portable)).toBe(true);
    const reopened = composeRecipes(portable, []);
    expect(reopened.caloriesInfo).toBe(combined.caloriesInfo);
    expect(reopened.caloriesInfo).toMatchObject({ totalKcal: 2400, cookedWeightGrams: 1000, kcal: cake ? 300 : 240 });
    expect(reopened.caloriesUnavailableReason).toBeUndefined();
    expect(composeRecipes({ ...portable, ingredients: ["Quantités modifiées"] }, []).caloriesInfo).toBeUndefined();
  });

  it("ne compte qu’une fois une dépendance partagée dans un diamant", () => {
    const base = analyzed(recipe(1, { linkedRecipeIds: [id(2), id(3)] }));
    const left = analyzed(recipe(2, { linkedRecipeIds: [id(4)] }));
    const right = analyzed(recipe(3, { linkedRecipeIds: [id(4)] }));
    const common = analyzed(recipe(4));
    const result = composeRecipes(base, [base, left, right, common]);
    expect(result.sections.map(section => section.recipeId)).toEqual([id(1), id(2), id(4), id(3)]);
    expect(result.ingredients).toHaveLength(4);
    expect(result.caloriesInfo!.totalKcal).toBe(3200);
    expect(result.warnings).toMatchObject([{ type: "duplicate", recipeId: id(4) }]);
    expect(() => validateRecipeLinks(base.id, [left.id, right.id], [base, left, right, common])).not.toThrow();
  });

  it("affiche les sections encore disponibles mais masque le total si une recette liée manque", () => {
    const base = analyzed(recipe(1, { linkedRecipeIds: [id(2)] }));
    const result = composeRecipes(base, [base]);
    expect(result.ingredients).toEqual(base.ingredients);
    expect(result.warnings).toMatchObject([{ type: "missing", recipeId: id(2) }]);
    expect(result.caloriesInfo).toBeUndefined();
    expect(result.caloriesUnavailableReason).toContain("incomplet");
    expect(() => validateRecipeLinks(base.id, [id(2)], [base])).toThrow(/disponible/);
  });

  it("bloque un total si une analyse est absente, périmée ou invalide", () => {
    const base = analyzed(recipe(1, { linkedRecipeIds: [id(2)] }));
    const linked = analyzed(recipe(2));
    for (const child of [recipe(2), { ...linked, steps: ["Frire plutôt que cuire à la vapeur."] }, { ...linked, caloriesInfo: { ...linked.caloriesInfo!, totalKcal: Infinity } }]) {
      const result = composeRecipes(base, [base, child]);
      expect(result.caloriesInfo).toBeUndefined();
      expect(result.caloriesUnavailableReason).toContain(child.title);
    }
  });

  it("refuse une analyse dérivée comme analyse propre afin de ne pas compter un assemblage deux fois", () => {
    const child = analyzed(recipe(2));
    const base = analyzed(recipe(1, { linkedRecipeIds: [child.id] }));
    const derived = { ...base, caloriesInfo: { ...base.caloriesInfo!, model: "composite-v1" } };
    const result = composeRecipes(derived, [derived, child]);
    expect(result.caloriesInfo).toBeUndefined();
    expect(result.caloriesUnavailableReason).toContain(base.title);
  });

  it("arrête les cycles historiques sans récursion infinie ni calories trompeuses", () => {
    const base = analyzed(recipe(1, { linkedRecipeIds: [id(2)] }));
    const child = analyzed(recipe(2, { linkedRecipeIds: [id(1)] }));
    const result = composeRecipes(base, [base, child]);
    expect(result.sections).toHaveLength(2);
    expect(result.warnings).toMatchObject([{ type: "cycle", recipeId: id(1) }]);
    expect(result.caloriesInfo).toBeUndefined();
    expect(() => validateRecipeLinks(base.id, [child.id], [base, child])).toThrow(/boucle/);
  });

  it("valide les identifiants et empêche les auto-liens", () => {
    expect(normalizeLinkedRecipeIds(undefined)).toEqual([]);
    expect(normalizeLinkedRecipeIds([id(2), id(2).toUpperCase()])).toEqual([id(2)]);
    expect(() => normalizeLinkedRecipeIds([id(1)], id(1))).toThrow(/elle-même/);
    expect(() => normalizeLinkedRecipeIds(["not-a-recipe"])).toThrow(/invalide/);
    expect(() => normalizeLinkedRecipeIds([null])).toThrow(/invalide/);
    expect(() => normalizeLinkedRecipeIds(Array.from({ length: 21 }, (_, index) => id(index + 2)))).toThrow(/maximum/);
  });

  it("limite les graphes anormalement profonds et ne modifie aucune recette source", () => {
    const recipes = Array.from({ length: 24 }, (_, index) => analyzed(recipe(index + 1, { linkedRecipeIds: index < 23 ? [id(index + 2)] : [] })));
    const original = JSON.stringify(recipes);
    const result = composeRecipes(recipes[0], recipes);
    expect(result.warnings.some(warning => warning.type === "limit")).toBe(true);
    expect(result.caloriesInfo).toBeUndefined();
    expect(() => validateRecipeLinks(recipes[0].id, [recipes[1].id], recipes)).toThrow(/imbriquées/);
    expect(JSON.stringify(recipes)).toBe(original);
  });

  it("utilise le brouillon de la base plutôt que sa version enregistrée", () => {
    const stored = recipe(1), child = recipe(2);
    const draft = { ...stored, title: "Brouillon", ingredients: ["250 g farine"], linkedRecipeIds: [child.id] };
    const result = composeRecipes(draft, [stored, child]);
    expect(result.sections[0].title).toBe("Brouillon");
    expect(result.ingredients).toEqual(["250 g farine", ...child.ingredients]);
    expect(stored.ingredients).toEqual(["100 g ingrédient 1"]);
  });
});

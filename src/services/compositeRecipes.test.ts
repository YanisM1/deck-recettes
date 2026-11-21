import { describe, expect, it } from "vitest";
import { composeRecipes, normalizeLinkedRecipeIds, validateRecipeLinks, type CompositeRecipe } from "./compositeRecipes";
import { scaleIngredients } from "../utils/recipePortions";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
function recipe(value: number, patch: Partial<CompositeRecipe> = {}): CompositeRecipe {
  return { id: id(value), title: `Recette ${value}`, category: "sale", ingredients: [`100 g ingrédient ${value}`], steps: [`Cuire la préparation ${value}.`], image_url: "", created_at: "2026-11-18T10:00:00.000Z", updated_at: "2026-11-18T10:00:00.000Z", servings: 2, ...patch };
}

describe("assemblage des recettes", () => {
  it("garde une recette simple intacte et clone ses tableaux", () => {
    const base = recipe(1);
    const result = composeRecipes(base, [base]);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({ title: base.title, isBase: true });
    expect(result.sections[0].ingredients).toEqual(base.ingredients);
    expect(result.sections[0].ingredients).not.toBe(base.ingredients);
    expect(result.steps).toEqual(base.steps);
    expect(result.assemblyStep).toBeUndefined();
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

  it("ne compte qu’une fois une dépendance partagée dans un diamant", () => {
    const base = recipe(1, { linkedRecipeIds: [id(2), id(3)] });
    const left = recipe(2, { linkedRecipeIds: [id(4)] });
    const right = recipe(3, { linkedRecipeIds: [id(4)] });
    const common = recipe(4);
    const result = composeRecipes(base, [base, left, right, common]);
    expect(result.sections.map(section => section.recipeId)).toEqual([id(1), id(2), id(4), id(3)]);
    expect(result.ingredients).toHaveLength(4);
    expect(result.warnings).toMatchObject([{ type: "duplicate", recipeId: id(4) }]);
    expect(() => validateRecipeLinks(base.id, [left.id, right.id], [base, left, right, common])).not.toThrow();
  });

  it("affiche les sections encore disponibles si une recette liée manque", () => {
    const base = recipe(1, { linkedRecipeIds: [id(2)] });
    const result = composeRecipes(base, [base]);
    expect(result.ingredients).toEqual(base.ingredients);
    expect(result.warnings).toMatchObject([{ type: "missing", recipeId: id(2) }]);
    expect(() => validateRecipeLinks(base.id, [id(2)], [base])).toThrow(/disponible/);
  });

  it("arrête les cycles historiques sans récursion infinie", () => {
    const base = recipe(1, { linkedRecipeIds: [id(2)] });
    const child = recipe(2, { linkedRecipeIds: [id(1)] });
    const result = composeRecipes(base, [base, child]);
    expect(result.sections).toHaveLength(2);
    expect(result.warnings).toMatchObject([{ type: "cycle", recipeId: id(1) }]);
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
    const recipes = Array.from({ length: 24 }, (_, index) => recipe(index + 1, { linkedRecipeIds: index < 23 ? [id(index + 2)] : [] }));
    const original = JSON.stringify(recipes);
    const result = composeRecipes(recipes[0], recipes);
    expect(result.warnings.some(warning => warning.type === "limit")).toBe(true);
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

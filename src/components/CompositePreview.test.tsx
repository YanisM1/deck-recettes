import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardDeck } from "./CardDeck";
import { RecipeBook } from "./RecipeBook";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { recipeFingerprint } from "../services/calorieAnalysis";
function analyzed(recipe: Recipe, totalKcal: number, cookedWeightGrams: number): Recipe {
  return { ...recipe, caloriesInfo: { type: "gateau", totalKcal, cookedWeightGrams, basis: "part", parts: 8, kcal: Math.round(totalKcal / 8), estimated: true,
    analyzedAt: "2026-11-18T12:00:00Z", assumptions: [], model: "gemini-3.8-flash", fingerprint: recipeFingerprint(recipe) } };
}
describe.each([CardDeck, RecipeBook])("badge global de l’aperçu", Component => {
  it("prend les préparations dans le carnet complet même si elles sont filtrées de la vue", () => {
    const garnish = analyzed({ ...starterRecipes[1], category: "sucre", isCake: true }, 800, 200);
    const base = analyzed({ ...starterRecipes[0], isCake: true, linkedRecipeIds: [garnish.id] }, 1600, 800);
    const { rerender } = render(<Component recipes={[base]} allRecipes={[base, garnish]} onOpen={() => {}} />);
    expect(screen.getByText("~300 kcal / part")).toBeInTheDocument();
    expect(screen.queryByText("~200 kcal / part")).not.toBeInTheDocument();
    rerender(<Component recipes={[base]} allRecipes={[base]} onOpen={() => {}} />);
    expect(screen.queryByText(/kcal \/ part/)).not.toBeInTheDocument();
  });
});

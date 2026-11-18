import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaloriesBadge } from "./CaloriesBadge";
import { starterRecipes } from "../data/recipes";
import { recipeFingerprint, type CaloriesInfo } from "../services/calorieAnalysis";

describe("badge calorique", () => {
  it.each([false, true])("présente l’estimation pour le type gâteau=%s", cake => {
    const recipe = { ...starterRecipes[0], isCake: cake, servings: 2 };
    const info: CaloriesInfo = { type: cake ? "gateau" : "plat_sale", totalKcal: 2000, cookedWeightGrams: 1000,
      kcal: cake ? 250 : 200, basis: cake ? "part" : "100g", ...(cake ? { parts: 8 as const } : {}),
      estimated: true, assumptions: ["Poids après cuisson estimé."], analyzedAt: "2026-11-18T12:00:00Z", model: "gemini-3.8-flash", fingerprint: recipeFingerprint(recipe) };
    render(<CaloriesBadge recipe={{ ...recipe, caloriesInfo: info }} />);
    expect(screen.getByText(cake ? "~250 kcal / part" : "~200 kcal / 100 g")).toBeInTheDocument();
    expect(screen.getByTitle(cake ? "Estimation IA pour 1 part sur 8" : "Estimation IA pour 100 g du plat cuit")).toBeInTheDocument();
  });
  it("masque l’absence d’estimation et les données périmées", () => {
    const recipe = starterRecipes[0];
    const info: CaloriesInfo = { type: "plat_sale", totalKcal: 2000, cookedWeightGrams: 1000, kcal: 200, basis: "100g", estimated: true,
      assumptions: [], analyzedAt: "2026-11-18T12:00:00Z", model: "gemini-3.8-flash", fingerprint: recipeFingerprint(recipe) };
    const { container, rerender } = render(<CaloriesBadge recipe={recipe} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CaloriesBadge recipe={{ ...recipe, ingredients: ["500 g de sucre"], caloriesInfo: info }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeReader } from "./RecipeReader";
import { starterRecipes } from "../data/recipes";
import { formatManualCalories, MANUAL_CALORIES_UNITS } from "../services/manualCalories";
import type { Recipe } from "../types";

function fixture(caloriesUnit: Recipe["caloriesUnit"] = "per_serving"): Recipe {
  return {
    ...starterRecipes[0],
    category: "sucre",
    isCake: true,
    panSize: 26,
    servings: 8,
    ingredients: ["2 œufs", "200 g de farine"],
    steps: ["Mélanger puis cuire 35 minutes à 180 °C."],
    caloriesValue: 320,
    caloriesUnit,
  };
}

describe("affichage des calories manuelles dans le lecteur", () => {
  it.each(MANUAL_CALORIES_UNITS)("affiche l’unité sélectionnée : %s", (unit) => {
    render(<RecipeReader recipe={fixture(unit)} onClose={() => {}} />);
    expect(screen.getByRole("region", { name: "Calories" })).toHaveTextContent(
      formatManualCalories(320, unit)!,
    );
  });

  it("ne recalcule pas la valeur manuelle quand la recette est adaptée", () => {
    const recipe = fixture("per_serving");
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Moule 20 cm" }));
    expect(screen.getByRole("region", { name: "Calories" })).toHaveTextContent("320 kcal / part");
  });

  it("n’affiche rien lorsque la valeur est absente", () => {
    render(<RecipeReader recipe={{ ...fixture(), caloriesValue: null, caloriesUnit: null }} onClose={() => {}} />);
    expect(screen.queryByRole("region", { name: "Calories" })).not.toBeInTheDocument();
  });
});

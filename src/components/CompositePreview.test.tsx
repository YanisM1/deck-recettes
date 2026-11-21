import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardDeck } from "./CardDeck";
import { RecipeBook } from "./RecipeBook";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";

describe.each([CardDeck, RecipeBook])("badge calorique de l’aperçu", Component => {
  it("affiche uniquement les calories saisies sur la recette affichée", () => {
    const base: Recipe = {
      ...starterRecipes[0],
      linkedRecipeIds: [starterRecipes[1].id],
      caloriesValue: 215,
      caloriesUnit: "per_100g",
    };
    const onOpen = () => {};
    const { rerender } = render(<Component recipes={[base]} onOpen={onOpen} />);
    expect(screen.getByText("215 kcal / 100 g")).toBeVisible();

    const cleared = { ...base, caloriesValue: null, caloriesUnit: null };
    rerender(<Component recipes={[cleared]} onOpen={onOpen} />);
    expect(screen.queryByText(/kcal|Calories à calculer/)).not.toBeInTheDocument();
  });
});

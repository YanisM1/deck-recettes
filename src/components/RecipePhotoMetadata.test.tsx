import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecipePhotoShare } from "./RecipePhotoShare";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { generateRecipeImage } from "../utils/recipeImageGenerator";
vi.mock("../utils/recipeImageGenerator", () => ({ generateRecipeImage: vi.fn(), canShareRecipeImage: vi.fn(() => false), downloadRecipeImage: vi.fn(), shareRecipeImage: vi.fn() }));
function recipeWithInfo(cake = true): Recipe {
  const recipe = { ...starterRecipes[0], servings: 2, isCake: cake };
  return { ...recipe, caloriesValue: 200, caloriesUnit: cake ? "per_serving" : "per_100g" };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateRecipeImage).mockResolvedValue(new File(["PNG"], "recipe.png", { type: "image/png" }));
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:preview"); static revokeObjectURL = vi.fn(); });
});
afterEach(() => vi.unstubAllGlobals());
function mount(recipe: Recipe) {
  render(<RecipePhotoShare recipe={recipe} layout="cards" themeElement={document.createElement("article")} />);
  fireEvent.click(screen.getByText("Portions et calories"));
}
describe("métadonnées de l’export photo", () => {
  it.each([true, false])("préremplit les portions et conserve la valeur saisie pour gâteau=%s", async cake => {
    mount(recipeWithInfo(cake));
    expect(screen.getByLabelText("Portions d’origine")).toHaveValue(2);
    expect(screen.getByLabelText("Personnes")).toHaveValue(2);
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(200);
    fireEvent.change(screen.getByLabelText("Personnes"), { target: { value: "4" } });
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(200);
    await waitFor(() => expect(generateRecipeImage).toHaveBeenLastCalledWith(expect.objectContaining({ servings: 4, calories: { value: 200, unit: cake ? "per_serving" : "per_100g" } })));
  });
  it("permet de modifier la valeur pour l’export et de revenir à celle de la recette", async () => {
    mount(recipeWithInfo());
    fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("Unité"), { target: { value: "total" } });
    fireEvent.change(screen.getByLabelText("Personnes"), { target: { value: "6" } });
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(123);
    await waitFor(() => expect(generateRecipeImage).toHaveBeenLastCalledWith(expect.objectContaining({ calories: { value: 123, unit: "total" } })));
    fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "" } });
    await waitFor(() => expect(generateRecipeImage).toHaveBeenLastCalledWith(expect.objectContaining({ calories: undefined })));
    fireEvent.click(screen.getByRole("button", { name: "Rétablir les calories de la recette" }));
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(200);
    expect(screen.getByLabelText("Unité")).toHaveValue("per_serving");
  });
  it("laisse le champ vide quand aucune valeur manuelle n’est renseignée", () => {
    mount({ ...recipeWithInfo(), caloriesValue: null, caloriesUnit: null });
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(null);
  });
});

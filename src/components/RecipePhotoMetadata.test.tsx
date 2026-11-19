import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecipePhotoShare } from "./RecipePhotoShare";
import { starterRecipes } from "../data/recipes";
import { recipeFingerprint } from "../services/calorieAnalysis";
import type { Recipe } from "../types";
import { generateRecipeImage } from "../utils/recipeImageGenerator";
vi.mock("../utils/recipeImageGenerator", () => ({ generateRecipeImage: vi.fn(), canShareRecipeImage: vi.fn(() => false), downloadRecipeImage: vi.fn(), shareRecipeImage: vi.fn() }));
function recipeWithInfo(cake = true): Recipe {
  const recipe = { ...starterRecipes[0], servings: 2, isCake: cake };
  return { ...recipe, caloriesInfo: { type: cake ? "gateau" : "plat_sale", totalKcal: 1600, cookedWeightGrams: 800, kcal: 200, basis: cake ? "part" : "100g", ...(cake ? { parts: 8 as const } : {}), estimated: true,
    assumptions: [], analyzedAt: "2026-11-18T12:00:00Z", model: "gemini-3.8-flash", fingerprint: recipeFingerprint(recipe) } };
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
  it.each([true, false])("préremplit les portions et ajuste l’énergie du gâteau=%s", async cake => {
    mount(recipeWithInfo(cake));
    expect(screen.getByLabelText("Portions d’origine")).toHaveValue(2);
    expect(screen.getByLabelText("Personnes")).toHaveValue(2);
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(200);
    fireEvent.change(screen.getByLabelText("Personnes"), { target: { value: "4" } });
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(cake ? 400 : 200);
    await waitFor(() => expect(generateRecipeImage).toHaveBeenLastCalledWith(expect.objectContaining({ servings: 4, calories: { value: cake ? 400 : 200, unit: cake ? "portion" : "100g" } })));
  });
  it("conserve la saisie manuelle, permet de masquer l’énergie et de rétablir l’estimation", async () => {
    mount(recipeWithInfo());
    fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("Unité"), { target: { value: "100g" } });
    fireEvent.change(screen.getByLabelText("Personnes"), { target: { value: "6" } });
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(123);
    await waitFor(() => expect(generateRecipeImage).toHaveBeenLastCalledWith(expect.objectContaining({ calories: { value: 123, unit: "100g" } })));
    fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "" } });
    await waitFor(() => expect(generateRecipeImage).toHaveBeenLastCalledWith(expect.objectContaining({ calories: undefined })));
    fireEvent.click(screen.getByRole("button", { name: "Rétablir l’estimation" }));
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(600);
    expect(screen.getByLabelText("Unité")).toHaveValue("portion");
  });
  it("ne préremplit pas une énergie périmée", () => {
    mount({ ...recipeWithInfo(), ingredients: ["Ingrédients modifiés"] });
    expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(null);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecipeReader } from "./RecipeReader";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { hasFreshCalories, recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "../services/calorieAnalysis";
import { createLocalRecipeAi } from "../services/recipeAiFallback";
import { recipeAiVariantInput } from "../services/recipeAiTypes";
import { decodeRecipeShareSnapshot, readRecipeShareRoute } from "../services/recipeShareLink";
import { generateRecipeImage } from "../utils/recipeImageGenerator";

vi.mock("../utils/recipeImageGenerator", () => ({ generateRecipeImage: vi.fn(), canShareRecipeImage: vi.fn(() => false),
  downloadRecipeImage: vi.fn(), shareRecipeImage: vi.fn() }));
function nutrition(input: AnalysisInput, target = 26): CaloriesInfo {
  return { type: "gateau", totalKcal: target * 80, cookedWeightGrams: target * 30, kcal: target * 10,
    basis: "part", parts: 8, estimated: true, assumptions: ["Estimation de test."],
    analyzedAt: "2026-11-19T10:00:00Z", model: "gemini-3.5-flash-lite", fingerprint: recipeFingerprint(input) };
}
function fixture(): Recipe {
  const recipe: Recipe = { ...starterRecipes[2], servings: 8, isCake: true, panSize: 26,
    ingredients: ["2 œufs", "200 g de farine"], steps: ["Mélanger puis cuire 35 minutes à 180 °C."] };
  const data = createLocalRecipeAi(recipe);
  data.source = "gemini"; data.model = "gemini-3.5-flash-lite"; data.caloriesInfo = nutrition(recipe);
  for (const [key, variant] of Object.entries(data.panSizesMap!)) {
    const target = Number(key);
    variant.cookingNote = `Moule ${target} cm : contrôler la cuisson dès ${target === 20 ? 25 : 35} minutes.`;
    variant.caloriesInfo = nutrition(recipeAiVariantInput(recipe, variant, target), target);
  }
  return { ...recipe, caloriesInfo: data.caloriesInfo, aiScalingData: data };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateRecipeImage).mockResolvedValue(new File(["PNG"], "variant.png", { type: "image/png" }));
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:variant"); static revokeObjectURL = vi.fn(); });
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

describe("conseils de cuisson de la variante partagée", () => {
  it("conserve le conseil et les calories fraîches dans une vraie copie portable", async () => {
    const recipe = fixture(), before = JSON.stringify(recipe);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { container } = render(<RecipeReader recipe={recipe} onClose={() => {}} synchronized />);
    fireEvent.click(screen.getByRole("button", { name: "Moule 20 cm" }));
    expect(container.querySelectorAll(".steps-list .step-number")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    const link = screen.getByRole("button", { name: "Partager le lien de la recette" });
    await waitFor(() => expect(link).toBeEnabled());
    fireEvent.click(link);
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const route = readRecipeShareRoute(new URL(writeText.mock.calls[0][0]));
    expect(route?.token).toBeNull();
    const portable = await decodeRecipeShareSnapshot(route!.snapshot!, recipe.id);
    expect(portable?.steps).toEqual([...recipe.steps, "Conseil d’adaptation : Moule 20 cm : contrôler la cuisson dès 25 minutes."]);
    expect(portable?.panSize).toBe(20);
    expect(portable?.caloriesInfo?.kcal).toBe(200);
    expect(hasFreshCalories(portable!)).toBe(true);
    expect(JSON.stringify(recipe)).toBe(before);
  });

  it("transmet le conseil à l’export photo sans ajouter d’étape dans le lecteur original", async () => {
    const recipe = fixture(), before = JSON.stringify(recipe);
    const { container } = render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Moule 28 cm" }));
    const displayedIngredients = [...container.querySelectorAll(".ingredient-list li > label > span:last-child")].map(element => element.textContent);
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    fireEvent.click(screen.getByRole("button", { name: "Partager la recette en photo" }));
    await waitFor(() => expect(generateRecipeImage).toHaveBeenCalled());
    const options = vi.mocked(generateRecipeImage).mock.calls.at(-1)![0];
    expect(options.recipe.steps).toEqual([...recipe.steps, "Conseil d’adaptation : Moule 28 cm : contrôler la cuisson dès 35 minutes."]);
    expect(options.ingredients).toEqual(displayedIngredients);
    expect(options.calories).toEqual({ value: 280, unit: "portion" });
    expect(hasFreshCalories(options.recipe)).toBe(true);
    expect(container.querySelectorAll(".steps-list .step-number")).toHaveLength(1);
    expect(JSON.stringify(recipe)).toBe(before);
  });
});

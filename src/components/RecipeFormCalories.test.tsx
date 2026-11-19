import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecipeForm } from "./RecipeForm";
import { starterRecipes } from "../data/recipes";
import { analyzeRecipeAi } from "../services/recipeAiService";
import { createLocalRecipeAi } from "../services/recipeAiFallback";
import { recipeAiVariantInput, type RecipeAiData } from "../services/recipeAiTypes";
import { recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "../services/calorieAnalysis";

vi.mock("../services/recipeAiService", () => ({ analyzeRecipeAi: vi.fn() }));
const analyze = vi.mocked(analyzeRecipeAi);
function nutrition(input: AnalysisInput): CaloriesInfo {
  return { type: "plat_sale", totalKcal: 2000, cookedWeightGrams: 1000, kcal: 200, basis: "100g", estimated: true,
    assumptions: ["L’eau évaporée est estimée."], analyzedAt: "2026-11-18T12:00:00Z", model: "gemini-3.8-flash", fingerprint: recipeFingerprint(input) };
}
function result(input: AnalysisInput): RecipeAiData {
  const data = createLocalRecipeAi(input);
  data.source = "gemini"; data.model = "gemini-3.5-flash-lite";
  data.caloriesInfo = nutrition(input);
  for (const [key, variant] of Object.entries(data.servingsMap!)) variant.caloriesInfo = nutrition(recipeAiVariantInput(input, variant, Number(key)));
  return data;
}
function openLastStep() {
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
}
beforeEach(() => { analyze.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("analyse facultative dans le formulaire", () => {
  it("envoie la recette complète avec portions, puis enregistre l’estimation", async () => {
    const save = vi.fn();
    analyze.mockImplementation(async input => result(input));
    render(<RecipeForm recipe={starterRecipes[0]} onClose={() => {}} onSave={save} />);
    fireEvent.change(screen.getByLabelText("Portions de base"), { target: { value: "4" } });
    openLastStep();
    fireEvent.click(screen.getByRole("button", { name: "✨ Calculer calories & portions (IA)" }));
    await screen.findByText("~200 kcal / 100 g");
    expect(analyze).toHaveBeenCalledOnce();
    expect(analyze.mock.calls[0][0]).toMatchObject({ title: starterRecipes[0].title, ingredients: starterRecipes[0].ingredients, steps: starterRecipes[0].steps, servings: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save.mock.calls[0][0]).toMatchObject({ servings: 4, caloriesInfo: { kcal: 200, totalKcal: 2000 } });
  });
  it("ne lance pas d’appel au simple enregistrement et conserve l’enregistrement après une erreur", async () => {
    const save = vi.fn();
    analyze.mockRejectedValue(new Error("Service indisponible."));
    render(<RecipeForm recipe={starterRecipes[0]} onClose={() => {}} onSave={save} />);
    openLastStep();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(analyze).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "✨ Calculer calories & portions (IA)" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].caloriesInfo).toBeUndefined();
  });
  it("bloque les doubles requêtes et annule le travail à la fermeture", async () => {
    let resolve!: (info: RecipeAiData) => void;
    analyze.mockImplementation(() => new Promise(done => { resolve = done; }));
    const { unmount } = render(<RecipeForm recipe={starterRecipes[0]} onClose={() => {}} onSave={() => {}} />);
    openLastStep();
    const button = screen.getByRole("button", { name: "✨ Calculer calories & portions (IA)" });
    fireEvent.click(button);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(button);
    expect(analyze).toHaveBeenCalledOnce();
    const signal = analyze.mock.calls[0][1]!.signal!;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(result(analyze.mock.calls[0][0])); });
  });
  it("ignore une réponse devenue obsolète pendant une modification", async () => {
    let resolve!: (info: RecipeAiData) => void;
    analyze.mockImplementation(() => new Promise(done => { resolve = done; }));
    const save = vi.fn();
    render(<RecipeForm recipe={starterRecipes[0]} onClose={() => {}} onSave={save} />);
    openLastStep();
    fireEvent.click(screen.getByRole("button", { name: "✨ Calculer calories & portions (IA)" }));
    const input = analyze.mock.calls[0][0], signal = analyze.mock.calls[0][1]!.signal!;
    fireEvent.change(screen.getByLabelText("Étape 1"), { target: { value: "Ajouter 100 g de beurre et cuire." } });
    await waitFor(() => expect(signal.aborted).toBe(true));
    await act(async () => { resolve(result(input)); });
    expect(screen.queryByText("~200 kcal / 100 g")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save.mock.calls[0][0].caloriesInfo).toBeUndefined();
  });
});

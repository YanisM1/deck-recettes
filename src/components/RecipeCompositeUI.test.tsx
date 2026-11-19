import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecipeReader } from "./RecipeReader";
import { RecipeForm } from "./RecipeForm";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { recipeFingerprint, type CaloriesInfo } from "../services/calorieAnalysis";
const share = vi.hoisted(() => vi.fn());
vi.mock("./RecipeShareDialog", () => ({ RecipeShareDialog: (props: unknown) => { share(props); return <div>Partage prêt</div>; } }));
vi.mock("../services/geminiService", () => ({ analyzeRecipe: vi.fn() }));

function withCalories(recipe: Recipe, total: number, weight: number): Recipe {
  const cake = recipe.isCake === true;
  const caloriesInfo: CaloriesInfo = { type: cake ? "gateau" : "plat_sale", totalKcal: total, cookedWeightGrams: weight,
    kcal: Math.round(cake ? total / 8 : total / weight * 100), basis: cake ? "part" : "100g", ...(cake ? { parts: 8 as const } : {}),
    estimated: true, assumptions: ["Poids cuit estimé."], analyzedAt: "2026-11-18T12:00:00Z", model: "gemini-3.8-flash", fingerprint: recipeFingerprint(recipe) };
  return { ...recipe, caloriesInfo };
}
function fixtures() {
  const garnish = withCalories({ ...starterRecipes[1], title: "Ganache au chocolat", ingredients: ["100 g de chocolat"], steps: ["Faire fondre le chocolat."], servings: 4 }, 800, 200);
  const base = withCalories({ ...starterRecipes[0], title: "Gâteau au yaourt", ingredients: ["200 g de farine"], steps: ["Cuire le gâteau."], servings: 2, isCake: true, panSize: 26, linkedRecipeIds: [garnish.id] }, 1600, 800);
  return { base, garnish };
}
beforeEach(() => share.mockClear());
afterEach(() => vi.restoreAllMocks());
const reader = (base: Recipe, recipes: Recipe[]) => render(<RecipeReader recipe={base} availableRecipes={recipes} synchronized onClose={() => {}} />);

describe("recettes liées dans le lecteur", () => {
  it("groupe les préparations, numérote les étapes et ajuste tout l’assemblage aux portions", () => {
    const { base, garnish } = fixtures();
    const { container } = reader(base, [base, garnish]);
    expect(screen.getAllByRole("heading", { name: "Base · Gâteau au yaourt" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Ganache au chocolat" })).toHaveLength(2);
    expect(screen.getByText("~300 kcal / part")).toBeInTheDocument();
    expect([...container.querySelectorAll(".step-number")].map(element => element.textContent)).toEqual(["01", "02", "03"]);
    expect(screen.getByText("Assembler les préparations selon les indications de la recette de base.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4 personnes" }));
    expect(screen.getByText("400 g de farine")).toBeInTheDocument();
    expect(screen.getByText("200 g de chocolat")).toBeInTheDocument();
    expect(screen.getByText("~600 kcal / part")).toBeInTheDocument();
    expect(base.ingredients).toEqual(["200 g de farine"]);
    expect(garnish.ingredients).toEqual(["100 g de chocolat"]);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Plus de personnes" }));
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Nombre de personnes" })).toHaveValue(5);
  });

  it("partage une copie complète aux portions affichées, sans identifiants de liaison ni accès au carnet", () => {
    const { base, garnish } = fixtures();
    reader(base, [base, garnish]);
    fireEvent.click(screen.getByRole("button", { name: "4 personnes" }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    const props = share.mock.calls.at(-1)![0] as { recipe: Recipe; synchronized: boolean; shared: boolean };
    expect(props.synchronized).toBe(false);
    expect(props.shared).toBe(false);
    expect(props.recipe.linkedRecipeIds).toBeUndefined();
    expect(props.recipe.ingredients).toEqual(["400 g de farine", "200 g de chocolat"]);
    expect(props.recipe.steps).toHaveLength(3);
    expect(props.recipe.servings).toBe(4);
    expect(props.recipe.caloriesInfo?.kcal).toBe(600);
  });

  it("ne présente pas les calories de la base comme celles d’un assemblage incomplet", () => {
    const { base } = fixtures();
    reader(base, [base]);
    expect(screen.getByText(/Une recette liée a été supprimée/)).toBeInTheDocument();
    expect(screen.queryByText(/kcal \/ part/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Partager" })).toBeDisabled();
  });

  it("demande une nouvelle estimation si la préparation liée a changé", () => {
    const { base, garnish } = fixtures();
    reader(base, [base, { ...garnish, ingredients: ["150 g de chocolat"] }]);
    expect(screen.getByText(/Analyse à calculer ou à actualiser pour « Ganache au chocolat »/)).toBeInTheDocument();
    expect(screen.queryByText(/kcal \/ part/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Partager" })).toBeEnabled();
  });

  it("borne les portions et remet une valeur vide à la base au blur", () => {
    const { base, garnish } = fixtures();
    reader(base, [base, garnish]);
    const portions = screen.getByRole("spinbutton", { name: "Nombre de personnes" });
    fireEvent.change(portions, { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Moins de personnes" })).toBeDisabled();
    fireEvent.change(portions, { target: { value: "999" } });
    expect(screen.getByRole("button", { name: "Plus de personnes" })).toBeDisabled();
    fireEvent.change(portions, { target: { value: "" } });
    fireEvent.blur(portions);
    expect(portions).toHaveValue(2);
  });
});

describe("liaisons discrètes dans le formulaire", () => {
  it("préserve la sélection, bloque les cycles et ne propose pas la recette elle-même", () => {
    const { base, garnish } = fixtures();
    const loop: Recipe = { ...starterRecipes[2], title: "Préparation en boucle", linkedRecipeIds: [base.id] };
    const save = vi.fn();
    render(<RecipeForm recipe={base} availableRecipes={[base, garnish, loop]} onClose={() => {}} onSave={save} />);
    fireEvent.click(screen.getByText(/🔗 Lier une autre recette/));
    expect(screen.getByRole("checkbox", { name: "Ganache au chocolat" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Préparation en boucle/ })).toBeDisabled();
    expect(screen.queryByRole("checkbox", { name: "Gâteau au yaourt" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save.mock.calls[0][0].linkedRecipeIds).toEqual([garnish.id]);
  });

  it("permet de retirer une liaison dont la recette a été supprimée", () => {
    const { base } = fixtures();
    const save = vi.fn();
    render(<RecipeForm recipe={base} availableRecipes={[base]} onClose={() => {}} onSave={save} />);
    fireEvent.click(screen.getByText(/🔗 Lier une autre recette/));
    fireEvent.click(screen.getByRole("checkbox", { name: /Recette liée indisponible/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save.mock.calls[0][0].linkedRecipeIds).toEqual([]);
  });
});

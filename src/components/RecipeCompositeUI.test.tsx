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
  it("groupe les préparations, numérote les étapes et adapte tout l’assemblage au moule", () => {
    const { base, garnish } = fixtures();
    const { container } = reader(base, [base, garnish]);
    expect(screen.getAllByRole("heading", { name: "Base · Gâteau au yaourt" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Ganache au chocolat" })).toHaveLength(2);
    expect(screen.getByText("~300 kcal / part (1/8)")).toBeInTheDocument();
    expect([...container.querySelectorAll(".step-number")].map(element => element.textContent)).toEqual(["01", "02", "03"]);
    expect(screen.getByText("Assembler les préparations selon les indications de la recette de base.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Moule 20 cm" }));
    expect(screen.getByText("118,34 g de farine")).toBeInTheDocument();
    expect(screen.getByText("59,17 g de chocolat")).toBeInTheDocument();
    expect(screen.queryByText(/kcal \/ part/)).not.toBeInTheDocument();
    expect(base.ingredients).toEqual(["200 g de farine"]);
    expect(garnish.ingredients).toEqual(["100 g de chocolat"]);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Moule 28 cm" }));
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.getByRole("button", { name: "Moule 28 cm" })).toHaveAttribute("aria-pressed", "true");
  });

  it("partage une copie complète aux portions affichées, sans identifiants de liaison ni accès au carnet", () => {
    const { base, garnish } = fixtures();
    reader(base, [base, garnish]);
    fireEvent.click(screen.getByRole("button", { name: "Moule 20 cm" }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    const props = share.mock.calls.at(-1)![0] as { recipe: Recipe; synchronized: boolean; shared: boolean };
    expect(props.synchronized).toBe(false);
    expect(props.shared).toBe(false);
    expect(props.recipe.linkedRecipeIds).toBeUndefined();
    expect(props.recipe.ingredients).toEqual(["118,34 g de farine", "59,17 g de chocolat"]);
    expect(props.recipe.steps.slice(0, 3)).toEqual([base.steps[0], garnish.steps[0], "Assembler les préparations selon les indications de la recette de base."]);
    expect(props.recipe.steps.slice(3)).toHaveLength(2);
    expect(props.recipe.steps.slice(3).every(step => step.startsWith("Conseil d’adaptation :"))).toBe(true);
    expect(props.recipe.servings).toBe(2);
    expect(props.recipe.panSize).toBe(20);
    expect(props.recipe.caloriesInfo).toBeUndefined();
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

  it("réserve les trois moules aux gâteaux, même salés", () => {
    const { base, garnish } = fixtures();
    reader(base, [base, garnish]);
    expect(screen.getByRole("button", { name: "Moule 26 cm" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Moule 20 cm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moule 28 cm" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "4 personnes" })).not.toBeInTheDocument();
  });});

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

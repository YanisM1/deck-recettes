import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RecipeReader } from "./RecipeReader";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { createLocalRecipeAdaptations } from "../services/recipeAdaptation";
import { recipeAiKind } from "../services/recipeAiTypes";

const share = vi.hoisted(() => vi.fn());
vi.mock("./RecipeShareDialog", () => ({ RecipeShareDialog: (props: unknown) => { share(props); return <div>Partage prêt</div>; } }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function withHistoricalAdaptations(recipe: Recipe): Recipe {
  const data = createLocalRecipeAdaptations(recipe);
  data.source = "gemini";
  data.model = "gemini-3.5-flash-lite";
  const usesPan = recipeAiKind(recipe) === "sucre";
  const map = (usesPan ? data.panSizesMap : data.servingsMap)!;
  for (const [key, variant] of Object.entries(map)) {
    const target = Number(key);
    variant.ingredients = usesPan
      ? [target === 20 ? "1 œuf" : "2 œufs", `${target * 10} g de farine`]
      : [`${target} steaks`, "1 oignon", `${5 + target} g d’huile`];
    variant.cookingNote = usesPan
      ? `Cuisson adaptée au moule ${target} cm ; surveiller le centre.`
      : `Assaisonnement équilibré pour ${target} personnes.`;
  }
  return { ...recipe, aiScalingData: data };
}

const savory = () => withHistoricalAdaptations({
  ...starterRecipes[0], servings: 2, ingredients: ["2 steaks", "1 oignon", "10 g d’huile"],
  steps: ["Cuire les steaks et les oignons."], isCake: false, caloriesValue: 320, caloriesUnit: "per_100g",
});
const sweet = () => withHistoricalAdaptations({
  ...starterRecipes[2], isCake: true, panSize: 26, servings: 8, ingredients: ["2 œufs", "260 g de farine"],
  steps: ["Mélanger puis cuire."], category: "sucre", caloriesValue: 240, caloriesUnit: "per_serving",
});

describe("sélections de portions et de moules dans le lecteur", () => {
  it("reconnaît le moule d’un ancien gâteau salé sans indicateur explicite", () => {
    const recipe: Recipe = { ...starterRecipes[0], isCake: undefined, panSize: 20, ingredients: ["200 g de farine"], steps: ["Cuire au four."] };
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Moule 20 cm" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Moule 28 cm" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "1 personne" })).not.toBeInTheDocument();
  });

  it("montre les huit variantes salées sans réseau avec les calories manuelles sous le titre", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const recipe = savory();
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    const panel = screen.getByRole("region", { name: "Calories" });
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling).toBe(panel);
    for (let target = 1; target <= 8; target++) {
      const button = screen.getByRole("button", { name: `${target} ${target === 1 ? "personne" : "personnes"}` });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText(`${target} steaks`)).toBeInTheDocument();
      expect(screen.getByText(`${target === 2 ? 10 : 5 + target} g d’huile`)).toBeInTheDocument();
      expect(within(panel).getByText("320 kcal / 100 g")).toBeInTheDocument();
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(recipe.ingredients).toEqual(["2 steaks", "1 oignon", "10 g d’huile"]);
  });

  it("préserve les conseils de cuisson des variantes de moule et les kcal manuelles par part", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<RecipeReader recipe={sweet()} onClose={() => {}} />);
    for (const target of [20, 26, 28]) {
      fireEvent.click(screen.getByRole("button", { name: `Moule ${target} cm` }));
      expect(screen.getByText(`${target * 10} g de farine`)).toBeInTheDocument();
      expect(screen.getByText(target === 20 ? "1 œuf" : "2 œufs")).toBeInTheDocument();
      expect(screen.getByText("240 kcal / part")).toBeInTheDocument();
      if (target !== 26) expect(screen.getByText(`Cuisson adaptée au moule ${target} cm ; surveiller le centre.`)).toBeInTheDocument();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("garde les sélections et le retour utilisables sur une recette dépourvue de calories", () => {
    const onClose = vi.fn();
    const recipe = { ...starterRecipes[0], ingredients: ["3 steaks", "1 oignon"], servings: 2 };
    render(<RecipeReader recipe={recipe} onClose={onClose} />);
    expect(screen.queryByRole("region", { name: "Calories" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /calculer les calories/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1 personne" }));
    expect(screen.getByText("2 steaks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retour aux recettes" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("utilise les quantités d’origine quand le cache d’adaptation est périmé", () => {
    const recipe = savory();
    recipe.aiScalingData!.fingerprint = "v1-0000000000000000";
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "3 personnes" }));
    expect(screen.getByText("3 steaks")).toBeInTheDocument();
    expect(screen.getByText(/Goûtez et ajustez les assaisonnements/)).toBeInTheDocument();
    expect(screen.getByText("320 kcal / 100 g")).toBeInTheDocument();
  });

  it("adapte les portions d’un sucré sans moule en gardant son total manuel", () => {
    const recipe: Recipe = {
      ...starterRecipes[2], isCake: false, panSize: undefined, ingredients: ["200 g de farine"],
      servings: 2, caloriesValue: 900, caloriesUnit: "total",
    };
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Moule 26 cm" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4 personnes" }));
    expect(screen.getByText("400 g de farine")).toBeInTheDocument();
    expect(screen.getByText("900 kcal au total")).toBeInTheDocument();
    expect(screen.getByText("Valeur pour la recette d’origine.")).toBeInTheDocument();
  });

  it("adapte une ancienne recette incomplète", () => {
    const recipe = { ...starterRecipes[0], ingredients: ["200 g de farine"], steps: [] };
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    expect(screen.getByText("200 g de farine")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4 personnes" }));
    expect(screen.getByText("400 g de farine")).toBeInTheDocument();
  });

  it("partage les préparations liées et conserve seulement la saisie manuelle de la fiche", () => {
    const base = sweet();
    const garnish = withHistoricalAdaptations({ ...sweet(), id: starterRecipes[1].id, title: "Ganache", caloriesValue: 90 });
    base.linkedRecipeIds = [garnish.id];
    render(<RecipeReader recipe={base} availableRecipes={[base, garnish]} onClose={() => {}} synchronized />);
    fireEvent.click(screen.getByRole("button", { name: "Moule 20 cm" }));
    expect(screen.getAllByText("200 g de farine")).toHaveLength(2);
    expect(screen.getByText("240 kcal / part")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    const props = share.mock.calls.at(-1)![0];
    expect(props.recipe.ingredients).toEqual(["1 œuf", "200 g de farine", "1 œuf", "200 g de farine"]);
    expect(props.recipe.linkedRecipeIds).toBeUndefined();
    expect(props.recipe.aiScalingData).toBeUndefined();
    expect(props.recipe.caloriesValue).toBe(240);
    expect(props.synchronized).toBe(false);
  });
});

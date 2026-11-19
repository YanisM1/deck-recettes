import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RecipeReader } from "./RecipeReader";
import { starterRecipes } from "../data/recipes";
import type { Recipe } from "../types";
import { recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "../services/calorieAnalysis";
import { createLocalRecipeAi } from "../services/recipeAiFallback";
import { recipeAiVariantInput } from "../services/recipeAiTypes";

const share = vi.hoisted(() => vi.fn());
vi.mock("./RecipeShareDialog", () => ({ RecipeShareDialog: (props: unknown) => { share(props); return <div>Partage prêt</div>; } }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function calories(input: AnalysisInput, totalKcal = 2400, cookedWeightGrams = 1200): CaloriesInfo {
  const sweet = input.isCake || input.category === "sucre";
  return { type: sweet ? "gateau" : "plat_sale", totalKcal, cookedWeightGrams,
    kcal: Math.round(sweet ? totalKcal / 8 : totalKcal / cookedWeightGrams * 100), basis: sweet ? "part" : "100g",
    ...(sweet ? { parts: 8 as const } : {}), estimated: true, assumptions: ["Estimation de test."],
    analyzedAt: "2026-11-19T10:00:00Z", model: "gemini-3.5-flash-lite", fingerprint: recipeFingerprint(input) };
}
function cached(recipe: Recipe): Recipe {
  const data = createLocalRecipeAi(recipe);
  data.source = "gemini"; data.model = "gemini-3.5-flash-lite";
  data.caloriesInfo = calories(recipe);
  const sweet = recipe.isCake || recipe.category === "sucre";
  const map = (sweet ? data.panSizesMap : data.servingsMap)!;
  for (const [key, variant] of Object.entries(map)) {
    const target = Number(key);
    variant.ingredients = sweet ? [target === 20 ? "1 œuf" : "2 œufs", `${target * 10} g de farine`] : [`${target} steaks`, "1 oignon", `${5 + target} g d’huile`];
    variant.cookingNote = sweet ? `Cuisson adaptée au moule ${target} cm ; surveiller le centre.` : `Assaisonnement équilibré pour ${target} personnes.`;
    variant.caloriesInfo = calories(recipeAiVariantInput(recipe, variant, target), sweet ? target * 80 : target * 800, sweet ? target * 20 : target * 400);
  }
  return { ...recipe, caloriesInfo: data.caloriesInfo, aiScalingData: data };
}
const savory = () => cached({ ...starterRecipes[0], servings: 2, ingredients: ["2 steaks", "1 oignon", "10 g d’huile"], steps: ["Cuire les steaks et les oignons."], isCake: false });
const sweet = () => cached({ ...starterRecipes[2], isCake: true, panSize: 26, servings: 8, ingredients: ["2 œufs", "260 g de farine"], steps: ["Mélanger puis cuire."], category: "sucre" });

describe("sélections pré-calculées dans le lecteur", () => {
  it("reconnaît le moule d’un ancien gâteau salé sans indicateur explicite", () => {
    const recipe: Recipe = { ...starterRecipes[0], isCake: undefined, panSize: 20, ingredients: ["200 g de farine"], steps: ["Cuire au four."] };
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Moule 20 cm" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Moule 28 cm" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "1 personne" })).not.toBeInTheDocument();
  });
  it("affiche le bloc calorique sous le titre et les huit variantes salées sans réseau", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const recipe = savory();
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    const panel = screen.getByRole("region", { name: "Calories et adaptation" });
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling).toBe(panel);
    expect(within(panel).getByText("Pour 100 g du plat cuisiné final.")).toBeInTheDocument();
    for (let target = 1; target <= 8; target++) {
      fireEvent.click(screen.getByRole("button", { name: `${target} ${target === 1 ? "personne" : "personnes"}` }));
      expect(screen.getByRole("button", { name: `${target} ${target === 1 ? "personne" : "personnes"}` })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText(`${target} steaks`)).toBeInTheDocument();
      expect(screen.getByText(`${5 + target} g d’huile`)).toBeInTheDocument();
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(recipe.ingredients).toEqual(["2 steaks", "1 oignon", "10 g d’huile"]);
  });

  it("bascule les trois moules, les œufs entiers, la cuisson et les kcal par huitième sans réseau", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<RecipeReader recipe={sweet()} onClose={() => {}} />);
    for (const target of [20, 26, 28]) {
      fireEvent.click(screen.getByRole("button", { name: `Moule ${target} cm` }));
      expect(screen.getByText(`${target * 10} g de farine`)).toBeInTheDocument();
      expect(screen.getByText(target === 20 ? "1 œuf" : "2 œufs")).toBeInTheDocument();
      expect(screen.getByText(`~${target * 10} kcal / part`)).toBeInTheDocument();
      expect(screen.getByText(`Cuisson adaptée au moule ${target} cm ; surveiller le centre.`)).toBeInTheDocument();
    }
    expect(screen.getByText("Par part (coupé en 8 parts égales).")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("propose l’analyse d’une ancienne recette tout en gardant les sélections et le retour utilisables", () => {
    const onAnalyze = vi.fn(), onClose = vi.fn();
    const recipe = { ...starterRecipes[0], ingredients: ["3 steaks", "1 oignon"], servings: 2 };
    const { rerender } = render(<RecipeReader recipe={recipe} onClose={onClose} onAnalyze={onAnalyze} />);
    expect(screen.getByText("Calories à calculer pour cette préparation.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "✨ Calculer calories & portions (IA)" }));
    expect(onAnalyze).toHaveBeenCalledOnce();
    rerender(<RecipeReader recipe={recipe} onClose={onClose} onAnalyze={onAnalyze} analyzing analysisStatus="Analyse IA en cours…" />);
    expect(screen.getByRole("button", { name: "Analyse IA en cours…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "1 personne" }));
    expect(screen.getByText("2 steaks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retour aux recettes" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignore un cache périmé et ne présente pas de faux total sur une variante locale", () => {
    const recipe = savory();
    recipe.aiScalingData!.fingerprint = "v1-0000000000000000";
    recipe.caloriesInfo = undefined;
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "3 personnes" }));
    expect(screen.getByText("3 steaks")).toBeInTheDocument();
    expect(screen.queryByText(/kcal \/ 100 g/)).not.toBeInTheDocument();
    expect(screen.getByText(/Quantités locales indicatives/)).toBeInTheDocument();
  });

  it("garde lisible une ancienne recette qui dépasse les limites du format API", () => {
    const recipe = { ...starterRecipes[0], ingredients: ["200 g de farine"], steps: [] };
    render(<RecipeReader recipe={recipe} onClose={() => {}} />);
    expect(screen.getByText("200 g de farine")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4 personnes" }));
    expect(screen.getByText("400 g de farine")).toBeInTheDocument();
  });

  it("compose les variantes des préparations liées et partage une copie sans accès au carnet", () => {
    const base = sweet(), garnish = cached({ ...sweet(), id: starterRecipes[1].id, title: "Ganache", ingredients: ["2 œufs", "260 g de farine"] });
    base.linkedRecipeIds = [garnish.id];
    render(<RecipeReader recipe={base} availableRecipes={[base, garnish]} onClose={() => {}} synchronized />);
    fireEvent.click(screen.getByRole("button", { name: "Moule 20 cm" }));
    expect(screen.getAllByText("200 g de farine")).toHaveLength(2);
    expect(screen.getByText("~400 kcal / part")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    const props = share.mock.calls.at(-1)![0];
    expect(props.recipe.ingredients).toEqual(["1 œuf", "200 g de farine", "1 œuf", "200 g de farine"]);
    expect(props.recipe.linkedRecipeIds).toBeUndefined();
    expect(props.recipe.aiScalingData).toBeUndefined();
    expect(props.recipe.caloriesInfo.kcal).toBe(400);
    expect(props.synchronized).toBe(false);
  });
});

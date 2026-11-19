import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RecipeStore } from "../services/recipeStore";
import { createLocalRecipeAi } from "../services/recipeAiFallback";
import * as sync from "../services/recipeSync";
import type { Recipe } from "../types";
import { useRecipeAiActions } from "./useRecipeAiActions";
import { analyzeAndEnrichRecipe } from "../services/recipeAiEnrichment";

vi.mock("../services/recipeAiEnrichment", () => ({ analyzeAndEnrichRecipe: vi.fn().mockResolvedValue(null) }));

function Harness({ recipe, trigger }: { recipe: Recipe; trigger: { run?: (force: boolean) => Promise<void> } }) {
  const { analyze } = useRecipeAiActions();
  trigger.run = force => analyze(recipe, true, force);
  return <p role="status">ready</p>;
}
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it("force le recalcul IA même quand la recette possède déjà une analyse fraîche", async () => {
  localStorage.clear();
  const key = "b".repeat(64);
  const store = new RecipeStore(localStorage, null, key);
  const input = {
    id: crypto.randomUUID(), title: "Steak au riz", category: "sale" as const,
    ingredients: ["2 steaks", "100 g de riz"], steps: ["Cuire à la poêle."], image_url: "",
    servings: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const data = createLocalRecipeAi(input);
  data.source = "gemini";
  data.model = "gemini-3.5-flash-lite";
  if (data.caloriesInfo) data.caloriesInfo.model = data.model;
  Object.values(data.servingsMap!).forEach(variant => { if (variant.caloriesInfo) variant.caloriesInfo.model = data.model; });
  const recipe = store.save({ ...input, caloriesInfo: data.caloriesInfo, aiScalingData: data });
  vi.spyOn(sync, "getRecipeStore").mockReturnValue(store);
  const trigger: { run?: (force: boolean) => Promise<void> } = {};
  render(<Harness recipe={recipe} trigger={trigger} />);

  await act(async () => { await trigger.run!(false); });
  expect(analyzeAndEnrichRecipe).not.toHaveBeenCalled();
  await act(async () => { await trigger.run!(true); });
  expect(analyzeAndEnrichRecipe).toHaveBeenCalledOnce();
  expect(analyzeAndEnrichRecipe).toHaveBeenCalledWith(store, recipe, expect.objectContaining({ isCurrent: expect.any(Function) }));
});

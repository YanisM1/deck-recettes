import { normalizeAnalysisInput, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis";
import { getCollectionKey } from "./recipeSync";
import { createLocalRecipeAi } from "./recipeAiFallback";
import { isRecipeAiData, type RecipeAiData } from "./recipeAiTypes";

export async function analyzeRecipeAi(input: AnalysisInput & { caloriesInfo?: CaloriesInfo | null }, options: { signal?: AbortSignal; collectionKey?: string } = {}): Promise<RecipeAiData> {
  const recipe = normalizeAnalysisInput(input);
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Analyse annulée", "AbortError");
  try {
    const response = await fetch("/api/recipe-ai", { method: "POST", headers: { "Content-Type": "application/json", "x-deckchef-key": options.collectionKey ?? getCollectionKey() }, body: JSON.stringify(recipe), signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(55_000)]) });
    if (response.ok) {
      const result: unknown = await response.json();
      if (isRecipeAiData(result, recipe) && result.source === "gemini") return result;
    }
  } catch (error) {
    if (options.signal?.aborted) throw error;
  }
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Analyse annulée", "AbortError");
  return createLocalRecipeAi(input);
}

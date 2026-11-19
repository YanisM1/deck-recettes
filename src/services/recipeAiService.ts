import { normalizeAnalysisInput, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis";
import { getCollectionKey } from "./recipeSync";
import { createLocalRecipeAi } from "./recipeAiFallback";
import { isRecipeAiData, type RecipeAiData } from "./recipeAiTypes";

export async function analyzeRecipeAi(input: AnalysisInput & { caloriesInfo?: CaloriesInfo | null }, options: { signal?: AbortSignal; collectionKey?: string } = {}): Promise<RecipeAiData> {
  const recipe = normalizeAnalysisInput(input);
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Analyse annulée", "AbortError");
  let reason = "Le service de calcul n’a pas répondu.";
  try {
    const response = await fetch("/api/recipe-ai", { method: "POST", headers: { "Content-Type": "application/json", "x-deckchef-key": options.collectionKey ?? getCollectionKey() }, body: JSON.stringify(recipe), signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(55_000)]) });
    if (response.ok) {
      let result: unknown;
      try { result = await response.json(); } catch { reason = "Le service a renvoyé une réponse illisible."; }
      if (isRecipeAiData(result, recipe) && result.source === "gemini") return result;
      if (result !== undefined) reason = "Le service a renvoyé un résultat calorique invalide.";
    } else {
      let code = "";
      try { code = String((await response.json())?.code ?? ""); } catch { /* Le corps d’erreur peut être vide. */ }
      const messages: Record<string, string> = {
        NOT_CONFIGURED: "La clé Gemini du serveur n’est pas configurée.",
        UNAUTHORIZED: "Le carnet n’a pas été reconnu par le serveur.",
        INVALID_RECIPE: "Les ingrédients ou les étapes de la recette sont incomplets.",
        INVALID_RESPONSE: "Gemini n’a pas renvoyé un résultat exploitable.",
        INVALID_API_KEY: "La clé Gemini du serveur est refusée par Google.",
        MODEL_UNAVAILABLE: "Le modèle Gemini configuré et ses modèles de secours sont indisponibles.",
        UNAVAILABLE: "Le service Gemini est temporairement indisponible.",
        RATE_LIMITED: "La limite temporaire de calcul a été atteinte.",
        TIMEOUT: "Le calcul a dépassé son délai de réponse.",
      };
      reason = messages[code] ?? (response.status >= 500
        ? "Le service Gemini est temporairement indisponible."
        : `Le service de calcul a répondu avec l’erreur HTTP ${response.status}.`);
    }
  } catch (error) {
    if (options.signal?.aborted) throw error;
    reason = error instanceof Error && error.name === "TimeoutError"
      ? "Le calcul a dépassé son délai de réponse."
      : "Impossible de joindre le service Gemini (connexion hors ligne ou indisponible).";
  }
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Analyse annulée", "AbortError");
  return createLocalRecipeAi(input, { reason });
}

import { getCollectionKey } from "./recipeSync";
import { isCaloriesInfo, normalizeAnalysisInput, recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis";

export class GeminiServiceError extends Error {
  constructor(message: string, public readonly code: string) { super(message); this.name = "GeminiServiceError"; }
}
export async function analyzeRecipe(input: AnalysisInput, options: { signal?: AbortSignal } = {}): Promise<CaloriesInfo> {
  const recipe = normalizeAnalysisInput(input);
  let response: Response;
  try {
    response = await fetch("/api/analyze-recipe", {
      method: "POST", headers: { "Content-Type": "application/json", "x-deckchef-key": getCollectionKey() },
      body: JSON.stringify(recipe), signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new GeminiServiceError("L’analyse IA est indisponible hors ligne. Vous pouvez enregistrer la recette.", "NETWORK");
  }
  let body: unknown;
  try { body = await response.json(); } catch { throw new GeminiServiceError("Le service d’analyse est momentanément indisponible.", "INVALID_RESPONSE"); }
  if (!response.ok) {
    const code = body && typeof body === "object" && "code" in body ? String(body.code) : "UNAVAILABLE";
    const messages: Record<string, string> = {
      NOT_CONFIGURED: "L’analyse IA n’est pas encore configurée. Vous pouvez enregistrer la recette.",
      INVALID_RECIPE: "Vérifiez le titre, les ingrédients et les étapes avant l’analyse.",
      RATE_LIMITED: "Trop d’analyses rapprochées. Réessayez dans quelques minutes.",
      UNAUTHORIZED: "Synchronisez votre carnet avant de relancer l’analyse.",
      TIMEOUT: "L’analyse prend trop de temps. Réessayez dans un instant.",
    };
    throw new GeminiServiceError(messages[code] || "L’analyse IA est momentanément indisponible. Votre recette peut être enregistrée.", code);
  }
  if (!isCaloriesInfo(body) || !body.model.startsWith("gemini-") || body.fingerprint !== recipeFingerprint(recipe)) throw new GeminiServiceError("L’IA n’a pas renvoyé une estimation exploitable. Réessayez.", "INVALID_RESPONSE");
  return body;
}

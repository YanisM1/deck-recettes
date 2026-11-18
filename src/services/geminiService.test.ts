import { afterEach, expect, it, vi } from "vitest";
import { analyzeRecipe } from "./geminiService";
import { recipeFingerprint, type AnalysisInput } from "./calorieAnalysis";
vi.mock("./recipeSync", () => ({ getCollectionKey: () => "a".repeat(64) }));
const input: AnalysisInput = { title: "Pâtes", category: "sale", ingredients: ["200 g de pâtes"], steps: ["Cuire et égoutter."] };
const result = { type: "plat_sale", totalKcal: 800, cookedWeightGrams: 500, kcal: 160, basis: "100g", estimated: true, assumptions: [], analyzedAt: "2026-11-18T10:00:00Z", model: "gemini-3.8-flash", fingerprint: recipeFingerprint(input) };
afterEach(() => vi.unstubAllGlobals());
it("envoie les données au serveur, avec le code du carnet, sans clé Gemini", async () => {
  const network = vi.fn().mockResolvedValue(Response.json(result)); vi.stubGlobal("fetch", network);
  expect(await analyzeRecipe(input)).toEqual(result);
  expect(network).toHaveBeenCalledWith("/api/analyze-recipe", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json", "x-deckchef-key": "a".repeat(64) }, body: expect.stringContaining("Cuire et égoutter.") }));
  expect(JSON.stringify(network.mock.calls)).not.toContain("x-goog-api-key");
});
it("ne répercute jamais le texte brut d’erreur amont dans l’interface", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "NOT_CONFIGURED", error: "secret-key-value" }, { status: 503 })));
  await expect(analyzeRecipe(input)).rejects.toMatchObject({ code: "NOT_CONFIGURED", message: expect.not.stringContaining("secret-key-value") });
});
it("rejette une réponse périmée, arbitraire ou composite", async () => {
  for (const value of [{ ...result, fingerprint: recipeFingerprint({ ...input, steps: ["Frire."] }) }, { ...result, kcal: 50 }, { ...result, model: "composite-v1" }]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(value)));
    await expect(analyzeRecipe(input)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  }
});
it("préserve l’annulation et propose un repli hors ligne", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  await expect(analyzeRecipe(input)).rejects.toMatchObject({ code: "NETWORK" });
  const controller = new AbortController(); controller.abort();
  const abort = new DOMException("Aborted", "AbortError");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
  await expect(analyzeRecipe(input, { signal: controller.signal })).rejects.toBe(abort);
});

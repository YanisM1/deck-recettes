import { afterEach, expect, it, vi } from "vitest";
import { analyzeRecipeAi } from "./recipeAiService";
import { createLocalRecipeAi } from "./recipeAiFallback";
import type { AnalysisInput } from "./calorieAnalysis";
vi.mock("./recipeSync", () => ({ getCollectionKey: () => "a".repeat(64) }));
const input: AnalysisInput = { title: "Omelette", category: "sale", servings: 2, ingredients: ["2 œufs", "10 g de beurre"], steps: ["Battre puis cuire à la poêle."] };
afterEach(() => vi.unstubAllGlobals());
it("envoie un seul appel structuré au serveur avec le carnet capturé", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ code: "NOT_CONFIGURED" }, { status: 503 })); vi.stubGlobal("fetch", fetcher);
  const result = await analyzeRecipeAi(input, { collectionKey: "b".repeat(64) });
  expect(result.source).toBe("local");
  expect(result.caloriesInfo?.model).toBe("local-nutrition-v1");
  expect(result.note).toContain("clé Gemini du serveur n’est pas configurée");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith("/api/recipe-ai", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json", "x-deckchef-key": "b".repeat(64) } }));
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain("x-goog-api-key");
});
it("fonctionne hors ligne et expose la cause sans divulguer le corps d’erreur", async () => {
  const responses = [
    { run: () => Promise.reject(new TypeError("offline")), message: /hors ligne/ },
    { run: () => Promise.resolve(Response.json({ secret: "must-not-reach-ui" }, { status: 502 })), message: /indisponible/ },
    { run: () => Promise.resolve(new Response("invalid-json")), message: /illisible/ },
    { run: () => Promise.resolve(Response.json({ code: "RATE_LIMITED" }, { status: 429 })), message: /limite temporaire/ },
  ];
  for (const { run, message } of responses) {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(run));
    const result = await analyzeRecipeAi(input);
    expect(result.source).toBe("local");
    expect(result.note).toMatch(message);
    expect(result.caloriesInfo?.model).toBe("local-nutrition-v1");
    expect(result.note).not.toContain("must-not-reach-ui");
  }
});
it("préserve l’annulation, y compris avant l’envoi", async () => {
  const controller = new AbortController(), fetcher = vi.fn().mockImplementation(() => { controller.abort(); throw new DOMException("Aborted", "AbortError"); });
  vi.stubGlobal("fetch", fetcher);
  await expect(analyzeRecipeAi(input, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  fetcher.mockClear();
  await expect(analyzeRecipeAi(input, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
});

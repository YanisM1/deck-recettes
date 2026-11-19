import { describe, expect, it, vi } from "vitest";
import { buildRecipeAiPrompt, handleRecipeAi, parseGeminiJson } from "./recipeAi";
import { hasFreshCalories, normalizeAnalysisInput, type AnalysisInput } from "../src/services/calorieAnalysis";
import { isRecipeAiData, recipeAiVariantInput } from "../src/services/recipeAiTypes";
const cake: AnalysisInput = { title: "Gâteau au yaourt", category: "sucre", isCake: false, panSize: 20, ingredients: ["200 g de farine", "2 œufs"], steps: ["Mélanger puis cuire 35 minutes à 180 °C."] };
const dish: AnalysisInput = { ...cake, title: "Steak", category: "sale", panSize: undefined, ingredients: ["2 steaks", "100 g de riz"], servings: 2 };
let id = 3000;
function request(input: unknown = cake, headers: Record<string, string> = {}) {
  return new Request("https://deck-recettes.vercel.app/api/recipe-ai", { method: "POST", headers: { "content-type": "application/json", "x-deckchef-key": (++id).toString(16).padStart(64, "0"), ...headers }, body: JSON.stringify(input) });
}
function response(input: AnalysisInput = cake) {
  const sweet = input.category === "sucre" || input.isCake;
  const targets = sweet ? [20, 26, 28] : [1, 2, 3, 4, 5, 6, 7, 8];
  return { base: { totalKcal: 1600, cookedWeightGrams: 800, assumptions: ["Évaporation estimée."] }, note: "Estimation indicative.", variants: Object.fromEntries(targets.map(target => [String(target), { totalKcal: target * 80, cookedWeightGrams: target * 40, assumptions: [], ingredients: input.ingredients, cookingNote: "Surveiller la cuisson." }])) };
}
const wrap = (value: unknown) => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] });
const options = (fetcher: typeof fetch) => ({ env: {}, allowLocal: true, keyReader: async () => "test-private-server-key", fetcher });
describe("API calories et variantes en un appel", () => {
  it("nettoie les blocs Markdown et tolère un préambule sans exposer le brut", () => {
    const fence = String.fromCharCode(96).repeat(3);
    expect(parseGeminiJson(fence + "json\n{\"base\":1}\n" + fence)).toEqual({ base: 1 });
    expect(parseGeminiJson("Réponse structurée:\n{\"base\":1}")).toEqual({ base: 1 });
    expect(() => parseGeminiJson(fence + "json\ncassé\n" + fence)).toThrow();
  });
  it("choisit dans la liste du compte un modèle Flash réellement disponible", async () => {
    const network = vi.fn()
      .mockResolvedValueOnce(Response.json({ models: [{ name: "models/gemini-2.5-flash-001", supportedGenerationMethods: ["generateContent"] }] }))
      .mockResolvedValueOnce(wrap(response()));
    const result = await handleRecipeAi(request(), options(network));
    expect(result.status).toBe(200);
    expect((await result.json()).model).toBe("gemini-2.5-flash-001");
    expect(network.mock.calls[1][0]).toContain("/models/gemini-2.5-flash-001:generateContent");
  });
  it("signale une clé API refusée sans révéler le message Google", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const network = vi.fn().mockResolvedValue(Response.json({ error: { message: "API key not valid. private value" } }, { status: 400 }));
    const result = await handleRecipeAi(request(), options(network));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ code: "INVALID_API_KEY" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private value");
    expect(network).toHaveBeenCalledOnce();
  });
  it("bascule sur un modèle actif si le modèle configuré répond 404", async () => {
    const network = vi.fn()
      .mockResolvedValueOnce(Response.json({ models: [
        { name: "models/gemini-old-model", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
      ] }))
      .mockResolvedValueOnce(Response.json({ error: { message: "model not found" } }, { status: 404 }))
      .mockResolvedValueOnce(wrap(response()));
    const result = await handleRecipeAi(request(), { ...options(network), env: { GEMINI_MODEL: "gemini-old-model" } });
    expect(result.status).toBe(200);
    expect((await result.json()).model).toBe("gemini-2.5-flash");
    expect(network.mock.calls.map(call => call[0])).toEqual([
      expect.stringContaining("/models?pageSize=1000"),
      expect.stringContaining("/models/gemini-old-model:generateContent"),
      expect.stringContaining("/models/gemini-2.5-flash:generateContent"),
    ]);
  });
  it("réessaie avec le modèle de secours si Gemini répond 503", async () => {
    const network = vi.fn()
      .mockResolvedValueOnce(Response.json({ models: [
        { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
      ] }))
      .mockResolvedValueOnce(Response.json({ error: { message: "temporarily unavailable" } }, { status: 503 }))
      .mockResolvedValueOnce(wrap(response()));
    const result = await handleRecipeAi(request(), options(network));
    expect(result.status).toBe(200);
    expect((await result.json()).model).toBe("gemini-2.5-flash");
    expect(network).toHaveBeenCalledTimes(3);
  });
  it("expose seulement le statut final du fournisseur quand tous les modèles sont en panne", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const network = vi.fn()
      .mockResolvedValueOnce(Response.json({ models: [
        { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent"] },
      ] }))
      .mockResolvedValue(Response.json({ error: { message: "down" } }, { status: 503 }));
    const result = await handleRecipeAi(request(), options(network));
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ code: "PROVIDER_ERROR_503" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("down");
    expect(network).toHaveBeenCalledTimes(4);
  });
  it("distingue la limite de Google de celle appliquée au carnet DeckChef", async () => {
    const network = vi.fn()
      .mockResolvedValueOnce(Response.json({ models: [{ name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] }] }))
      .mockResolvedValueOnce(Response.json({ error: { message: "quota exceeded" } }, { status: 429 }));
    const result = await handleRecipeAi(request(), options(network));
    expect(result.status).toBe(429);
    expect(await result.json()).toEqual({ code: "GEMINI_RATE_LIMITED" });
    expect(network).toHaveBeenCalledTimes(2);
  });
  it("retourne un code explicite et ne journalise ni la clé ni le corps fournisseur", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "test-private-server-key";
    const network = vi.fn().mockResolvedValue(Response.json({ error: { message: secret + " invalid schema" } }, { status: 400 }));
    const result = await handleRecipeAi(request(), { ...options(network), keyReader: async () => secret });
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ code: "INVALID_REQUEST" });
    const serialized = JSON.stringify(log.mock.calls);
    expect(serialized).toContain("INVALID_REQUEST");
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("invalid schema");
  });
  it("renvoie les trois moules et kcal par huitième pour toute recette sucrée", async () => {
    const network = vi.fn().mockResolvedValue(wrap(response()));
    const result = await handleRecipeAi(request(), options(network));
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(isRecipeAiData(data, cake)).toBe(true);
    expect(data).toMatchObject({ source: "gemini", kind: "sucre", caloriesInfo: { kcal: 200, basis: "part", parts: 8 }, panSizesMap: { "20": { caloriesInfo: { kcal: 200 } }, "26": { caloriesInfo: { kcal: 260 } }, "28": { caloriesInfo: { kcal: 280 } } } });
    expect(network).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[0][0]).toContain("/models?pageSize=1000");
    const call = network.mock.calls[1];
    expect(call[0]).not.toContain("test-private-server-key");
    expect(call[1].headers["x-goog-api-key"]).toBe("test-private-server-key");
    const sent = JSON.parse(call[1].body);
    expect(sent.generationConfig.responseMimeType).toBe("application/json");
    expect(sent.contents[0].parts[0].text).toContain("35 minutes à 180 °C");
    expect(sent.contents[0].parts[0].text).toContain("Maillard");
    expect(sent.contents[0].parts[0].text).toContain("1,69");
    expect(hasFreshCalories({ ...recipeAiVariantInput(normalizeAnalysisInput(cake), data.panSizesMap["26"], 26), caloriesInfo: data.panSizesMap["26"].caloriesInfo })).toBe(true);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
  it("pré-calcule 1..8 personnes et pondère le plat par sa masse cuite", async () => {
    const network = vi.fn().mockResolvedValue(wrap(response(dish)));
    const result = await handleRecipeAi(request(dish), options(network));
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(isRecipeAiData(data, dish)).toBe(true);
    expect(data.caloriesInfo).toMatchObject({ basis: "100g", kcal: 200 });
    expect(Object.keys(data.servingsMap)).toHaveLength(8);
    expect(data.panSizesMap).toBeUndefined();
  });
  it.each([cake, dish])("conserve une unique estimation et les ingrédients exacts pour la variante d’origine de $title", async input => {
    const raw = response(input), sweet = input.category === "sucre" || input.isCake;
    const baseTarget = sweet ? input.panSize ?? 26 : input.servings ?? 2;
    raw.variants[String(baseTarget)] = { ...raw.variants[String(baseTarget)], ingredients: ["300 g de farine", "3 œufs"], totalKcal: 3000, cookedWeightGrams: 1000 };
    const result = await handleRecipeAi(request(input), options(vi.fn().mockResolvedValue(wrap(raw))));
    expect(result.status).toBe(200);
    const data = await result.json(), map = sweet ? data.panSizesMap : data.servingsMap;
    expect(map[String(baseTarget)].ingredients).toEqual(input.ingredients);
    expect(map[String(baseTarget)].caloriesInfo).toEqual(data.caloriesInfo);
    const another = sweet ? 28 : 3;
    expect(map[String(another)].caloriesInfo.totalKcal).toBe(raw.variants[String(another)].totalKcal);
  });
  it("garde une variante réellement rééquilibrée quand la base contient une pièce fractionnaire", async () => {
    const input = { ...dish, ingredients: ["1½ steak", "100 g de riz"] };
    const raw = response(input);
    for (const variant of Object.values(raw.variants)) variant.ingredients = ["2 steaks", "100 g de riz"];
    raw.variants["2"].totalKcal = 240;
    raw.variants["2"].cookedWeightGrams = 120;
    const result = await handleRecipeAi(request(input), options(vi.fn().mockResolvedValue(wrap(raw))));
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.servingsMap["2"].ingredients).toEqual(["2 steaks", "100 g de riz"]);
    expect(data.servingsMap["2"].caloriesInfo.totalKcal).toBe(240);
    expect(data.caloriesInfo.totalKcal).toBe(1600);
  });
  it("refuse une table incomplète, des fractions de pièces ou une nutrition invalide", async () => {
    const missing = response(dish); delete (missing.variants as Record<string, unknown>)["8"];
    const pieces = response(dish); pieces.variants["3"].ingredients = ["1,5 steak", "150 g de riz"];
    const invalid = response(); invalid.variants["26"].cookedWeightGrams = 0;
    for (const raw of [missing, pieces, invalid]) {
      const result = await handleRecipeAi(request(raw === invalid ? cake : dish), options(vi.fn().mockResolvedValue(wrap(raw))));
      expect(result.status).toBe(502);
    }
  });
  it("contrôle la clé du carnet par RLS et rejette les autres origines avant Gemini", async () => {
    const req = request(), key = req.headers.get("x-deckchef-key");
    const network = vi.fn().mockResolvedValueOnce(Response.json([{ sync_key: key }]))
      .mockResolvedValueOnce(Response.json({ models: [{ name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] }] }))
      .mockResolvedValueOnce(wrap(response()));
    const env = { VITE_SUPABASE_URL: "https://db.test", VITE_SUPABASE_ANON_KEY: "public-key", VERCEL: "1" };
    expect((await handleRecipeAi(req, { ...options(network), env })).status).toBe(200);
    expect(network.mock.calls[0][0]).toContain("/recipe_collections?");
    expect(network.mock.calls[1][0]).toContain("/models?pageSize=1000");
    const denied = vi.fn().mockResolvedValue(Response.json([]));
    expect((await handleRecipeAi(request(), { ...options(denied), env })).status).toBe(401);
    expect(denied).toHaveBeenCalledTimes(1);
    const foreign = vi.fn();
    expect((await handleRecipeAi(request(cake, { origin: "https://foreign.test" }), options(foreign))).status).toBe(403);
    expect(foreign).not.toHaveBeenCalled();
  });
  it("rejette les fractions Gemini de pièces avec adjectif sans modifier les ingrédients après calcul", async () => {
    for (const line of ["1.5 petit oignon", "0.75 avocat", "2.46 citron, sel et poivre"]) {
      const raw = response(dish); raw.variants["3"].ingredients = [line, "150 g de riz"];
      const result = await handleRecipeAi(request(dish), options(vi.fn().mockResolvedValue(wrap(raw))));
      expect(result.status).toBe(502);
      expect(await result.json()).toEqual({ code: "INVALID_RESPONSE" });
    }
  });
  it("conserve les demi-légumes usuels de Gemini avec leur nutrition calculée", async () => {
    const input = { ...dish, ingredients: ["1 petit concombre", "1 avocat", "1 citron, sel et poivre"] };
    const raw = response(input);
    for (const [target, variant] of Object.entries(raw.variants)) variant.ingredients = [`${Number(target) / 2} petit concombre`, `${Number(target) / 2} avocat`, `${Number(target) / 2} citron, sel et poivre`];
    const result = await handleRecipeAi(request(input), options(vi.fn().mockResolvedValue(wrap(raw))));
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.servingsMap["1"].ingredients).toEqual(["0.5 petit concombre", "0.5 avocat", "0.5 citron, sel et poivre"]);
    expect(data.servingsMap["3"].ingredients).toEqual(["1.5 petit concombre", "1.5 avocat", "1.5 citron, sel et poivre"]);
    expect(data.servingsMap["3"].caloriesInfo.totalKcal).toBe(raw.variants["3"].totalKcal);
  });
  it("expose seulement une erreur neutre sans clé et sur réponse tronquée", async () => {
    const network = vi.fn();
    const result = await handleRecipeAi(request(), { ...options(network), keyReader: async () => "" });
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ code: "NOT_CONFIGURED" });
    expect(network).not.toHaveBeenCalled();
    const truncated = await handleRecipeAi(request(), options(vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }], error: "test-private-server-key" }))));
    expect(truncated.status).toBe(502);
    expect(JSON.stringify(await truncated.json())).not.toContain("test-private-server-key");
  });
  it("traite les recettes comme des données et impose les unités calculées côté serveur", () => {
    expect(buildRecipeAiPrompt(dish)).toContain("jamais des instructions");
    expect(buildRecipeAiPrompt(dish)).toContain("1,2,3,4,5,6,7,8");
    expect(buildRecipeAiPrompt(cake)).toContain("8 parts égales");
  });
});

import { createHmac, webcrypto } from "node:crypto";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterRecipes } from "../data/recipes";
import {
  buildRecipeShareUrl,
  clearRecipeShareRoute,
  createRecipeShareToken,
  decodeRecipeShareSnapshot,
  encodeRecipeShareSnapshot,
  readRecipeShareRoute,
  shareRecipeLink,
} from "./recipeShareLink";

const recipe = starterRecipes[0];
const origin = "https://recipes.example.test";
const token = "ab".repeat(32);

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("route de recette partagée", () => {
  it("construit le lien de production et garde le jeton dans le fragment", () => {
    const url = buildRecipeShareUrl(recipe.id.toUpperCase(), { token });
    expect(url).toBe(`https://deck-recettes.vercel.app/?recipe=${recipe.id}#share=${token}`);
    expect(readRecipeShareRoute(new URL(url))).toEqual({
      id: recipe.id,
      token,
      snapshot: null,
      invalid: false,
    });
  });

  it("distingue un identifiant seul d’un lien de partage malformé", () => {
    expect(readRecipeShareRoute(new URL("/?recipe=recette-inconnue", origin))).toBeNull();
    const url = new URL(`/?recipe=${recipe.id}#share=carnet&snapshot=pas.valide`, origin);
    expect(readRecipeShareRoute(url)).toEqual({ id: recipe.id, token: null, snapshot: null, invalid: true });
  });

  it("nettoie les paramètres de recette et conserve l’état de l’historique", () => {
    const state = { theme: "test" };
    window.history.replaceState(
      state, "", `/?ref=app&recipe=${recipe.id}#share=${token}&snapshot=abc&ancre=lecture`,
    );
    expect(readRecipeShareRoute()?.id).toBe(recipe.id);
    clearRecipeShareRoute();
    expect(window.location.search).toBe("?ref=app");
    expect(window.location.hash).toBe("#ancre=lecture");
    expect(window.history.state).toEqual(state);
  });

  it("signe un identifiant avec une clé de carnet sans l’inclure dans le lien", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const collectionKey = "cd".repeat(32);
    const expected = createHmac("sha256", Buffer.from(collectionKey, "hex"))
      .update(`deckchef:recipe-share:v1:${recipe.id}`).digest("hex");
    const proof = await createRecipeShareToken(recipe.id.toUpperCase(), collectionKey);
    expect(proof).toBe(expected);
    expect(buildRecipeShareUrl(recipe.id, { token: proof })).not.toContain(collectionKey);
    expect(await createRecipeShareToken(starterRecipes[1].id, collectionKey)).not.toBe(proof);
    expect(await createRecipeShareToken(recipe.id, "clé invalide")).toBeNull();
  });
});

describe("recette portable", () => {
  it("reconstruit une recette UTF-8 et son moule depuis une URL sans Supabase", async () => {
    const cake = { ...recipe, title: "Gâteau d’été 🍋", isCake: true, panSize: 26 as const };
    const snapshot = await encodeRecipeShareSnapshot(cake);
    expect(snapshot).toMatch(/^[A-Za-z0-9_-]+$/);
    const url = buildRecipeShareUrl(recipe.id, { origin, snapshot });
    const route = readRecipeShareRoute(new URL(url));
    expect(route?.snapshot).toBe(snapshot);
    expect(await decodeRecipeShareSnapshot(snapshot!, recipe.id)).toEqual(cake);
    expect(await decodeRecipeShareSnapshot(snapshot!, starterRecipes[1].id)).toBeNull();
  });

  it("écarte les images non portables et les propriétés étrangères au modèle", async () => {
    const unsafe = {
      ...recipe,
      image_url: "data:image/svg+xml,<svg/>",
      sync_key: token,
    };
    const snapshot = gzipSync(JSON.stringify({ version: 1, recipe: unsafe })).toString("base64url");
    const result = await decodeRecipeShareSnapshot(snapshot, recipe.id);
    expect(result?.image_url).toBe("");
    expect(result).not.toHaveProperty("sync_key");

    const encoded = await encodeRecipeShareSnapshot(unsafe);
    const portable = await decodeRecipeShareSnapshot(encoded!, recipe.id);
    expect(portable).toEqual(result);
  });

  it("écarte un fragment corrompu ou gonflant au-delà de la limite", async () => {
    expect(await decodeRecipeShareSnapshot("pas-du-gzip", recipe.id)).toBeNull();
    const hugeRecipe = { ...recipe, steps: ["a".repeat(256 * 1024)] };
    expect(await encodeRecipeShareSnapshot(hugeRecipe)).toBeNull();
    const compressed = gzipSync(JSON.stringify({ version: 1, recipe: hugeRecipe })).toString("base64url");
    expect(await decodeRecipeShareSnapshot(compressed, recipe.id)).toBeNull();
  });
});

describe("partage natif du lien", () => {
  const url = buildRecipeShareUrl(recipe.id, { origin, token });

  it("démarre la copie et l’ouverture native dans le même geste", async () => {
    let finishWrite!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText }, share });

    const result = shareRecipeLink(recipe, url);
    expect(writeText).toHaveBeenCalledWith(url);
    expect(share).toHaveBeenCalledWith({
      title: recipe.title,
      text: `Découvre ma recette : ${recipe.title}`,
      url,
    });
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(share.mock.invocationCallOrder[0]);
    finishWrite();
    await expect(result).resolves.toEqual({ copied: true, shared: true });
  });

  it("laisse le lien copié si le partage est indisponible ou annulé", async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("navigator", { clipboard });
    await expect(shareRecipeLink(recipe, url)).resolves.toEqual({ copied: true, shared: false });
    vi.stubGlobal("navigator", {
      clipboard,
      share: vi.fn().mockRejectedValue(new DOMException("Annulé", "AbortError")),
    });
    await expect(shareRecipeLink(recipe, url)).resolves.toEqual({ copied: true, shared: false });
  });

  it("ouvre le partage même si le presse-papier refuse l’écriture", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Indisponible")) },
      share: vi.fn().mockResolvedValue(undefined),
    });
    await expect(shareRecipeLink(recipe, url)).resolves.toEqual({ copied: false, shared: true });
  });
});

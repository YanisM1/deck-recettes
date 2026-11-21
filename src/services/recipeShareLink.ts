import { starterRecipes } from "../data/recipes";
import { isPanSize, type Recipe } from "../types";
import { isRecipe } from "./recipeStore";
import { readManualCalories } from "./manualCalories";

export const RECIPE_SHARE_PRODUCTION_ORIGIN = "https://deck-recettes.vercel.app";
const RECIPE_ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const SHARE_TOKEN = /^[a-f0-9]{64}$/;
const MAX_SNAPSHOT_LENGTH = 12_000;
const MAX_SNAPSHOT_BYTES = 128 * 1024;
const STARTER_PHOTOS = new Set(starterRecipes.map((recipe) => recipe.image_url));

function validSnapshot(value: string | null): value is string {
  return (
    value !== null &&
    value.length <= MAX_SNAPSHOT_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function readRecipeShareRoute(url = new URL(window.location.href)) {
  const id = url.searchParams.get("recipe")?.toLowerCase();
  if (!id || !RECIPE_ID.test(id)) return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const rawToken = fragment.get("share");
  const rawSnapshot = fragment.get("snapshot");
  const token = rawToken && SHARE_TOKEN.test(rawToken) ? rawToken : null;
  const snapshot = validSnapshot(rawSnapshot) ? rawSnapshot : null;
  return {
    id,
    token,
    snapshot,
    invalid: !token && !snapshot && (fragment.has("share") || fragment.has("snapshot")),
  };
}

export function clearRecipeShareRoute() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("recipe")) return;
  url.searchParams.delete("recipe");
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.has("share") || fragment.has("snapshot")) {
    fragment.delete("share");
    fragment.delete("snapshot");
    url.hash = fragment.toString();
  }
  window.history.replaceState(window.history.state, "", url);
}

export function buildRecipeShareUrl(
  recipeId: string,
  options: { token?: string | null; snapshot?: string | null; origin?: string } = {},
) {
  const url = new URL("/", options.origin ?? RECIPE_SHARE_PRODUCTION_ORIGIN);
  url.searchParams.set("recipe", recipeId.toLowerCase());
  const fragment = new URLSearchParams();
  if (options.token) fragment.set("share", options.token);
  if (options.snapshot) fragment.set("snapshot", options.snapshot);
  url.hash = fragment.toString();
  return url.href;
}

export async function createRecipeShareToken(recipeId: string, collectionKey: string) {
  const id = recipeId.toLowerCase();
  if (!RECIPE_ID.test(id) || !SHARE_TOKEN.test(collectionKey) || !crypto.subtle)
    return null;
  const bytes = Uint8Array.from(
    collectionKey.match(/../g)!,
    (pair) => Number.parseInt(pair, 16),
  );
  try {
    const key = await crypto.subtle.importKey(
      "raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(`deckchef:recipe-share:v1:${id}`),
    );
    return Array.from(new Uint8Array(signature), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return null;
  }
}

function safeSnapshotPhoto(value: string) {
  if (STARTER_PHOTOS.has(value) || /^\/recipes\/[a-z0-9-]+\.webp$/.test(value)) return value;
  if (!value.startsWith("https://")) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

function snapshotRecipe(recipe: Recipe): Recipe {
  const panSize = recipe.isCake !== false && isPanSize(recipe.panSize)
    ? recipe.panSize
    : undefined;
  const portable: Recipe = {
    id: recipe.id.toLowerCase(),
    title: recipe.title,
    category: recipe.category,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    image_url: safeSnapshotPhoto(recipe.image_url),
    created_at: recipe.created_at,
    updated_at: recipe.updated_at,
    isCake: panSize ? true : recipe.isCake,
    panSize,
    ...(Number.isSafeInteger(recipe.servings) && recipe.servings! >= 1 && recipe.servings! <= 999 ? { servings: recipe.servings } : {}),
  };
  Object.assign(portable, readManualCalories(recipe.caloriesValue, recipe.caloriesUnit));
  return portable;
}

async function transformBytes(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
  maxBytes: number,
) {
  const input = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = input.pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function encodeRecipeShareSnapshot(recipe: Recipe) {
  if (!RECIPE_ID.test(recipe.id.toLowerCase()) || typeof CompressionStream !== "function")
    return null;
  try {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ version: 1, recipe: snapshotRecipe(recipe) }),
    );
    if (bytes.length > MAX_SNAPSHOT_BYTES) return null;
    const compressed = await transformBytes(
      bytes, new CompressionStream("gzip"), (MAX_SNAPSHOT_LENGTH * 3) / 4,
    );
    if (!compressed) return null;
    return btoa(String.fromCharCode(...compressed))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return null;
  }
}

export async function decodeRecipeShareSnapshot(snapshot: string, recipeId: string) {
  if (!validSnapshot(snapshot) || typeof DecompressionStream !== "function")
    return null;
  try {
    const binary = atob(snapshot.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const output = await transformBytes(
      bytes, new DecompressionStream("gzip"), MAX_SNAPSHOT_BYTES,
    );
    if (!output) return null;
    const decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output));
    if (
      decoded?.version !== 1 ||
      !isRecipe(decoded.recipe) ||
      decoded.recipe.id !== recipeId.toLowerCase()
    ) return null;
    return snapshotRecipe(decoded.recipe);
  } catch {
    return null;
  }
}

async function copyRecipeUrl(url: string) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

async function openRecipeShareSheet(title: string, url: string) {
  try {
    if (!navigator.share) return false;
    await navigator.share({ title, text: `Découvre ma recette : ${title}`, url });
    return true;
  } catch {
    return false;
  }
}

export async function shareRecipeLink(recipe: Pick<Recipe, "title">, shareUrl: string) {
  // Les deux appels partent du même geste. Le partage consomme son activation.
  const [copied, shared] = await Promise.all([
    copyRecipeUrl(shareUrl),
    openRecipeShareSheet(recipe.title, shareUrl),
  ]);
  return { copied, shared };
}

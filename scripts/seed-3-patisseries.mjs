import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const recipes = JSON.parse(await readFile(new URL("./seed-3-patisseries.json", import.meta.url), "utf8"));
const optionalRecipeFields = ["servings", "calories_value", "calories_unit"];
const titles = recipes.map(({ title }) => JSON.stringify(title)).join(",");
const recipeQuery = {
  select: ["id", "title", "category", "is_cake", "pan_size", "ingredients", "steps", "image_url", ...optionalRecipeFields].join(","),
  title: `in.(${titles})`,
};

async function readConfig() {
  let file = {};
  try {
    file = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("Lecture de .env.local impossible.");
  }

  const { DECKCHEF_SEED_COLLECTION_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = {
    ...file,
    ...process.env,
  };
  return {
    origin: VITE_SUPABASE_URL,
    apiKey: VITE_SUPABASE_ANON_KEY,
    collectionKey: DECKCHEF_SEED_COLLECTION_KEY,
  };
}

function verifyConfig({ origin, apiKey, collectionKey }) {
  if (!/^[a-f0-9]{64}$/.test(collectionKey ?? "")) {
    throw new Error("Indiquez le code privé du carnet cible via DECKCHEF_SEED_COLLECTION_KEY dans .env.local ou dans l’environnement du processus.");
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(origin ?? "")) {
    throw new Error("VITE_SUPABASE_URL doit désigner un projet Supabase hébergé en HTTPS.");
  }
  if (!apiKey) throw new Error("VITE_SUPABASE_ANON_KEY est nécessaire.");
  if (apiKey.startsWith("sb_publishable_")) return { apikey: apiKey };

  // Require the public anon role so the cookbook remains protected by RLS.
  let role;
  try {
    role = JSON.parse(Buffer.from(apiKey.split(".")[1], "base64url").toString("utf8")).role;
  } catch {
    // Reject unknown API key formats without exposing the value.
  }
  if (role !== "anon") throw new Error("Utilisez uniquement une clé Supabase publique (anon ou publishable).");
  return { apikey: apiKey, Authorization: `Bearer ${apiKey}` };
}

function verifyContent(row, expected) {
  const exactContent = row.title === expected.title &&
    row.category === expected.category && row.is_cake === expected.is_cake &&
    row.pan_size === expected.pan_size &&
    JSON.stringify(row.ingredients) === JSON.stringify(expected.ingredients) &&
    JSON.stringify(row.steps) === JSON.stringify(expected.steps) &&
    optionalRecipeFields.every((field) => !Object.hasOwn(expected, field) || row[field] === expected[field]);
  if (!exactContent) throw new Error(`Le titre « ${expected.title} » existe avec un contenu différent. La recette existante est préservée.`);
}

export async function seedPastries(config, { verifyOnly = false, preflight = false, fetcher = fetch } = {}) {
  const publicHeaders = verifyConfig(config);
  const { origin, collectionKey } = config;

  async function request(path, { query, headers, method = "GET", body } = {}) {
    const url = new URL(path, origin);
    if (query) url.search = new URLSearchParams(query);
    let response;
    try {
      response = await fetcher(url, {
        method,
        headers: { ...publicHeaders, ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error(`Connexion Supabase impossible (${method} ${path}).`);
    }
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      if (details?.code === "23514" && details.message?.includes("deckchef_calories_display_valid")) {
        throw new Error("Supabase refuse les unités manuelles. Appliquez d’abord la migration DeckChef des calories.");
      }
      const code = typeof details?.code === "string" && /^[A-Z0-9]+$/.test(details.code) ? ` ${details.code}` : "";
      throw new Error(`Supabase a renvoyé HTTP ${response.status}${code} (${method} ${path}).`);
    }
    return response;
  }

  async function restRows(table, options) {
    const response = await request(`/rest/v1/${table}`, {
      ...options,
      headers: { "x-deckchef-key": collectionKey, ...options.headers },
    });
    const data = await response.json().catch(() => null);
    if (!Array.isArray(data)) throw new Error(`Réponse de lecture inattendue pour ${table}.`);
    return data;
  }

  const collection = await restRows("recipe_collections", { query: { select: "sync_key", limit: "2" } });
  if (collection.length !== 1 || collection[0].sync_key !== collectionKey) {
    throw new Error("Le code ne correspond pas à un carnet DeckChef existant dans ce projet Supabase.");
  }

  function matchRows(rows, requireAll = false) {
    return recipes.map((recipe) => {
      const matching = rows.filter(({ title }) => title === recipe.title);
      if (matching.length > 1) throw new Error(`Plusieurs recettes portent déjà le titre « ${recipe.title} » dans ce carnet.`);
      if (requireAll && !matching.length) throw new Error(`La recette « ${recipe.title} » est absente du carnet après relecture.`);
      if (matching.length) verifyContent(matching[0], recipe);
      return matching[0];
    });
  }

  const before = matchRows(await restRows("recipes", { query: recipeQuery }), verifyOnly);
  const missing = recipes.filter((_, index) => !before[index]);
  const shouldInsert = !preflight && !verifyOnly && missing.length > 0;
  const inserted = shouldInsert ? await restRows("recipes", {
    query: { on_conflict: "sync_key,id", select: "id" },
    method: "POST",
    // These recipes have fixed UUIDs. Simultaneous runs cannot insert both copies.
    // A conflict never updates an existing record.
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: missing.map((recipe) => ({
      servings: 2,
      calories_value: null,
      calories_unit: null,
      ...recipe,
      sync_key: collectionKey,
    })),
  }) : [];
  const after = shouldInsert ? matchRows(await restRows("recipes", { query: recipeQuery }), true) : before;
  const insertedIds = new Set(inserted.map(({ id }) => id));
  const verifiedRecipes = after.map((row, index) => {
    const recipe = recipes[index];
    if (!row) return { title: recipe.title, status: "absente" };

    const added = insertedIds.has(row.id);
    if (added && recipe.image_url !== row.image_url) {
      throw new Error(`La photo n’a pas été enregistrée pour « ${recipe.title} ».`);
    }
    const verifiedMetadata = Object.fromEntries(
      optionalRecipeFields.filter((field) => Object.hasOwn(recipe, field)).map((field) => [field, row[field]]),
    );
    return {
      title: row.title,
      status: added ? "insérée" : "déjà présente",
      ingredients: row.ingredients.length,
      steps: row.steps.length,
      ...verifiedMetadata,
    };
  });

  let realtime = "non nécessaire";
  if (insertedIds.size) {
    try {
      const topic = `deckchef-${createHash("sha256").update(collectionKey).digest("hex")}`;
      await request("/realtime/v1/api/broadcast", {
        method: "POST",
        body: { messages: [{ topic, event: "changed", payload: {}, private: false }] },
      });
      realtime = "invalidation envoyée";
    } catch {
      realtime = "invalidation indisponible, les recettes restent consultables au prochain rafraîchissement";
    }
  }
  return { verifiedRecipes, realtime };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const mode = process.argv[2];
    if (process.argv.length !== 3 || !["--apply", "--verify-only", "--preflight"].includes(mode)) {
      throw new Error("Usage\n  node scripts/seed-3-patisseries.mjs --apply | --verify-only | --preflight");
    }
    const result = await seedPastries(await readConfig(), {
      verifyOnly: mode === "--verify-only",
      preflight: mode === "--preflight",
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

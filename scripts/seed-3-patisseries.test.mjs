import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { seedPastries } from "./seed-3-patisseries.mjs";

const recipes = JSON.parse(await readFile(new URL("./seed-3-patisseries.json", import.meta.url)));
const savoryRecipe = recipes.find(({ category }) => category === "sale");
const config = {
  origin: "https://supabase-recipe.84.235.237.224.sslip.io",
  apiKey: "sb_publishable_test",
  collectionKey: "a".repeat(64),
};

function stubSupabase({ initialRows = [], collectionExists = true } = {}) {
  const rows = [...initialRows];
  let posts = 0;
  let invalidations = 0;
  const fetcher = async (url, { method, headers, body, redirect }) => {
    assert.equal(url.origin, config.origin);
    assert.equal(redirect, "error");
    assert.equal(headers.apikey, config.apiKey);
    assert(!url.search.includes(config.collectionKey));

    if (url.pathname === "/realtime/v1/api/broadcast") {
      assert(!headers["x-deckchef-key"]);
      assert.equal(method, "POST");
      const { messages: [message] } = JSON.parse(body);
      assert.deepEqual(message.payload, {});
      assert.equal(message.event, "changed");
      assert.match(message.topic, /^deckchef-[a-f0-9]{64}$/);
      invalidations++;
      return new Response(null, { status: 202 });
    }

    assert.equal(headers["x-deckchef-key"], config.collectionKey);
    if (url.pathname === "/rest/v1/recipe_collections") {
      assert.equal(method, "GET");
      return Response.json(collectionExists ? [{ sync_key: config.collectionKey }] : []);
    }

    assert.equal(url.pathname, "/rest/v1/recipes");
    if (method === "POST") {
      posts++;
      assert.equal(url.searchParams.get("on_conflict"), "sync_key,id");
      assert.match(headers.Prefer, /resolution=ignore-duplicates/);
      const added = [];
      const payload = JSON.parse(body);
      const columns = Object.keys(payload[0]).sort();
      for (const row of payload) {
        assert.deepEqual(Object.keys(row).sort(), columns);
        const { sync_key, ...recipe } = row;
        assert.equal(sync_key, config.collectionKey);
        if (!rows.some(({ id }) => id === recipe.id)) {
          rows.push(recipe);
          added.push({ id: recipe.id });
        }
      }
      return Response.json(added);
    }
    assert.equal(method, "GET");
    assert.equal(url.searchParams.get("title"), `in.(${recipes.map(({ title }) => JSON.stringify(title)).join(",")})`);
    const columns = url.searchParams.get("select").split(",");
    return Response.json(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))));
  };
  return { rows, fetcher, postCount: () => posts, invalidationCount: () => invalidations };
}

test("seeds exact content, verifies readback and remains idempotent", async () => {
  assert.ok(savoryRecipe);
  const mock = stubSupabase();
  const first = await seedPastries(config, mock);
  assert.deepEqual(mock.rows, recipes.map((recipe) => ({
    servings: 2,
    calories_value: null,
    calories_unit: null,
    ...recipe,
  })));
  assert.deepEqual(first.verifiedRecipes.map(({ status }) => status), recipes.map(() => "insérée"));
  assert.deepEqual(first.verifiedRecipes.find(({ title }) => title === savoryRecipe.title), {
    title: savoryRecipe.title,
    status: "insérée",
    ingredients: savoryRecipe.ingredients.length,
    steps: savoryRecipe.steps.length,
    servings: 2,
    calories_value: 975,
    calories_unit: "total",
  });
  assert.equal(mock.invalidationCount(), 1);

  // Match a historical title with a different ID, photo and optional metadata.
  const existing = {
    ...mock.rows[0],
    id: "350ee340-f672-4a75-94ac-f29f68f357e8",
    image_url: "/photos/changed.jpg",
    servings: 4,
    calories_value: 500,
    calories_unit: "per_serving",
  };
  mock.rows[0] = existing;
  const second = await seedPastries(config, mock);
  assert.deepEqual(second.verifiedRecipes.map(({ status }) => status), recipes.map(() => "déjà présente"));
  assert.deepEqual(mock.rows[0], existing);
  assert.equal(mock.postCount(), 1);
  assert.equal(mock.invalidationCount(), 1);
});

test("preflight reports missing titles and verifies matches without writing or broadcasting", async () => {
  const mock = stubSupabase({ initialRows: [recipes[0], savoryRecipe] });
  const { verifiedRecipes, realtime } = await seedPastries(config, { ...mock, preflight: true });
  assert.deepEqual(verifiedRecipes.map(({ title, status }) => [title, status]), recipes.map(({ title }) => [
    title,
    [recipes[0].title, savoryRecipe.title].includes(title) ? "déjà présente" : "absente",
  ]));
  assert.equal(realtime, "non nécessaire");
  assert.equal(mock.postCount(), 0);
  assert.equal(mock.invalidationCount(), 0);
});

test("a local dry verification, unknown key or existing title conflict never writes", async () => {
  const empty = stubSupabase();
  await assert.rejects(seedPastries(config, { ...empty, verifyOnly: true }), /absente/);
  assert.equal(empty.postCount(), 0);

  const unknown = stubSupabase({ collectionExists: false });
  await assert.rejects(seedPastries(config, { ...unknown, preflight: true }), /carnet DeckChef existant/);
  assert.equal(unknown.postCount(), 0);

  const conflict = stubSupabase({ initialRows: [{ ...recipes[0], ingredients: ["Autre contenu"] }] });
  await assert.rejects(seedPastries(config, conflict), /contenu différent/);
  assert.equal(conflict.postCount(), 0);
});

test("conflicting portions or calorie values are reported without overwriting", async () => {
  for (const metadata of [{ servings: 3 }, { calories_value: 900 }, { calories_unit: "per_serving" }]) {
    const mock = stubSupabase({ initialRows: [{ ...savoryRecipe, ...metadata }] });
    await assert.rejects(seedPastries(config, { ...mock, preflight: true }), /contenu différent/);
    assert.equal(mock.postCount(), 0);
    assert.equal(mock.invalidationCount(), 0);
  }
});

test("requires an explicit cookbook key and a Supabase public API key", async () => {
  const noNetwork = { fetcher() { throw new Error("Unexpected network request"); } };
  await assert.rejects(seedPastries({ ...config, collectionKey: undefined }, noNetwork), /DECKCHEF_SEED_COLLECTION_KEY/);
  await assert.rejects(seedPastries({ ...config, apiKey: "sb_secret_test" }, noNetwork), /clé Supabase publique/);
});

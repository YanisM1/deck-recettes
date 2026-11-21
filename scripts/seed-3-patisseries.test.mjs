import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { seedPastries } from "./seed-3-patisseries.mjs";

const recipes = JSON.parse(await readFile(new URL("./seed-3-patisseries.json", import.meta.url)));
const config = {
  origin: "https://test-project.supabase.co",
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
      for (const { sync_key, ...recipe } of JSON.parse(body)) {
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
    return Response.json(rows);
  };
  return { rows, fetcher, postCount: () => posts, invalidationCount: () => invalidations };
}

test("seeds exact content, verifies readback and remains idempotent", async () => {
  const mock = stubSupabase();
  const first = await seedPastries(config, mock);
  assert.deepEqual(mock.rows, recipes);
  assert.deepEqual(first.verifiedRecipes.map(({ status }) => status), ["insérée", "insérée", "insérée"]);
  assert.equal(mock.invalidationCount(), 1);

  // A changed photo on an existing recipe must be preserved.
  mock.rows[0].image_url = "/photos/changed.jpg";
  const second = await seedPastries(config, mock);
  assert.deepEqual(second.verifiedRecipes.map(({ status }) => status), ["déjà présente", "déjà présente", "déjà présente"]);
  assert.equal(mock.rows[0].image_url, "/photos/changed.jpg");
  assert.equal(mock.postCount(), 1);
  assert.equal(mock.invalidationCount(), 1);
});

test("a local dry verification, unknown key or existing title conflict never writes", async () => {
  const empty = stubSupabase();
  await assert.rejects(seedPastries(config, { ...empty, verifyOnly: true }), /absente/);
  assert.equal(empty.postCount(), 0);

  const unknown = stubSupabase({ collectionExists: false });
  await assert.rejects(seedPastries(config, unknown), /carnet DeckChef existant/);
  assert.equal(unknown.postCount(), 0);

  const conflict = stubSupabase({ initialRows: [{ ...recipes[0], ingredients: ["Autre contenu"] }] });
  await assert.rejects(seedPastries(config, conflict), /contenu différent/);
  assert.equal(conflict.postCount(), 0);
});

test("requires an explicit cookbook key and a Supabase public API key", async () => {
  const noNetwork = { fetcher() { throw new Error("Unexpected network request"); } };
  await assert.rejects(seedPastries({ ...config, collectionKey: undefined }, noNetwork), /DECKCHEF_SEED_COLLECTION_KEY/);
  await assert.rejects(seedPastries({ ...config, apiKey: "sb_secret_test" }, noNetwork), /clé Supabase publique/);
});

import { expect, it, vi } from "vitest";
import { createGlobalRecipeReader } from "./globalRecipeRead";
import { ORACLE_SUPABASE_ORIGIN } from "./oracleConfig";

const legacy = {
  id: "c9201369-142e-49f9-b737-6a081b82134e",
  title: "Blanquette de veau sans farine",
  category: "sale",
  ingredients: ["500 g de veau"],
  steps: ["Laisser mijoter."],
  image_url: "data:image/jpeg;base64,photo",
  created_at: "2026-11-21T11:00:00Z",
  updated_at: "2026-11-21T12:00:00Z",
  is_cake: false,
  pan_size: null,
  servings: 2,
  linked_recipe_ids: [],
  calories_value: 975,
  calories_unit: "total",
};

it("lit les recettes importées, sans code et sans cache HTTP", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json([legacy, { ...legacy, id: "sans-photo", image_url: null }]),
  );
  const reader = createGlobalRecipeReader(ORACLE_SUPABASE_ORIGIN, "sb_publishable_test", fetcher)!;
  const rows = await reader.all();
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    id: legacy.id, title: legacy.title, category: legacy.category,
    ingredients: legacy.ingredients, steps: legacy.steps, image_url: legacy.image_url,
    created_at: legacy.created_at, updated_at: legacy.updated_at,
    panSize: undefined, servings: 2, caloriesValue: 975, caloriesUnit: "total",
  });
  expect(rows[1].image_url).toBe("");
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toContain("/rest/v1/recipes_global?");
  expect(String(url)).not.toMatch(/sync_key|notebook|carnet/);
  expect(options).toMatchObject({
    headers: { apikey: "sb_publishable_test", Accept: "application/json" },
    cache: "no-store", redirect: "error",
  });
  expect(Object.keys(options!.headers!).sort()).toEqual(["Accept", "apikey"]);
});

it("charge une recette liée par identifiant seul", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([legacy]));
  const reader = createGlobalRecipeReader(ORACLE_SUPABASE_ORIGIN, "sb_publishable_test", fetcher)!;
  expect((await reader.one(legacy.id))?.id).toBe(legacy.id);
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("id")).toBe("eq." + legacy.id);
});

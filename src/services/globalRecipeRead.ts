import { fromRecipeRow } from "./recipeFields";
import { oracleSupabaseUrl } from "./oracleConfig";
import type { Recipe } from "../types";

const columns = "id,title,category,ingredients,steps,image_url,created_at,updated_at,is_cake,pan_size,servings,linked_recipe_ids,calories_value,calories_unit,ai_scaling_data";
const PAGE_SIZE = 200;

export function createGlobalRecipeReader(
  configuredUrl: string | undefined,
  apiKey: string | undefined,
  request: typeof fetch = fetch,
) {
  const origin = oracleSupabaseUrl(configuredUrl);
  if (!origin || !apiKey) return null;
  const headers: Record<string, string> = { apikey: apiKey, Accept: "application/json" };
  if (!apiKey.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + apiKey;

  async function fetchPage(offset: number, signal: AbortSignal, id?: string): Promise<Recipe[]> {
    const url = new URL("/rest/v1/recipes_global", origin);
    url.searchParams.set("select", columns);
    url.searchParams.set("order", "created_at.asc,id.asc");
    url.searchParams.set("limit", id ? "1" : String(PAGE_SIZE));
    if (id) url.searchParams.set("id", "eq." + id);
    else url.searchParams.set("offset", String(offset));

    const response = await request(url, { headers, signal, cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error("Lecture du livre de recettes indisponible.");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Réponse du livre de recettes invalide.");

    return rows.map((row) => fromRecipeRow(
      row && typeof row === "object" && row.image_url == null
        ? { ...row, image_url: "" }
        : row,
    ));
  }

  return {
    async all(signal: AbortSignal = AbortSignal.timeout(15_000)) {
      const recipes: Recipe[] = [];
      const ids = new Set<string>();
      let offset = 0;
      for (;;) {
        const page = await fetchPage(offset, signal);
        for (const recipe of page) {
          if (ids.has(recipe.id)) throw new Error("Le livre a changé pendant sa lecture. Réessayez.");
          ids.add(recipe.id);
          recipes.push(recipe);
        }
        if (page.length < PAGE_SIZE) return recipes;
        offset += page.length;
      }
    },
    async one(id: string, signal: AbortSignal = AbortSignal.timeout(8_000)) {
      return (await fetchPage(0, signal, id))[0] ?? null;
    },
  };
}

import { ORACLE_APP_ORIGIN, oracleSupabaseUrl } from "../src/services/oracleConfig.js";

const headers = {
  "Cache-Control": "private, no-store",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });
export async function GET(_request: Request): Promise<Response> {
  const url = oracleSupabaseUrl(process.env.VITE_SUPABASE_URL),
    apiKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !apiKey)
    return json({ error: "Synchronisation non configurée." }, 503);
  const origin = ORACLE_APP_ORIGIN;
  try {
    const requestHeaders = new Headers({ apikey: apiKey, Prefer: "count=exact" });
    if (!apiKey.startsWith("sb_publishable_")) requestHeaders.set("Authorization", "Bearer " + apiKey);
    const options = {
      headers: requestHeaders,
      signal: AbortSignal.timeout(8000),
      cache: "no-store" as RequestCache,
      redirect: "error" as RequestRedirect,
    };
    const countResponse = await fetch(
      `${url}/rest/v1/recipes_global?select=id&limit=1`,
      options,
    );
    if (!countResponse.ok) throw Error("Database unavailable");
    const total = Number(
      countResponse.headers.get("content-range")?.split("/")[1] || 0,
    );
    if (!Number.isSafeInteger(total) || total < 0) throw Error("Invalid count");
    if (!total)
      return json({
        total: 0,
        recipe: null,
        app_url: origin,
        generated_at: new Date().toISOString(),
      });
    const offset = Math.floor(Date.now() / 86400000) % total;
    const response = await fetch(
      `${url}/rest/v1/recipes_global?select=id,title,category,image_url,ingredients,steps&order=created_at.asc,id.asc&limit=1&offset=${offset}`,
      options,
    );
    if (!response.ok) throw Error("Database unavailable");
    const rows = await response.json(),
      row = rows[0];
    if (!row || typeof row.id !== "string" || typeof row.title !== "string")
      throw Error("Invalid recipe");
    return json({
      total,
      recipe: {
        id: row.id,
        title: row.title,
        category: row.category,
        image_url: row.image_url || "",
        ingredients_count: Array.isArray(row.ingredients)
          ? row.ingredients.length
          : 0,
        steps_count: Array.isArray(row.steps) ? row.steps.length : 0,
      },
      app_url: `${origin}/?recipe=${encodeURIComponent(row.id)}`,
      generated_at: new Date().toISOString(),
    });
  } catch {
    return json({ error: "Le carnet est temporairement indisponible." }, 502);
  }
}

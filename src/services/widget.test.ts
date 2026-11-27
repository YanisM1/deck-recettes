import { afterEach, it, expect, vi } from "vitest";
import { GET } from "../../api/widget-status";
import { buildWidgetScript } from "./widgetScript";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("fonctionne sans configuration en retournant une erreur explicite", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  expect(
    (
      await GET(new Request("https://example.test"))
    ).status,
  ).toBe(503);
});
it("lit le livre global sans code et interdit le cache partagé", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase-recipe.84.235.237.224.sslip.io");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-test");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response('[{"id":"one"}]', { headers: { "content-range": "0-0/1" } }),
    )
    .mockResolvedValueOnce(
      Response.json([
        {
          id: "one",
          title: "Soupe",
          category: "sale",
          image_url: "",
          ingredients: ["eau"],
          steps: ["cuire"],
        },
      ]),
    );
  vi.stubGlobal("fetch", fetcher);
  const result = await GET(new Request("https://example.test"));
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  const payload = await result.json();
  expect(payload.recipe.title).toBe("Soupe");
  expect(payload.app_url).toBe("https://recipe.84.235.237.224.sslip.io/?recipe=one");
  for (const [url, request] of fetcher.mock.calls) {
    expect(new URL(url).pathname).toBe("/rest/v1/recipes_global");
    expect(request.headers.has("x-deckchef-key")).toBe(false);
  }
});
it("produit un script public avec un accès direct de secours", () => {
  const script = buildWidgetScript(
    "https://deckchef.test",
    "a".repeat(64),
    "https://db.test",
    "public",
  );
  expect(script).toContain("/api/widget-status");
  expect(script).toContain("Script.setWidget(widget)");
  expect(script).toContain("/rest/v1/recipes_global");
  expect(script).not.toContain("a".repeat(64));
  expect(script).not.toContain("x-deckchef-key");
  expect(script).not.toContain("undefined");
});

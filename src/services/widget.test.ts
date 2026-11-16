import { afterEach, it, expect, vi } from "vitest";
import { GET } from "../../api/widget-status";
import { buildWidgetScript } from "./widgetScript";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("refuse un widget sans code privé", async () =>
  expect(
    (await GET(new Request("https://example.test/api/widget-status"))).status,
  ).toBe(401));
it("fonctionne sans configuration en retournant une erreur explicite", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  expect(
    (
      await GET(
        new Request("https://example.test", {
          headers: { "x-deckchef-key": "a".repeat(64) },
        }),
      )
    ).status,
  ).toBe(503);
});
it("lit uniquement le carnet demandé et interdit le cache partagé", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
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
  const result = await GET(
    new Request("https://example.test", {
      headers: { "x-deckchef-key": "a".repeat(64) },
    }),
  );
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect((await result.json()).recipe.title).toBe("Soupe");
  expect(fetcher.mock.calls[0][1].headers["x-deckchef-key"]).toBe(
    "a".repeat(64),
  );
});
it("produit un script personnel avec un accès direct de secours", () => {
  const script = buildWidgetScript(
    "https://deckchef.test",
    "a".repeat(64),
    "https://db.test",
    "public",
  );
  expect(script).toContain("/api/widget-status");
  expect(script).toContain("Script.setWidget(widget)");
  expect(script).toContain("/rest/v1/recipes");
  expect(script).not.toContain("undefined");
});

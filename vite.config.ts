import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import { handleAnalyzeRecipe } from "./server/gemini.js";
import { handleRecipeAi } from "./server/recipeAi.js";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
function localAnalysis(mode: string): Plugin {
  return {
    name: "deckchef-local-analysis",
    configureServer(server) {
      const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
      for (const [path, handler] of [["/api/analyze-recipe", handleAnalyzeRecipe], ["/api/recipe-ai", handleRecipeAi]] as const) server.middlewares.use(path, async (req, res) => {
        try {
          const chunks: Buffer[] = []; let bytes = 0;
          for await (const chunk of req) {
            bytes += Buffer.byteLength(chunk);
            if (bytes > 32_000) { res.statusCode = 413; res.end('{"code":"INVALID_RECIPE"}'); return; }
            chunks.push(Buffer.from(chunk));
          }
          const controller = new AbortController();
          req.on("aborted", () => controller.abort());
          const request = new Request(`http://${req.headers.host}${path}`, {
            method: req.method, headers: req.headers as Record<string, string>,
            body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
            signal: controller.signal,
          });
          const response = await handler(request, { env, allowLocal: true });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch { res.statusCode = 502; res.end('{"code":"UNAVAILABLE"}'); }
      });
    },
  };
}
export default defineConfig(({ mode }) => ({
  envPrefix: ["VITE_SUPABASE_"],
  plugins: [react(), tailwindcss(), localAnalysis(mode)],
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
}));

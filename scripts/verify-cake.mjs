import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
if (!/^https:\/\/supabase-recipe\.84\.235\.237\.224\.sslip\.io\/?$/.test(env.VITE_SUPABASE_URL ?? "")) {
  throw new Error("Utilisez exclusivement Supabase Recipe sur Oracle.");
}
const key = randomBytes(32).toString("hex"),
  id = randomUUID();
const client = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { "x-deckchef-key": key } },
    auth: { persistSession: false },
  });
const db = client(),
  now = new Date().toISOString();
const recipe = {
  id,
  title: "Moelleux au citron (test)",
  category: "sucre",
  ingredients: ["200 g de farine", "2 œufs", "1 citron"],
  steps: ["Mélanger les ingrédients.", "Verser dans le moule et cuire."],
  image_url: "",
  is_cake: true,
  pan_size: 20,
  created_at: now,
  updated_at: now,
};
const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
let keep = false;
try {
  check(
    await db.rpc("deckchef_initialize", { p_key: key, p_recipes: [recipe] }),
  );
  for (const size of [20, 26, 28]) {
    if (size !== 20)
      check(
        await db
          .from("recipes")
          .update({ is_cake: true, pan_size: size })
          .eq("id", id),
      );
    const rows = check(
      await client().from("recipes").select("is_cake,pan_size").eq("id", id),
    );
    if (rows[0]?.pan_size !== size || rows[0]?.is_cake !== true)
      throw Error("Cake round trip failed");
  }
  const invalid = await db
    .from("recipes")
    .update({ pan_size: 22 })
    .eq("id", id);
  if (invalid.error?.code !== "23514")
    throw Error("Pan constraint not enforced");
  console.log(
    "Supabase : initialisation RPC et aller-retour 20/26/28 cm vérifiés ; 22 cm refusé.",
  );
  if (process.argv.includes("--prepare-browser")) {
    await writeFile(".tools/cake-qa.json", JSON.stringify({ code: key, id }));
    keep = true;
  }
} finally {
  if (!keep)
    check(await db.from("recipes").delete().eq("sync_key", key).eq("id", id));
}

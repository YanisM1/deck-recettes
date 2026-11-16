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
const keys = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
const clients = keys.map((key) =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { "x-deckchef-key": key } },
    auth: { persistSession: false },
  }),
);
await writeFile(".tools/qa-collections.json", JSON.stringify(keys));
const recipe = {
  id: randomUUID(),
  title: "DeckChef QA — éphémère",
  category: "sale",
  ingredients: ["Test"],
  steps: ["Test"],
  image_url: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
try {
  for (let i = 0; i < 2; i++) {
    const { error } = await clients[i].rpc("deckchef_initialize", {
      p_key: keys[i],
      p_recipes: i === 0 ? [recipe] : [],
    });
    if (error) throw error;
  }
  const own = await clients[0].from("recipes").select("id");
  check(!own.error && own.data.length === 1, "Lecture du carnet propriétaire");
  const other = await clients[1].from("recipes").select("id");
  check(!other.error && other.data.length === 0, "Isolation en lecture");
  const forbidden = await clients[1]
    .from("recipes")
    .insert({ ...recipe, id: randomUUID(), sync_key: keys[0] });
  check(!!forbidden.error, "Insertion croisée interdite");
  await clients[1].from("recipes").delete().eq("id", recipe.id);
  const unchanged = await clients[0].from("recipes").select("id");
  check(unchanged.data.length === 1, "Suppression croisée interdite");
  const update = await clients[0]
    .from("recipes")
    .update({ title: "DeckChef QA — modifié" })
    .eq("id", recipe.id)
    .select("title");
  check(
    !update.error && update.data[0]?.title === "DeckChef QA — modifié",
    "Modification propriétaire",
  );
  console.log(
    "Supabase : création, lecture, modification et isolation inter-carnets vérifiées.",
  );
} finally {
  for (let i = 0; i < 2; i++)
    await clients[i].from("recipes").delete().eq("sync_key", keys[i]);
}

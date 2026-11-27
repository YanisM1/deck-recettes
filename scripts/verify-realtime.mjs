import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
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
  name = "deckchef-" + createHash("sha256").update(key).digest("hex");
const clients = [0, 1].map(() =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  }),
);
let receive;
const received = new Promise((resolve) => {
  receive = resolve;
});
const channels = clients.map((client) => client.channel(name));
channels[1].on("broadcast", { event: "changed" }, () => receive());
const ready = (channel) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Realtime subscription timeout")),
      10000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR") {
        clearTimeout(timer);
        reject(Error(status));
      }
    });
  });
let timer;
try {
  await Promise.all(channels.map(ready));
  await channels[0].send({ type: "broadcast", event: "changed", payload: {} });
  await Promise.race([
    received,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(Error("Realtime delivery timeout")),
        8000,
      );
    }),
  ]);
  console.log(
    "Supabase Realtime : invalidation reçue par un second client indépendant.",
  );
} finally {
  clearTimeout(timer);
  await Promise.all(
    clients.map((client, index) => client.removeChannel(channels[index])),
  );
}

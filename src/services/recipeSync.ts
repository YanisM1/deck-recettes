import { useSyncExternalStore } from "react";
import { createClient } from "@supabase/supabase-js";
import { oracleSupabaseUrl } from "./oracleConfig";
import { createGlobalRecipeReader } from "./globalRecipeRead";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";
import { toRecipeRow } from "./recipeFields";

const origin = oracleSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const reader = import.meta.env.MODE === "test" ? null : createGlobalRecipeReader(origin ?? undefined, apiKey);

export async function fetchLinkedRecipe(id: string, _token: string | null, signal: AbortSignal) {
  return reader?.one(id, signal) ?? null;
}

function createRemote(): RemoteRecipes | null {
  if (!origin || !apiKey || !reader) return null;
  const client = createClient(origin, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const table = () => client.from("recipes_global");
  let subscriptions = 0;
  const check = ({ error }: { error: unknown }) => { if (error) throw error; };
  const timeout = () => AbortSignal.timeout(15_000);
  return {
    async initialize() {},
    fetch: () => reader.all(),
    async save(recipe, existing) {
      const { sync_key: _legacyKey, ...row } = toRecipeRow(recipe, "");
      if (existing) {
        const { id, created_at: _createdAt, ...changes } = row;
        check(await table().update(changes).eq("id", id).select("id").abortSignal(timeout()).single());
        return;
      }
      check(await table().insert(row).abortSignal(timeout()));
    },
    async remove(id) {
      check(await table().delete().eq("id", id).abortSignal(timeout()));
    },
    async reset() {
      check(await table().delete().not("id", "is", null).abortSignal(timeout()));
    },
    listen(onChange, onStatus) {
      let active = true;
      const channel = client.channel("deckchef-global-" + ++subscriptions)
        .on("postgres_changes", { event: "*", schema: "public", table: "recipes_global" }, onChange)
        .subscribe((status) => {
          if (!active) return;
          onStatus(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") onChange();
        });
      return () => {
        active = false;
        void client.removeChannel(channel);
      };
    },
  };
}

let store: RecipeStore | undefined;
export function getRecipeStore() {
  if (!store) {
    const storage = {
      getItem: (name: string) => {
        try {
          return localStorage.getItem(name);
        } catch {
          return null;
        }
      },
      setItem: (name: string, value: string) => localStorage.setItem(name, value),
    };
    const remote = createRemote();
    store = new RecipeStore(storage, remote, remote ? "global" : "local", !!remote);
  }
  return store;
}
export function useRecipes() {
  const store = getRecipeStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

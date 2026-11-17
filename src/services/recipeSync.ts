import { useSyncExternalStore } from "react";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";
import {
  readCompatible,
  fromRecipeRow,
  saveCompatible,
  toRecipeRow,
  type RecipeRow,
} from "./recipeFields";
type Database = {
  public: {
    Tables: {
      recipes: {
        Row: RecipeRow;
        Insert: RecipeRow;
        Update: Partial<RecipeRow>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      deckchef_initialize: {
        Args: { p_key: string; p_recipes: RecipeRow[] };
        Returns: undefined;
      };
      deckchef_read_shared_recipe: {
        Args: { p_id: string; p_token: string };
        Returns: Omit<RecipeRow, "sync_key">[];
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};
export const COLLECTION_KEY = "deckchef.collection.v1";
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === COLLECTION_KEY) window.location.reload();
  });
}
export function validCollectionKey(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}
let memoryKey: string | undefined;
export function getCollectionKey() {
  try {
    const saved = localStorage.getItem(COLLECTION_KEY);
    if (saved && validCollectionKey(saved)) return saved;
  } catch {
    /* Mode stockage privé. */
  }
  if (!memoryKey)
    memoryKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  try {
    localStorage.setItem(COLLECTION_KEY, memoryKey);
  } catch {
    /* L'erreur de sauvegarde sera affichée lors d'une modification. */
  }
  return memoryKey;
}
export function openCollection(key: string) {
  const value = key.trim().toLowerCase();
  if (!validCollectionKey(value))
    throw new Error(
      "Le code doit contenir exactement 64 caractères (0–9 et a–f).",
    );
  localStorage.setItem(COLLECTION_KEY, value);
  window.location.reload();
}
function createRecipeClient(key?: string): SupabaseClient<Database> | null {
  const url = import.meta.env.VITE_SUPABASE_URL,
    apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !apiKey || import.meta.env.MODE === "test") return null;
  try {
    return createClient<Database>(url, apiKey, {
      global: key ? { headers: { "x-deckchef-key": key } } : undefined,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}
export async function fetchLinkedRecipe(
  id: string,
  token: string | null,
  signal: AbortSignal,
) {
  const client = createRecipeClient(token ? undefined : getCollectionKey());
  if (!client) return null;
  if (token) {
    const { data, error } = await client
      .rpc("deckchef_read_shared_recipe", { p_id: id, p_token: token })
      .abortSignal(signal);
    if (error) throw error;
    return data?.[0] ? fromRecipeRow(data[0]) : null;
  }
  const recipes = await readCompatible((columns) =>
    client.from("recipes").select(columns).eq("id", id).abortSignal(signal),
  );
  return recipes[0] ?? null;
}
export function createRemote(key: string): RemoteRecipes | null {
  const client = createRecipeClient(key);
  if (!client) return null;
  let channel: RealtimeChannel | null = null;
  const check = (error: unknown) => {
    if (error) throw error;
  };
  return {
    async initialize(recipes) {
      const { error } = await client.rpc("deckchef_initialize", {
        p_key: key,
        p_recipes: recipes.map((recipe) => toRecipeRow(recipe, key)),
      });
      check(error);
    },
    async fetch() {
      return readCompatible((columns) =>
        client
          .from("recipes")
          .select(columns)
          .order("created_at", { ascending: true })
          .order("id"),
      );
    },
    async save(recipe) {
      return saveCompatible(recipe, key, (row) =>
        client.from("recipes").upsert(row, { onConflict: "sync_key,id" }),
      );
    },
    async remove(id) {
      const { error } = await client
        .from("recipes")
        .delete()
        .eq("sync_key", key)
        .eq("id", id);
      check(error);
    },
    async reset() {
      const { error } = await client
        .from("recipes")
        .delete()
        .eq("sync_key", key);
      check(error);
    },
    listen(onChange, onStatus) {
      let cancelled = false;
      if (!crypto.subtle) {
        onStatus(false);
        return () => {};
      }
      void crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(key))
        .then((hash) => {
          if (cancelled) return;
          const name = Array.from(new Uint8Array(hash), (n) =>
            n.toString(16).padStart(2, "0"),
          ).join("");
          channel = client
            .channel(`deckchef-${name}`)
            .on("broadcast", { event: "changed" }, onChange)
            .subscribe((status) => {
              if (cancelled) return;
              onStatus(status === "SUBSCRIBED");
              if (status === "SUBSCRIBED") onChange();
            });
        })
        .catch(() => {
          if (!cancelled) onStatus(false);
        });
      return () => {
        cancelled = true;
        if (channel) {
          void client.removeChannel(channel);
          channel = null;
        }
      };
    },
    async notify() {
      if (channel)
        await channel.send({
          type: "broadcast",
          event: "changed",
          payload: {},
        });
    },
  };
}
let store: RecipeStore | undefined;
export function getRecipeStore() {
  if (!store) {
    const key = getCollectionKey();
    const storage = {
      getItem: (name: string) => {
        try {
          return localStorage.getItem(name);
        } catch {
          return null;
        }
      },
      setItem: (name: string, value: string) =>
        localStorage.setItem(name, value),
    };
    store = new RecipeStore(storage, createRemote(key), key);
  }
  return store;
}
export function useRecipes() {
  const store = getRecipeStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

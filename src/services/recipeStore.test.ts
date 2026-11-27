import { describe, it, expect, vi } from "vitest";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";
import { starterRecipes } from "../data/recipes";
import type { RecipeInput, Recipe } from "../types";
const input: RecipeInput = {
  title: "Soupe maison",
  category: "sale",
  ingredients: ["2 carottes"],
  steps: ["Cuire puis mixer."],
  image_url: "",
};
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
function remote() {
  let rows: Recipe[] | null = null,
    fail = false;
  const api: RemoteRecipes = {
    async initialize(recipes) {
      if (fail) throw Error();
      if (rows === null) rows = [...recipes];
    },
    async fetch() {
      if (fail) throw Error();
      return rows || [];
    },
    async save(recipe) {
      if (fail) throw Error();
      rows = [...(rows || []).filter((r) => r.id !== recipe.id), recipe];
    },
    async remove(id) {
      if (fail) throw Error();
      rows = (rows || []).filter((r) => r.id !== id);
    },
    async reset() {
      if (fail) throw Error();
      rows = [];
    },
  };
  return {
    api,
    setFail: (value: boolean) => {
      fail = value;
    },
    rows: () => rows,
  };
}
describe("livre global", () => {
  it("ignore les exemples et les écritures anciennes, puis conserve le dernier résultat confirmé", async () => {
    const db = remote();
    const cache = storage();
    const initialize = vi.spyOn(db.api, "initialize");
    const save = vi.spyOn(db.api, "save");
    cache.setItem("deckchef.recipes.v1.global", JSON.stringify({
      recipes: [],
      queue: [{ type: "reset" }, { type: "save", recipe: starterRecipes[0] }],
    }));
    const store = new RecipeStore(cache, db.api, "global", true);
    expect(store.getSnapshot().recipes).toEqual([]);
    await store.sync();
    expect(store.getSnapshot()).toMatchObject({ status: "connected", pending: 0 });
    expect(store.getSnapshot().lastSync).toBeDefined();
    expect(initialize).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();

    const saved = await store.saveConfirmed(input);
    await store.sync();
    db.setFail(true);
    await expect(store.saveConfirmed({ ...input, title: "Soupe verte" }, saved.id)).rejects.toThrow();
    await expect(store.reset()).rejects.toThrow();
    await store.sync();
    expect(store.getSnapshot()).toMatchObject({
      status: "offline",
      pending: 0,
      recipes: [saved],
    });
    expect(JSON.parse(cache.getItem(store.cacheKey)!).queue).toEqual([]);
  });

  it("actualise une session ouverte après pageshow, focus, online, visibilité et Realtime", async () => {
    const db = remote();
    const fetch = vi.spyOn(db.api, "fetch");
    let invalidate = () => {};
    db.api.listen = (onChange, onStatus) => {
      invalidate = onChange;
      onStatus(true);
      return () => {};
    };
    const store = new RecipeStore(storage(), db.api, "global", true);
    const unsubscribe = store.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(store.getSnapshot().status).toBe("connected"));
      expect(store.getSnapshot().realtime).toBe(true);
      for (const event of ["pageshow", "focus", "online", "visibilitychange", "realtime"]) {
        const before = fetch.mock.calls.length;
        if (event === "realtime") invalidate();
        else (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event));
        await vi.waitFor(() => {
          expect(fetch.mock.calls.length).toBeGreaterThan(before);
          expect(store.getSnapshot().status).toBe("connected");
        });
      }
    } finally {
      unsubscribe();
    }
  });
});

describe("carnet local et synchronisation", () => {
  it("démarre avec quatre recettes quand aucune sauvegarde n’existe", () =>
    expect(new RecipeStore(storage(), null).getSnapshot().recipes).toHaveLength(
      4,
    ));
  it("ajoute, modifie, supprime et restaure le cache", () => {
    const cache = storage(),
      store = new RecipeStore(cache, null);
    const recipe = store.save(input);
    store.save({ ...input, title: "Soupe verte" }, recipe.id);
    expect(
      store.getSnapshot().recipes.find((r) => r.id === recipe.id)?.title,
    ).toBe("Soupe verte");
    store.remove(recipe.id);
    expect(new RecipeStore(cache, null).getSnapshot().recipes).toHaveLength(4);
  });
  it("ne ressème pas les exemples après un reset", () => {
    const cache = storage(),
      store = new RecipeStore(cache, null);
    store.reset();
    expect(new RecipeStore(cache, null).getSnapshot().recipes).toEqual([]);
  });
  it("refuse les données incomplètes sans les sauvegarder", () => {
    const store = new RecipeStore(storage(), null);
    expect(() => store.save({ ...input, title: "  " })).toThrow();
    expect(() => store.save({ ...input, steps: [] })).toThrow();
    expect(store.getSnapshot().recipes).toHaveLength(4);
  });
  it("conserve les opérations hors ligne puis les rejoue", async () => {
    const db = remote(),
      cache = storage(),
      store = new RecipeStore(cache, db.api);
    await store.sync();
    db.setFail(true);
    const recipe = store.save(input);
    await store.sync();
    expect(store.getSnapshot().status).toBe("offline");
    expect(store.getSnapshot().pending).toBe(1);
    db.setFail(false);
    await store.sync();
    expect(db.rows()?.find((r) => r.id === recipe.id)).toBeDefined();
    expect(store.getSnapshot().pending).toBe(0);
  });
  it("rejoue une suppression hors ligne sans ressusciter la recette", async () => {
    const db = remote(),
      store = new RecipeStore(storage(), db.api);
    await store.sync();
    db.setFail(true);
    store.remove(starterRecipes[0].id);
    await store.sync();
    db.setFail(false);
    await store.sync();
    expect(
      store.getSnapshot().recipes.some((r) => r.id === starterRecipes[0].id),
    ).toBe(false);
  });
  it("garde un carnet distant vide après reset et nouvel appareil", async () => {
    const db = remote(),
      store = new RecipeStore(storage(), db.api);
    await store.sync();
    store.reset();
    await store.sync();
    const other = new RecipeStore(storage(), db.api);
    await other.sync();
    expect(other.getSnapshot().recipes).toEqual([]);
  });
  it("n’annonce pas une sauvegarde locale si le quota est plein", () => {
    const store = new RecipeStore(
      {
        getItem: () => null,
        setItem: () => {
          throw Error("quota");
        },
      },
      null,
    );
    expect(() => store.save(input)).toThrow("pleine");
    expect(store.getSnapshot().recipes).toHaveLength(4);
  });
  it("restaure aussi les opérations en attente après rechargement", async () => {
    const db = remote(),
      cache = storage();
    db.setFail(true);
    const store = new RecipeStore(cache, db.api);
    store.save(input);
    await store.sync();
    const restored = new RecipeStore(cache, db.api);
    expect(restored.getSnapshot().pending).toBe(1);
    db.setFail(false);
    await restored.sync();
    expect(restored.getSnapshot().recipes).toHaveLength(5);
  });
});

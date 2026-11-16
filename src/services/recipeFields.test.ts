import { describe, it, expect, vi } from "vitest";
import { starterRecipes } from "../data/recipes";
import { cakeFields, type PanSize } from "../types";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";
import {
  fromRecipeRow,
  toRecipeRow,
  readCompatible,
  saveCompatible,
} from "./recipeFields";
const key = "a".repeat(64),
  missing = {
    code: "PGRST204",
    message: "Could not find the 'pan_size' column",
  };
describe("gâteaux et compatibilité de synchronisation", () => {
  it.each([20, 26, 28] as const)(
    "conserve un moule %s cm dans le cache et le mapping SQL",
    (size) => {
      const cache = new Map<string, string>(),
        storage = {
          getItem: (k: string) => cache.get(k) || null,
          setItem: (k: string, v: string) => {
            cache.set(k, v);
          },
        };
      const store = new RecipeStore(storage, null);
      const recipe = store.save({
        ...starterRecipes[0],
        isCake: true,
        panSize: size,
      });
      expect(
        new RecipeStore(storage, null)
          .getSnapshot()
          .recipes.find((r) => r.id === recipe.id)?.panSize,
      ).toBe(size);
      const row = toRecipeRow(recipe, key);
      expect(row.pan_size).toBe(size);
      expect(row.is_cake).toBe(true);
      expect(row).not.toHaveProperty("panSize");
      expect(fromRecipeRow(row).panSize).toBe(size);
    },
  );
  it("refuse les diamètres non proposés et retire la taille quand Gâteau est décoché", () => {
    expect(() => cakeFields({ isCake: true, panSize: 22 })).toThrow(
      "20, 26 ou 28",
    );
    expect(cakeFields({ isCake: false, panSize: 28 })).toEqual({
      isCake: false,
      panSize: undefined,
    });
    expect(cakeFields({})).toEqual({ isCake: false, panSize: undefined });
  });
  it("relit une ancienne base sans les nouvelles colonnes", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: missing })
      .mockResolvedValueOnce({ data: [starterRecipes[0]], error: null });
    const rows = await readCompatible(read);
    expect(rows[0].isCake).toBe(false);
    expect(rows[0].panSize).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("synchronise les recettes ordinaires avec une ancienne base", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce({ error: missing })
      .mockResolvedValueOnce({ error: null });
    await saveCompatible(starterRecipes[0], key, write);
    expect(write.mock.calls[1][0]).not.toHaveProperty("pan_size");
  });
  it("garde le moule en attente après rechargement, puis le synchronise après migration", async () => {
    const cache = new Map<string, string>(),
      storage = {
        getItem: (k: string) => cache.get(k) || null,
        setItem: (k: string, v: string) => {
          cache.set(k, v);
        },
      };
    let upgraded = false;
    let saved = toRecipeRow(starterRecipes[0], key);
    const remote: RemoteRecipes = {
      initialize: async () => {},
      fetch: async () => [fromRecipeRow(saved)],
      save: (recipe) =>
        saveCompatible(recipe, key, async (row) => {
          if (!upgraded && "pan_size" in row) return { error: missing };
          saved = row;
          return { error: null };
        }),
      remove: async () => {},
      reset: async () => {},
    };
    const store = new RecipeStore(storage, remote);
    const recipe = store.save({
      ...starterRecipes[0],
      isCake: true,
      panSize: 28,
    });
    await store.sync();
    expect(store.getSnapshot().pending).toBe(1);
    const reloaded = new RecipeStore(storage, remote);
    expect(
      reloaded.getSnapshot().recipes.find((r) => r.id === recipe.id)?.panSize,
    ).toBe(28);
    upgraded = true;
    await reloaded.sync();
    expect(reloaded.getSnapshot().pending).toBe(0);
    expect(saved.pan_size).toBe(28);
  });
  it("ne masque pas les erreurs de droits ou de réseau", async () => {
    const write = vi
      .fn()
      .mockResolvedValue({ error: { code: "42501", message: "denied" } });
    await expect(
      saveCompatible(
        { ...starterRecipes[0], panSize: 26 as PanSize },
        key,
        write,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(write).toHaveBeenCalledTimes(1);
  });
});

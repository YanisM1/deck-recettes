import { expect, it } from "vitest";
import { RecipeStore, type RemoteRecipes } from "./recipeStore";
import { fromRecipeRow, saveCompatible, toRecipeRow } from "./recipeFields";
import { starterRecipes } from "../data/recipes";
const key = "a".repeat(64);
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, value: string) => { data.set(k, value); } };
};
it("conserve les liaisons localement et dans leur colonne SQL sans modifier les recettes liées", () => {
  const storage = memory(), store = new RecipeStore(storage, null);
  const source = starterRecipes[0], linked = starterRecipes[1];
  const saved = store.save({ ...source, linkedRecipeIds: [linked.id] }, source.id);
  expect(store.getSnapshot().recipes.find(r => r.id === linked.id)?.ingredients).toEqual(linked.ingredients);
  const reloaded = new RecipeStore(storage, null).getSnapshot().recipes.find(r => r.id === saved.id)!;
  expect(reloaded.linkedRecipeIds).toEqual([linked.id]);
  const row = toRecipeRow(reloaded, key);
  expect(row).not.toHaveProperty("linkedRecipeIds");
  expect(fromRecipeRow(row).linkedRecipeIds).toEqual([linked.id]);
});
it("refuse une boucle avant toute sauvegarde et protège le carnet des liens étrangers", () => {
  const store = new RecipeStore(memory(), null), [a, b] = starterRecipes;
  store.save({ ...a, linkedRecipeIds: [b.id] }, a.id);
  expect(() => store.save({ ...b, linkedRecipeIds: [a.id] }, b.id)).toThrow("boucle");
  expect(() => store.save({ ...b, linkedRecipeIds: [crypto.randomUUID()] }, b.id)).toThrow("disponible");
  expect(store.getSnapshot().recipes.find(r => r.id === b.id)?.linkedRecipeIds).toBeUndefined();
});
it("conserve une liaison en attente jusqu’à la migration du serveur", async () => {
  const storage = memory(), [a,b] = starterRecipes; let migrated = false, rows = starterRecipes.map(r => toRecipeRow(r,key));
  const remote: RemoteRecipes = {
    initialize: async () => {}, fetch: async () => rows.map(fromRecipeRow), remove: async () => {}, reset: async () => {},
    save: recipe => saveCompatible(recipe,key,async row => {
      if (!migrated && "linked_recipe_ids" in row) return {error:{code:"PGRST204",message:"linked_recipe_ids missing"}};
      rows = rows.map(r => r.id === row.id ? row : r); return {error:null};
    }),
  };
  const store = new RecipeStore(storage,remote);
  store.save({...a,linkedRecipeIds:[b.id]},a.id);
  await store.sync();
  expect(store.getSnapshot().pending).toBe(1);
  const reloaded=new RecipeStore(storage,remote);
  expect(reloaded.getSnapshot().recipes.find(r=>r.id===a.id)?.linkedRecipeIds).toEqual([b.id]);
  migrated=true; await reloaded.sync();
  expect(reloaded.getSnapshot().pending).toBe(0);
  expect(rows.find(r=>r.id===a.id)?.linked_recipe_ids).toEqual([b.id]);
});

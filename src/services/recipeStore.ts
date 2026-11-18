import type { Recipe, RecipeInput } from "../types";
import { cakeFields } from "../types";
import { starterRecipes } from "../data/recipes";
import { hasFreshCalories } from "./calorieAnalysis";
import { normalizeLinkedRecipeIds, validateRecipeLinks } from "./compositeRecipes";
export type Operation =
  | { type: "save"; recipe: Recipe }
  | { type: "delete"; id: string }
  | { type: "reset" };
export interface RemoteRecipes {
  initialize(recipes: Recipe[]): Promise<void>;
  fetch(): Promise<Recipe[]>;
  save(recipe: Recipe): Promise<void>;
  remove(id: string): Promise<void>;
  reset(): Promise<void>;
  listen?(
    onChange: () => void,
    onStatus: (connected: boolean) => void,
  ): () => void;
  notify?(): Promise<void>;
}
export interface RecipeSnapshot {
  recipes: Recipe[];
  status: "local" | "syncing" | "connected" | "offline";
  pending: number;
  realtime: boolean;
  error: string | null;
}
type Cache = { recipes: Recipe[]; queue: Operation[] };
export function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== "object") return false;
  const r = value as Recipe;
  return (
    typeof r.id === "string" &&
    typeof r.title === "string" &&
    (r.category === "sale" || r.category === "sucre") &&
    Array.isArray(r.ingredients) &&
    r.ingredients.every((v) => typeof v === "string") &&
    Array.isArray(r.steps) &&
    r.steps.every((v) => typeof v === "string") &&
    typeof r.image_url === "string" &&
    typeof r.created_at === "string" &&
    typeof r.updated_at === "string"
  );
}
function isOperation(value: unknown): value is Operation {
  if (!value || typeof value !== "object") return false;
  const op = value as Operation;
  return (
    op.type === "reset" ||
    (op.type === "save" && isRecipe(op.recipe)) ||
    (op.type === "delete" && typeof op.id === "string")
  );
}
export function applyOperations(recipes: Recipe[], queue: Operation[]) {
  let result = [...recipes];
  for (const op of queue) {
    if (op.type === "reset") result = [];
    else if (op.type === "delete")
      result = result.filter((r) => r.id !== op.id);
    else {
      const index = result.findIndex((r) => r.id === op.recipe.id);
      if (index < 0) result.push(op.recipe);
      else result[index] = op.recipe;
    }
  }
  return result;
}
export class RecipeStore {
  private state: RecipeSnapshot;
  private queue: Operation[] = [];
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private stopRemote?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  readonly cacheKey: string;
  constructor(
    private storage: Pick<Storage, "getItem" | "setItem">,
    private remote: RemoteRecipes | null,
    collectionKey = "local",
  ) {
    this.cacheKey = `deckchef.recipes.v1.${collectionKey}`;
    let recipes = starterRecipes.map((r) => ({
      ...r,
      ingredients: [...r.ingredients],
      steps: [...r.steps],
    }));
    try {
      const cache = JSON.parse(
        storage.getItem(this.cacheKey) || "null",
      ) as Cache | null;
      if (
        cache &&
        Array.isArray(cache.recipes) &&
        cache.recipes.every(isRecipe) &&
        Array.isArray(cache.queue) &&
        cache.queue.every(isOperation)
      ) {
        recipes = cache.recipes;
        this.queue = cache.queue;
      }
    } catch {
      /* Une sauvegarde illisible ne bloque pas l'application. */
    }
    this.state = {
      recipes,
      status: remote ? "syncing" : "local",
      pending: this.queue.length,
      realtime: false,
      error: null,
    };
  }
  getSnapshot = () => this.state;
  private update(value: Partial<RecipeSnapshot>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((fn) => fn());
  }
  private persist(recipes: Recipe[], queue: Operation[]) {
    try {
      this.storage.setItem(this.cacheKey, JSON.stringify({ recipes, queue }));
    } catch {
      throw new Error(
        "La sauvegarde de cet appareil est pleine ou indisponible. Libérez de l’espace avant de réessayer.",
      );
    }
    this.queue = queue;
    this.update({ recipes, pending: queue.length, error: null });
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(fn);
      if (!this.listeners.size) this.stop();
    };
  };
  private refresh = () => {
    void this.sync();
  };
  private visible = () => {
    if (document.visibilityState === "visible") this.refresh();
  };
  private storageChanged = (event: StorageEvent) => {
    if (event.key !== this.cacheKey) return;
    try {
      const cache = JSON.parse(event.newValue || "null") as Cache;
      if (
        cache &&
        Array.isArray(cache.recipes) &&
        cache.recipes.every(isRecipe) &&
        Array.isArray(cache.queue) &&
        cache.queue.every(isOperation)
      ) {
        this.queue = cache.queue;
        this.update({ recipes: cache.recipes, pending: this.queue.length });
        this.refresh();
      }
    } catch {
      /* Ignorer les événements invalides. */
    }
  };
  private start() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.refresh);
      window.addEventListener("focus", this.refresh);
      window.addEventListener("storage", this.storageChanged);
      document.addEventListener("visibilitychange", this.visible);
    }
    this.stopRemote = this.remote?.listen?.(this.refresh, (realtime) =>
      this.update({ realtime }),
    );
    if (this.remote) this.timer = setInterval(this.visible, 45000);
    this.refresh();
  }
  private stop() {
    this.stopRemote?.();
    this.stopRemote = undefined;
    clearInterval(this.timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.refresh);
      window.removeEventListener("focus", this.refresh);
      window.removeEventListener("storage", this.storageChanged);
      document.removeEventListener("visibilitychange", this.visible);
    }
  }
  save(input: RecipeInput, id?: string) {
    const title = input.title.trim(),
      ingredients = input.ingredients.map((v) => v.trim()).filter(Boolean),
      steps = input.steps.map((v) => v.trim()).filter(Boolean);
    if (!title || title.length > 160 || !ingredients.length || !steps.length)
      throw new Error("Ajoutez un titre, au moins un ingrédient et une étape.");
    if (input.category !== "sale" && input.category !== "sucre")
      throw new Error("Catégorie invalide.");
    if (input.servings != null && (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > 999))
      throw new Error("Choisissez entre 1 et 999 portions de base.");
    const existing = id
      ? this.state.recipes.find((r) => r.id === id)
      : undefined;
    if (id && !existing)
      throw new Error("Cette recette n’existe plus. Revenez au carnet.");
    const now = new Date().toISOString(),
      recipe: Recipe = {
        ...input,
        ...cakeFields(input),
        servings: input.servings ?? 2,
        title,
        ingredients,
        steps,
        id: id || crypto.randomUUID(),
        created_at: existing?.created_at || now,
        updated_at: now,
      };
    if (!hasFreshCalories(recipe)) recipe.caloriesInfo = undefined;
    recipe.linkedRecipeIds = normalizeLinkedRecipeIds(input.linkedRecipeIds, recipe.id);
    validateRecipeLinks(recipe.id, recipe.linkedRecipeIds, this.state.recipes);
    const operation: Operation = { type: "save", recipe };
    this.persist(applyOperations(this.state.recipes, [operation]), [
      ...this.queue,
      operation,
    ]);
    void this.sync();
    return recipe;
  }
  remove(id: string) {
    const operation: Operation = { type: "delete", id };
    this.persist(applyOperations(this.state.recipes, [operation]), [
      ...this.queue,
      operation,
    ]);
    void this.sync();
  }
  reset() {
    const operation: Operation = { type: "reset" };
    this.persist([], [...this.queue, operation]);
    void this.sync();
  }
  sync(): Promise<void> {
    if (!this.remote) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.performSync().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    return this.running;
  }
  private async performSync() {
    const remote = this.remote!;
    this.update({ status: "syncing", error: null });
    try {
      await remote.initialize(this.state.recipes);
      let changed = false;
      while (this.queue.length) {
        const op = this.queue[0];
        if (op.type === "save") await remote.save(op.recipe);
        else if (op.type === "delete") await remote.remove(op.id);
        else await remote.reset();
        this.persist(
          this.state.recipes,
          this.queue.filter((item) => item !== op),
        );
        changed = true;
      }
      const recipes = await remote.fetch();
      this.persist(applyOperations(recipes, this.queue), this.queue);
      this.update({ status: "connected", error: null });
      if (changed) await remote.notify?.();
    } catch {
      this.update({
        status: "offline",
        error:
          "Synchronisation indisponible. Vos changements restent sauvegardés sur cet appareil.",
      });
    }
  }
}

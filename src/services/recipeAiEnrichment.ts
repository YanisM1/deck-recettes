import type { Recipe } from "../types";
import type { RecipeStore } from "./recipeStore";
import { recipeFingerprint } from "./calorieAnalysis";
import { analyzeRecipeAi } from "./recipeAiService";
import { hasFreshRecipeAi, type RecipeAiData } from "./recipeAiTypes";
import { getCollectionKey } from "./recipeSync";

export interface RecipeAiStatus {
  state: "analyzing" | "ready" | "local" | "stale" | "error";
  message: string;
}
type Observer = { isCurrent?: () => boolean; onStatus?: (status: RecipeAiStatus) => void };
type Job = { fingerprint: string; key: string; controller: AbortController;
  observers: Set<Observer>; status: RecipeAiStatus; promise: Promise<RecipeAiData | null> };
const active = new WeakMap<RecipeStore, Map<string, Job>>();

/** Background-only: selectors always read cached variants and never call this. */
export function analyzeAndEnrichRecipe(store: RecipeStore, recipe: Recipe, observer: Observer = {}): Promise<RecipeAiData | null> {
  const fingerprint = recipeFingerprint(recipe), key = getCollectionKey();
  let jobs = active.get(store);
  if (!jobs) { jobs = new Map(); active.set(store, jobs); }
  const previous = jobs.get(recipe.id);
  if (previous?.fingerprint === fingerprint && previous.key === key) {
    previous.observers.add(observer);
    if (observer.isCurrent?.() !== false) observer.onStatus?.(previous.status);
    return previous.promise;
  }
  previous?.controller.abort();
  const job: Job = { fingerprint, key, controller: new AbortController(), observers: new Set([observer]),
    status: { state: "analyzing", message: "Analyse IA en cours… Votre recette est déjà sauvegardée." }, promise: Promise.resolve(null) };
  jobs.set(recipe.id, job);
  const isCurrent = () => getCollectionKey() === key && [...job.observers].some(item => item.isCurrent?.() !== false);
  const notify = (status: RecipeAiStatus) => {
    job.status = status;
    if (getCollectionKey() !== key) return;
    job.observers.forEach(item => { if (item.isCurrent?.() !== false) item.onStatus?.(status); });
  };
  notify(job.status);
  job.promise = (async () => {
    try {
      const data = await analyzeRecipeAi(recipe, { signal: job.controller.signal, collectionKey: key });
      if (job.controller.signal.aborted || jobs.get(recipe.id) !== job || !isCurrent()) return null;
      const current = store.getSnapshot().recipes.find(item => item.id === recipe.id);
      if (current && recipeFingerprint(current) === fingerprint && hasFreshRecipeAi(current)
        && current.aiScalingData?.source === "gemini" && data.source === "local") {
        notify({ state: "ready", message: "L’IA est indisponible ; les variantes déjà enregistrées sont conservées." });
        return current.aiScalingData;
      }
      if (!store.enrichAi(recipe.id, fingerprint, data)) {
        notify({ state: "stale", message: "La recette a changé. Relancez l’analyse pour son nouveau contenu." });
        return null;
      }
      notify(data.source === "gemini" ? { state: "ready", message: "Calories et variantes IA enregistrées." }
        : { state: "local", message: "Mode local : variantes de secours enregistrées. Réessayez l’IA quand la connexion revient." });
      return data;
    } catch {
      if (!job.controller.signal.aborted && isCurrent()) notify({ state: "error", message: "Impossible d’enregistrer l’analyse. Votre recette reste sauvegardée." });
      return null;
    } finally {
      if (jobs.get(recipe.id) === job) jobs.delete(recipe.id);
    }
  })();
  return job.promise;
}

import { useCallback, useRef, useState } from "react";
import type { Recipe } from "../types";
import { getRecipeStore } from "../services/recipeSync";
import { recipeFingerprint } from "../services/calorieAnalysis";
import { analyzeAndEnrichRecipe, type RecipeAiStatus } from "../services/recipeAiEnrichment";
import { hasFreshRecipeAi } from "../services/recipeAiTypes";
import { composeRecipes } from "../services/compositeRecipes";

/** Explicit analysis and save enrichment only; changing a selector never enters this hook. */
export function useRecipeAiActions() {
  const [statuses, setStatuses] = useState<Record<string, RecipeAiStatus>>({});
  const batches = useRef(new Map<string, Promise<void>>());
  const analyze = useCallback((recipe: Recipe, includeLinked = false, forceRefresh = false): Promise<void> => {
    const store = getRecipeStore();
    const fingerprint = recipeFingerprint(recipe);
    const key = `${store.cacheKey}:${recipe.id}:${fingerprint}`;
    const existing = batches.current.get(key);
    if (existing) return existing;
    const isCurrent = () => getRecipeStore() === store;
    const update = (status: RecipeAiStatus) => { if (isCurrent()) setStatuses(previous => ({ ...previous, [key]: status })); };
    update({ state: "analyzing", message: "Analyse IA en cours… Votre recette est déjà sauvegardée." });
    const job = (async () => {
      const components = includeLinked
        ? composeRecipes(recipe, store.getSnapshot().recipes).sections.map(section => store.getSnapshot().recipes.find(item => item.id === section.recipeId)).filter((item): item is Recipe => !!item)
        : [recipe];
      let local = false;
      let localMessage = "";
      let failed = false;
      for (const component of components) {
        if (!isCurrent()) return;
        if (includeLinked && !forceRefresh && hasFreshRecipeAi(component) && component.aiScalingData?.source === "gemini") continue;
        const data = await analyzeAndEnrichRecipe(store, component, { isCurrent });
        if (!data) failed = true;
        else if (data.source === "local") {
          local = true;
          localMessage = data.note;
          if (!data.caloriesInfo) failed = true;
        }
      }
      const current = store.getSnapshot().recipes.find(item => item.id === recipe.id);
      if (!current || recipeFingerprint(current) !== fingerprint) {
        update({ state: "stale", message: "La recette a changé ; ses anciens résultats ont été ignorés." });
      } else update(failed ? { state: "error", message: localMessage || "Analyse incomplète. Votre recette reste sauvegardée ; réessayez." }
        : local ? { state: "local", message: localMessage || "Estimation locale indicative enregistrée. Vérifiez les hypothèses et réessayez l’IA avec une connexion." }
        : { state: "ready", message: "Calories et variantes IA enregistrées." });
    })().catch(() => update({ state: "error", message: "Votre recette est sauvegardée. L’analyse pourra être relancée." })).finally(() => { batches.current.delete(key); });
    batches.current.set(key, job);
    return job;
  }, []);
  const statusFor = (recipe: Recipe) => statuses[`${getRecipeStore().cacheKey}:${recipe.id}:${recipeFingerprint(recipe)}`];
  return { analyze, statusFor };
}

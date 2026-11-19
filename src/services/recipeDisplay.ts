import type { Recipe } from "../types";
import { composeRecipes, type ComposedRecipe } from "./compositeRecipes";
import { hasFreshCalories, recipeFingerprint } from "./calorieAnalysis";
import { createLocalRecipeAi, scaleRecipeIngredients } from "./recipeAiFallback";
import { hasFreshRecipeAi, recipeAiVariantInput, PAN_TARGETS, SERVING_TARGETS, type RecipeAiData } from "./recipeAiTypes";

export const usesPanSizes = (recipe: Recipe) => recipe.isCake === true || recipe.category === "sucre";
export type RecipeDisplay = {
  recipe: Recipe;
  composed: ComposedRecipe;
  cookingNotes: string[];
  local: boolean;
  adapted: boolean;
};
export type RecipeDisplayCache = { kind: "sale" | "sucre"; initial: number; signature: string; values: Record<string, RecipeDisplay> };

/** Build every selection once. Displaying another size/person count never calls a service. */
export function createRecipeDisplayCache(root: Recipe, availableRecipes: readonly Recipe[]): RecipeDisplayCache {
  const base = composeRecipes(root, availableRecipes);
  const byId = new Map(availableRecipes.map(recipe => [recipe.id, recipe]));
  byId.set(root.id, root);
  const components = base.sections.map(section => byId.get(section.recipeId)!).filter(Boolean);
  const caches = new Map<string, RecipeAiData | undefined>(components.map(recipe => {
    try { return [recipe.id, hasFreshRecipeAi(recipe) ? recipe.aiScalingData! : createLocalRecipeAi(recipe)]; }
    catch { return [recipe.id, undefined]; } // Old imported recipes can exceed the bounded API format.
  }));
  const sweet = usesPanSizes(root);
  const initial = sweet ? root.panSize ?? 26 : Math.min(8, Math.max(1, root.servings ?? 2));
  const values: Record<string, RecipeDisplay> = {};
  for (const target of sweet ? PAN_TARGETS : SERVING_TARGETS) {
    const factor = sweet ? target * target / ((root.panSize ?? 26) ** 2) : target / (root.servings ?? 2);
    let local = false;
    const cookingNotes: string[] = [];
    const adaptedComponents = components.map(component => {
      const data = caches.get(component.id);
      const componentSweet = usesPanSizes(component);
      const targets = componentSweet ? PAN_TARGETS : SERVING_TARGETS;
      const matchingTarget = targets.find(value => Math.abs((componentSweet ? value * value / ((component.panSize ?? 26) ** 2) : value / (component.servings ?? 2)) - factor) < .00001);
      const variant = matchingTarget === undefined || !data ? undefined : (componentSweet ? data.panSizesMap : data.servingsMap)?.[String(matchingTarget)];
      let selected: Recipe;
      if (variant) {
        selected = { ...component, ...recipeAiVariantInput(component, variant, matchingTarget!), caloriesInfo: variant.caloriesInfo };
        local ||= data!.source === "local";
        if (variant.cookingNote) cookingNotes.push(components.length > 1 ? `${component.title} : ${variant.cookingNote}` : variant.cookingNote);
      } else {
        local = true;
        const ingredients = scaleRecipeIngredients(component, factor, { pastry: sweet || componentSweet });
        selected = { ...component, ingredients, caloriesInfo: undefined };
        // A known base estimate remains usable only when the complete batch is unchanged.
        if (factor === 1 && hasFreshCalories(component) && ingredients.every((line, index) => line === component.ingredients[index])) selected.caloriesInfo = component.caloriesInfo;
        cookingNotes.push(`${components.length > 1 ? component.title + " : " : ""}Adaptation locale indicative de l’ensemble ; vérifiez les pièces entières et la cuisson.`);
      }
      if (component.id === root.id) {
        selected = { ...selected, ...(sweet ? { isCake: true, panSize: target as 20 | 26 | 28 } : { servings: target }) };
      }
      if (selected.caloriesInfo) selected.caloriesInfo = { ...selected.caloriesInfo, fingerprint: recipeFingerprint(selected) };
      return selected;
    });
    const selectedRoot = adaptedComponents.find(recipe => recipe.id === root.id)!;
    const composed = composeRecipes(selectedRoot, adaptedComponents);
    const recipe: Recipe = { ...selectedRoot, ingredients: composed.ingredients, steps: composed.steps, linkedRecipeIds: undefined,
      aiScalingData: undefined, caloriesInfo: composed.caloriesInfo, caloriesValue: composed.caloriesInfo?.kcal,
      caloriesUnit: composed.caloriesInfo ? composed.caloriesInfo.basis === "part" ? "kcal / part (1/8)" : "kcal / 100g" : undefined,
      caloriesNote: undefined };
    if (recipe.caloriesInfo) recipe.caloriesInfo = { ...recipe.caloriesInfo, fingerprint: recipeFingerprint(recipe) };
    const adapted = !!root.linkedRecipeIds?.length || recipeFingerprint(recipe) !== recipeFingerprint(root);
    values[String(target)] = { recipe, composed, local, cookingNotes: [...new Set(cookingNotes)], adapted };
  }
  return { kind: sweet ? "sucre" : "sale", initial, signature: JSON.stringify(base.sections.map(section => [section.recipeId, section.ingredients])), values };
}

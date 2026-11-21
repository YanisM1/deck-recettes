import type { Recipe } from "../types";
import { composeRecipes, type ComposedRecipe } from "./compositeRecipes";
import { createLocalRecipeAdaptations, scaleRecipeIngredients } from "./recipeAdaptation";
import { readRecipeAdaptations, recipeAiKind, recipeAiVariantInput, recipeFingerprint, PAN_TARGETS, SERVING_TARGETS, type RecipeAiData } from "./recipeAiTypes";

export const usesPanSizes = (recipe: Recipe) => recipeAiKind(recipe) === "sucre";
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
    return [recipe.id, readRecipeAdaptations(recipe.aiScalingData, recipe) ?? createLocalRecipeAdaptations(recipe)];
  }));
  const sweet = usesPanSizes(root);
  const initial = sweet ? root.panSize ?? 26 : root.servings ?? 2;
  const targets = sweet ? PAN_TARGETS : [...new Set([...SERVING_TARGETS, initial])];
  const values: Record<string, RecipeDisplay> = {};
  for (const target of targets) {
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
      if (factor === 1) {
        selected = component;
      } else if (variant && matchingTarget !== undefined) {
        selected = { ...component, ...recipeAiVariantInput(component, variant, matchingTarget) };
        local ||= data!.source === "local";
        if (variant.cookingNote) cookingNotes.push(components.length > 1 ? `${component.title} : ${variant.cookingNote}` : variant.cookingNote);
      } else {
        local = true;
        const ingredients = scaleRecipeIngredients(component, factor, { pastry: sweet || componentSweet });
        selected = { ...component, ingredients };
        cookingNotes.push(`${components.length > 1 ? component.title + " : " : ""}Adaptation locale indicative de l’ensemble ; vérifiez les pièces entières et la cuisson.`);
      }
      if (component.id === root.id && factor !== 1) {
        selected = { ...selected, ...(sweet ? { isCake: true, panSize: target as 20 | 26 | 28 } : { servings: target }) };
      }
      return selected;
    });
    const selectedRoot = adaptedComponents.find(recipe => recipe.id === root.id)!;
    const composed = composeRecipes(selectedRoot, adaptedComponents);
    const recipe: Recipe = { ...selectedRoot, ingredients: composed.ingredients, steps: composed.steps, linkedRecipeIds: undefined,
      aiScalingData: undefined };
    const adapted = !!root.linkedRecipeIds?.length || recipeFingerprint(recipe) !== recipeFingerprint(root);
    values[String(target)] = { recipe, composed, local, cookingNotes: [...new Set(cookingNotes)], adapted };
  }
  return { kind: sweet ? "sucre" : "sale", initial, signature: JSON.stringify(base.sections.map(section => [section.recipeId, section.ingredients])), values };
}

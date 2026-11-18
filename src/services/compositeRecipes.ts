import type { Recipe } from "../types";
import { hasFreshCalories, isCaloriesInfo, recipeFingerprint, type CaloriesInfo } from "./calorieAnalysis";

export const MAX_LINKED_RECIPES = 20;
export const MAX_COMPOSITE_RECIPES = 64;
const MAX_DEPTH = 20;
const RECIPE_ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export type CompositeRecipe = Recipe & {
  servings?: number;
  linkedRecipeIds?: string[];
  caloriesInfo?: CaloriesInfo;
};
export type CompositeSection = {
  recipeId: string;
  title: string;
  isBase: boolean;
  ingredients: string[];
  steps: string[];
};
export type CompositeWarning = {
  type: "missing" | "cycle" | "duplicate" | "invalid" | "limit";
  recipeId: string;
  message: string;
};
export type ComposedRecipe = {
  sections: CompositeSection[];
  ingredients: string[];
  steps: string[];
  assemblyStep?: string;
  linkedRecipeIds: string[];
  warnings: CompositeWarning[];
  caloriesInfo?: CaloriesInfo;
  caloriesUnavailableReason?: string;
};

export function normalizeLinkedRecipeIds(value: unknown, rootId?: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_LINKED_RECIPES)
    throw new Error(`Choisissez au maximum ${MAX_LINKED_RECIPES} recettes à lier.`);
  const ids: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string" || !RECIPE_ID.test(raw.trim()))
      throw new Error("Une recette liée possède un identifiant invalide.");
    const id = raw.trim().toLowerCase();
    if (id === rootId?.toLowerCase())
      throw new Error("Une recette ne peut pas être liée à elle-même.");
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Validate against this cookbook only. No lookup or data from another cookbook. */
export function validateRecipeLinks(rootId: string | undefined, linkedIds: readonly string[], recipes: readonly CompositeRecipe[]): void {
  const ids = normalizeLinkedRecipeIds(linkedIds, rootId);
  const root = rootId ?? "new-recipe";
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const visited = new Set<string>(), path = new Set([root]);
  const visit = (id: string, depth: number) => {
    if (path.has(id)) throw new Error("Cette liaison formerait une boucle entre les recettes.");
    if (visited.has(id)) return;
    if (depth > MAX_DEPTH || visited.size >= MAX_COMPOSITE_RECIPES - 1)
      throw new Error("Cet assemblage contient trop de recettes imbriquées.");
    const recipe = byId.get(id);
    if (!recipe) throw new Error("Une recette liée n’est plus disponible dans ce carnet.");
    visited.add(id);
    path.add(id);
    const links = id === root ? ids : normalizeLinkedRecipeIds(recipe.linkedRecipeIds, id);
    for (const next of links) visit(next, depth + 1);
    path.delete(id);
  };
  for (const id of ids) visit(id, 1);
}

/** Components are complete written batches. Scale the whole assembly by root servings. */
export function composeRecipes(root: CompositeRecipe, recipes: readonly CompositeRecipe[]): ComposedRecipe {
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  byId.set(root.id, root); // An unsaved editor draft takes precedence over its stored base.
  const sections: CompositeSection[] = [], components: CompositeRecipe[] = [], warnings: CompositeWarning[] = [];
  const visited = new Set<string>(), path = new Set<string>();
  const visit = (id: string, depth: number) => {
    if (path.has(id)) {
      warnings.push({ type: "cycle", recipeId: id, message: "Une boucle de recettes liées a été ignorée. Corrigez les liaisons avant le calcul global." });
      return;
    }
    if (visited.has(id)) {
      warnings.push({ type: "duplicate", recipeId: id, message: `« ${byId.get(id)?.title ?? "Recette"} » est déjà incluse et n’est comptée qu’une fois.` });
      return;
    }
    if (depth > MAX_DEPTH || visited.size >= MAX_COMPOSITE_RECIPES) {
      warnings.push({ type: "limit", recipeId: id, message: "L’assemblage contient trop de recettes imbriquées ; son affichage est incomplet." });
      return;
    }
    const recipe = byId.get(id);
    if (!recipe) {
      warnings.push({ type: "missing", recipeId: id, message: "Une recette liée a été supprimée ou n’est pas disponible dans ce carnet." });
      return;
    }
    visited.add(id);
    path.add(id);
    components.push(recipe);
    sections.push({ recipeId: recipe.id, title: recipe.title, isBase: id === root.id, ingredients: [...recipe.ingredients], steps: [...recipe.steps] });
    try {
      for (const next of normalizeLinkedRecipeIds(recipe.linkedRecipeIds)) visit(next, depth + 1);
    } catch {
      warnings.push({ type: "invalid", recipeId: id, message: `Les liaisons de « ${recipe.title} » sont invalides ; certaines préparations manquent.` });
    }
    path.delete(id);
  };
  visit(root.id, 0);
  const ingredients = sections.flatMap(section => section.ingredients);
  const assemblyStep = sections.length > 1 ? "Assembler les préparations selon les indications de la recette de base." : undefined;
  const steps = sections.flatMap(section => section.steps);
  if (assemblyStep) steps.push(assemblyStep);
  const result: ComposedRecipe = { sections, ingredients, steps, assemblyStep, linkedRecipeIds: sections.slice(1).map(section => section.recipeId), warnings };
  if (warnings.some(warning => warning.type !== "duplicate")) {
    result.caloriesUnavailableReason = "L’assemblage est incomplet : ses calories globales ne peuvent pas être calculées.";
    return result;
  }
  const missingAnalysis = components.find(recipe => !hasFreshCalories(recipe) || !recipe.caloriesInfo?.model.startsWith("gemini-"));
  if (missingAnalysis) {
    result.caloriesUnavailableReason = `Analyse à calculer ou à actualiser pour « ${missingAnalysis.title} ».`;
    return result;
  }
  if (components.length === 1) {
    result.caloriesInfo = root.caloriesInfo;
    return result;
  }
  const totalKcal = components.reduce((sum, recipe) => sum + recipe.caloriesInfo!.totalKcal, 0);
  const cookedWeightGrams = components.reduce((sum, recipe) => sum + recipe.caloriesInfo!.cookedWeightGrams, 0);
  const cake = root.isCake === true || root.caloriesInfo!.type === "gateau";
  const kcal = Math.round(cake ? totalKcal / 8 : totalKcal / cookedWeightGrams * 100);
  if (![totalKcal, cookedWeightGrams].every(value => Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER) || !Number.isSafeInteger(kcal) || kcal < 0) {
    result.caloriesUnavailableReason = "Les valeurs de cet assemblage dépassent les limites de calcul.";
    return result;
  }
  const combined: CaloriesInfo = {
    type: cake ? "gateau" : "plat_sale",
    basis: cake ? "part" : "100g",
    totalKcal, cookedWeightGrams, kcal,
    ...(cake ? { parts: 8 as const } : {}),
    estimated: true,
    assumptions: ["Addition des préparations complètes, sans compter deux fois une recette liée.", ...new Set(components.flatMap(recipe => recipe.caloriesInfo!.assumptions))].slice(0, 8),
    analyzedAt: components.map(recipe => recipe.caloriesInfo!.analyzedAt).sort()[0],
    model: "composite-v1",
    // Distinct from the base analysis: never persist this computed result on root.
    fingerprint: recipeFingerprint({ ...root, ingredients, steps }),
  };
  if (isCaloriesInfo(combined)) result.caloriesInfo = combined;
  else result.caloriesUnavailableReason = "Les valeurs de cet assemblage dépassent les limites de calcul.";
  return result;
}

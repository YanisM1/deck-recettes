import { cakeFields, isPanSize, type PanSize, type Recipe } from "../types";
import { isRecipe } from "./recipeStore";
import { normalizeLinkedRecipeIds } from "./compositeRecipes";
import { readManualCalories } from "./manualCalories";
import { readRecipeAdaptations, type RecipeAiData } from "./recipeAiTypes";

export type RecipeRow = {
  sync_key: string;
  id: string;
  title: string;
  category: Recipe["category"];
  ingredients: string[];
  steps: string[];
  image_url: string;
  created_at: string;
  updated_at: string;
  is_cake?: boolean | null;
  pan_size?: PanSize | null;
  servings?: number;
  linked_recipe_ids?: string[];
  calories_value?: number | null;
  calories_unit?: string | null;
  ai_scaling_data?: RecipeAiData | null;
};

type DatabaseError = { code?: string; message?: string };
export const BASE_RECIPE_COLUMNS = "id,title,category,ingredients,steps,image_url,created_at,updated_at";
const OPTIONAL_COLUMNS = {
  cake: ["is_cake", "pan_size"],
  servings: ["servings"],
  links: ["linked_recipe_ids"],
  calories: ["calories_value", "calories_unit"],
  adaptations: ["ai_scaling_data"],
} as const;
type Feature = keyof typeof OPTIONAL_COLUMNS;
const allFeatures = Object.keys(OPTIONAL_COLUMNS) as Feature[];

function missingFeature(error: DatabaseError, features: Set<Feature>) {
  if (!["42703", "PGRST204"].includes(error.code ?? "")) return undefined;
  const message = error.message ?? "";
  return [...features].find(feature => OPTIONAL_COLUMNS[feature].some(field => message.includes(field)));
}

export function toRecipeRow(recipe: Recipe, key: string, features: ReadonlySet<Feature> = new Set(allFeatures)): RecipeRow {
  const { id, title, category, ingredients, steps, image_url, created_at, updated_at } = recipe;
  const cake = cakeFields(recipe);
  const calories = readManualCalories(recipe.caloriesValue, recipe.caloriesUnit);
  return {
    sync_key: key, id, title, category, ingredients, steps, image_url, created_at, updated_at,
    ...(features.has("cake") ? { is_cake: cake.isCake, pan_size: cake.panSize ?? null } : {}),
    ...(features.has("servings") ? { servings: recipe.servings ?? 2 } : {}),
    ...(features.has("links") ? { linked_recipe_ids: normalizeLinkedRecipeIds(recipe.linkedRecipeIds, id) } : {}),
    ...(features.has("calories") ? { calories_value: calories?.caloriesValue ?? null, calories_unit: calories?.caloriesUnit ?? null } : {}),
    ...(features.has("adaptations") ? { ai_scaling_data: readRecipeAdaptations(recipe.aiScalingData, recipe) ?? null } : {}),
  };
}

export function fromRecipeRow(row: unknown): Recipe {
  if (!isRecipe(row)) throw new Error("Réponse invalide");
  const raw = row as RecipeRow;
  const {
    id, title, category, ingredients, steps, image_url, created_at, updated_at,
    is_cake, pan_size, servings, linked_recipe_ids, calories_value, calories_unit, ai_scaling_data,
  } = raw;
  const calories = readManualCalories(calories_value, calories_unit);
  const recipe: Recipe = {
    id, title, category, ingredients, steps, image_url, created_at, updated_at,
    isCake: is_cake === true || isPanSize(pan_size),
    panSize: isPanSize(pan_size) ? pan_size : undefined,
    servings: Number.isInteger(servings) && servings! >= 1 && servings! <= 999 ? servings : 2,
    linkedRecipeIds: normalizeLinkedRecipeIds(linked_recipe_ids, id),
    ...(calories ?? (calories_value === null && calories_unit === null ? { caloriesValue: null, caloriesUnit: null } : {})),
  };
  const adaptations = readRecipeAdaptations(ai_scaling_data, recipe);
  if (adaptations) recipe.aiScalingData = adaptations;
  return recipe;
}

export async function readCompatible(
  read: (columns: string) => PromiseLike<{ data: unknown[] | null; error: DatabaseError | null }>,
): Promise<Recipe[]> {
  const features = new Set(allFeatures);
  for (;;) {
    const columns = [BASE_RECIPE_COLUMNS, ...[...features].flatMap(feature => OPTIONAL_COLUMNS[feature])].join(",");
    const { data, error } = await read(columns);
    if (!error) {
      if (!data) throw new Error("Réponse invalide");
      return data.map(fromRecipeRow);
    }
    const missing = missingFeature(error, features);
    if (!missing) throw error;
    features.delete(missing);
  }
}

export async function saveCompatible(
  recipe: Recipe,
  key: string,
  write: (row: RecipeRow) => PromiseLike<{ error: DatabaseError | null }>,
): Promise<void> {
  const features = new Set(allFeatures);
  for (;;) {
    const { error } = await write(toRecipeRow(recipe, key, features));
    if (!error) break;
    const missing = missingFeature(error, features);
    if (!missing) throw error;
    features.delete(missing);
  }
  const unsynced =
    (!features.has("cake") && (recipe.isCake || recipe.panSize)) ||
    (!features.has("servings") && (recipe.servings ?? 2) !== 2) ||
    (!features.has("links") && recipe.linkedRecipeIds?.length) ||
    (!features.has("calories") && readManualCalories(recipe.caloriesValue, recipe.caloriesUnit)) ||
    (!features.has("adaptations") && recipe.aiScalingData);
  if (unsynced) {
    throw new Error("Les informations complémentaires restent sur cet appareil en attendant la mise à jour de la base.");
  }
}

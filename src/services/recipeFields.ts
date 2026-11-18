import { cakeFields, isPanSize, type PanSize, type Recipe } from "../types";
import { isRecipe } from "./recipeStore";
import { hasFreshCalories, type CaloriesInfo } from "./calorieAnalysis";
export type RecipeRow = Omit<Recipe, "isCake" | "panSize" | "caloriesInfo"> & {
  sync_key: string; is_cake?: boolean | null; pan_size?: PanSize | null;
  calories_info?: CaloriesInfo | null;
};
type DatabaseError = { code?: string; message?: string };
export const BASE_RECIPE_COLUMNS = "id,title,category,ingredients,steps,image_url,created_at,updated_at";
const CAKE_COLUMNS = `${BASE_RECIPE_COLUMNS},is_cake,pan_size`;
const FULL_COLUMNS = `${CAKE_COLUMNS},servings,calories_info`;
const missingColumn = (error: DatabaseError | null, pattern: RegExp) => !!error && ["42703", "PGRST204"].includes(error.code || "") && pattern.test(error.message || "");
export const missingCakeColumns = (error: DatabaseError | null) => missingColumn(error, /is_cake|pan_size/);
const missingNutrition = (error: DatabaseError | null) => missingColumn(error, /servings|calories_info/);
export function toRecipeRow(recipe: Recipe, key: string, includeCake = true, includeNutrition = includeCake): RecipeRow {
  const { isCake, panSize, caloriesInfo, servings, ...legacy } = recipe;
  const normalized = cakeFields({ isCake, panSize });
  return {
    ...legacy, sync_key: key,
    ...(includeCake ? { is_cake: normalized.isCake, pan_size: normalized.panSize ?? null } : {}),
    ...(includeNutrition ? { servings: servings ?? 2, calories_info: hasFreshCalories(recipe) ? caloriesInfo! : null } : {}),
  };
}
export function fromRecipeRow(row: unknown): Recipe {
  if (!isRecipe(row)) throw new Error("Réponse invalide");
  const raw = row as RecipeRow;
  const { is_cake, pan_size, sync_key, calories_info, servings, ...legacy } = raw;
  const recipe: Recipe = {
    ...legacy,
    isCake: is_cake === true || isPanSize(pan_size),
    panSize: isPanSize(pan_size) ? pan_size : undefined,
    servings: Number.isInteger(servings) && servings! >= 1 && servings! <= 999 ? servings : 2,
    caloriesInfo: calories_info ?? undefined,
  };
  if (!hasFreshCalories(recipe)) recipe.caloriesInfo = undefined;
  return recipe;
}
export async function readCompatible(read: (columns: string) => PromiseLike<{ data: unknown[] | null; error: DatabaseError | null }>): Promise<Recipe[]> {
  let result = await read(FULL_COLUMNS);
  if (missingNutrition(result.error)) result = await read(CAKE_COLUMNS);
  if (missingCakeColumns(result.error)) result = await read(BASE_RECIPE_COLUMNS);
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Réponse invalide");
  return result.data.map(fromRecipeRow);
}
export async function saveCompatible(recipe: Recipe, key: string, write: (row: RecipeRow) => PromiseLike<{ error: DatabaseError | null }>): Promise<void> {
  let result = await write(toRecipeRow(recipe, key));
  if (!result.error) return;
  let nutritionLost = false, cakeLost = false;
  if (missingNutrition(result.error)) {
    nutritionLost = true;
    result = await write(toRecipeRow(recipe, key, true, false));
  }
  if (missingCakeColumns(result.error)) {
    nutritionLost = cakeLost = true;
    result = await write(toRecipeRow(recipe, key, false, false));
  }
  if (result.error) throw result.error;
  if ((nutritionLost && (recipe.caloriesInfo || (recipe.servings ?? 2) !== 2)) || (cakeLost && (recipe.isCake || recipe.panSize)))
    throw new Error("Les informations complémentaires restent sur cet appareil en attendant la mise à jour de la base.");
}

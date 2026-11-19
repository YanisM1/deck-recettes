import type { CaloriesInfo } from "./services/calorieAnalysis";
import type { RecipeAiData } from "./services/recipeAiTypes";
export type Category = "sale" | "sucre";
export type LayoutMode = "cards" | "book";
export type PanSize = 20 | 26 | 28;
export const PAN_SIZES: readonly PanSize[] = [20, 26, 28];
export const isPanSize = (value: unknown): value is PanSize =>
  PAN_SIZES.some((size) => size === value);
export function cakeFields(input: { isCake?: boolean; panSize?: unknown }) {
  const isCake = input.isCake ?? isPanSize(input.panSize);
  if (isCake && input.panSize != null && !isPanSize(input.panSize))
    throw new Error("Choisissez un moule de 20, 26 ou 28 cm.");
  return {
    isCake,
    panSize: isCake && isPanSize(input.panSize) ? input.panSize : undefined,
  };
}
export interface Recipe {
  id: string;
  title: string;
  category: Category;
  ingredients: string[];
  steps: string[];
  image_url: string;
  created_at: string;
  updated_at: string;
  isCake?: boolean;
  panSize?: PanSize;
  servings?: number;
  caloriesInfo?: CaloriesInfo;
  caloriesValue?: number;
  caloriesUnit?: "kcal / part (1/8)" | "kcal / 100g";
  caloriesNote?: string;
  aiScalingData?: RecipeAiData;
  linkedRecipeIds?: string[];
}
export type RecipeInput = Pick<
  Recipe,
  | "title"
  | "category"
  | "ingredients"
  | "steps"
  | "image_url"
  | "isCake"
  | "panSize"
  | "servings"
  | "caloriesInfo"
  | "caloriesValue"
  | "caloriesUnit"
  | "caloriesNote"
  | "aiScalingData"
  | "linkedRecipeIds"
>;
export type Filters = Record<Category, boolean>;
export const filterRecipes = (recipes: Recipe[], filters: Filters) =>
  recipes.filter((recipe) => filters[recipe.category]);

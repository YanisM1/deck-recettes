import type { Recipe } from "../types";
import { hasFreshCalories } from "./calorieAnalysis";
import { hasFreshRecipeAi } from "./recipeAiTypes";

/** Display columns are projections, never an independent stale calorie cache. */
export function recipeAiMetadata(recipe: Recipe) {
  const aiScalingData = hasFreshRecipeAi(recipe) ? recipe.aiScalingData : undefined;
  const caloriesInfo = aiScalingData?.caloriesInfo ?? (hasFreshCalories(recipe) ? recipe.caloriesInfo : undefined);
  return {
    aiScalingData,
    caloriesInfo,
    caloriesValue: caloriesInfo?.kcal,
    caloriesUnit: caloriesInfo ? (caloriesInfo.basis === "part" ? "kcal / part (1/8)" : "kcal / 100g") as Recipe["caloriesUnit"] : undefined,
    caloriesNote: caloriesInfo
      ? (aiScalingData?.note || (caloriesInfo.basis === "part" ? `Base moule ${recipe.panSize ?? 26} cm, coupé en 8` : "Pour 100 g du plat cuisiné, poids cuit estimé")).slice(0, 500)
      : undefined,
  };
}

export function withRecipeAiMetadata(recipe: Recipe): Recipe {
  return { ...recipe, ...recipeAiMetadata(recipe) };
}

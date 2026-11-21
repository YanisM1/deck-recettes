import { Flame } from "lucide-react";
import { formatManualCalories, type ManualCaloriesFields } from "../services/manualCalories";

export function CaloriesBadge({ recipe, className = "" }: {
  recipe: ManualCaloriesFields;
  className?: string;
}) {
  const label = formatManualCalories(recipe.caloriesValue, recipe.caloriesUnit);
  if (!label) return null;
  return <span className={`calories-badge ${className}`}>
    <Flame size={12} aria-hidden="true" /><span>{label}</span>
  </span>;
}

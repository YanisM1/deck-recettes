import { Flame } from "lucide-react";
import { hasFreshCalories, type AnalysisInput, type CaloriesInfo } from "../services/calorieAnalysis";

export function CaloriesBadge({ recipe, className = "" }: {
  recipe: AnalysisInput & { caloriesInfo?: CaloriesInfo };
  className?: string;
}) {
  if (!hasFreshCalories(recipe)) return null;
  const info = recipe.caloriesInfo!;
  const value = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(info.kcal);
  const label = info.basis === "part" ? `~${value} kcal / part` : `~${value} kcal / 100 g`;
  return <span className={`calories-badge ${className}`} title={info.basis === "part" ? "Estimation IA pour 1 part sur 8" : "Estimation IA pour 100 g du plat cuit"}>
    <Flame size={12} aria-hidden="true" />{label}
  </span>;
}

import { Flame } from "lucide-react";
import { hasFreshCalories, type AnalysisInput, type CaloriesInfo } from "../services/calorieAnalysis";

export function CaloriesBadge({ recipe, className = "", showMissing = false }: {
  recipe: AnalysisInput & { caloriesInfo?: CaloriesInfo };
  className?: string;
  showMissing?: boolean;
}) {
  if (!hasFreshCalories(recipe)) return showMissing ? <span className={`calories-badge calories-badge-missing ${className}`}
    title="Ouvrez la fiche pour calculer les calories et les portions avec l’IA.">
    <Flame size={12} aria-hidden="true" />Calories à calculer
  </span> : null;
  const info = recipe.caloriesInfo!;
  const value = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(info.kcal);
  const label = info.basis === "part" ? `~${value} kcal / part` : `~${value} kcal / 100 g`;
  return <span className={`calories-badge ${className}`} title={info.basis === "part" ? "Estimation pour 1 part sur 8" : "Estimation pour 100 g du plat cuit"}>
    <Flame size={12} aria-hidden="true" />{label}
  </span>;
}

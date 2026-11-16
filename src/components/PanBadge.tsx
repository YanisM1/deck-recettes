import { CakeSlice } from "lucide-react";
import { isPanSize, type Recipe } from "../types";
export function PanBadge({
  recipe,
  className = "",
}: {
  recipe: Pick<Recipe, "panSize">;
  className?: string;
}) {
  return isPanSize(recipe.panSize) ? (
    <span className={`pan-badge ${className}`}>
      <CakeSlice size={12} aria-hidden="true" />
      Moule {recipe.panSize} cm
    </span>
  ) : null;
}

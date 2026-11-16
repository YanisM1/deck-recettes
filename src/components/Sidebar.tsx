import { Plus, Pizza, CakeSlice } from "lucide-react";
import type { Filters } from "../types";
function RibbonOutline() {
  return (
    <svg
      className="ribbon-outline"
      viewBox="0 0 49 70"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="ribbon-silhouette" d="M1 1H48V69L24.5 58L1 69Z" />
      <path className="ribbon-stitch" d="M7 8H42" />
    </svg>
  );
}
export function Sidebar({
  filters,
  onToggle,
  onAdd,
}: {
  filters: Filters;
  onToggle: (category: keyof Filters) => void;
  onAdd: () => void;
}) {
  return (
    <aside className="side-controls" aria-label="Choix des recettes">
      <button
        className="side-button filter-button filter-sale"
        aria-label="Salé"
        title="Recettes salées"
        aria-pressed={filters.sale}
        onClick={() => onToggle("sale")}
      >
        <RibbonOutline />
        <Pizza
          className="sidebar-icon"
          size={24}
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </button>
      <button
        className="side-button filter-button filter-sucre"
        aria-label="Sucré"
        title="Recettes sucrées"
        aria-pressed={filters.sucre}
        onClick={() => onToggle("sucre")}
      >
        <RibbonOutline />
        <CakeSlice
          className="sidebar-icon"
          size={24}
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </button>
      <span className="side-divider" />
      <button
        className="side-button add-button"
        aria-label="Ajouter une recette"
        onClick={onAdd}
      >
        <RibbonOutline />
        <Plus
          className="sidebar-icon"
          size={24}
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </button>
    </aside>
  );
}

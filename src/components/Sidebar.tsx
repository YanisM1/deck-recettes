import { Plus } from "lucide-react";
import type { Filters } from "../types";
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
        className="filter-button filter-sale"
        aria-pressed={filters.sale}
        onClick={() => onToggle("sale")}
      >
        <span>Salé</span>
      </button>
      <button
        className="filter-button filter-sucre"
        aria-pressed={filters.sucre}
        onClick={() => onToggle("sucre")}
      >
        <span>Sucré</span>
      </button>
      <span className="side-divider" />
      <button
        className="add-button"
        aria-label="Ajouter une recette"
        onClick={onAdd}
      >
        <Plus size={23} strokeWidth={1.5} />
      </button>
    </aside>
  );
}

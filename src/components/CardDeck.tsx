import { ArrowLeft, ArrowRight, MoveHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import type { Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { useDeckNavigation } from "../hooks/useDeckNavigation";
export function CardDeck({
  recipes,
  onOpen,
}: {
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
}) {
  const { index, direction, go, scene, gestures } = useDeckNavigation(
    recipes.length,
  );
  const depths = Array.from(
    { length: Math.min(4, recipes.length) },
    (_, depth) => depth,
  ).reverse();
  return (
    <>
      <div
        className="deck-scene"
        ref={scene}
        {...gestures}
        aria-label="Paquet de recettes"
      >
        {depths.map((depth) => {
          const recipe =
            recipes[
              depth === 0
                ? index
                : Math.min(
                    recipes.length - 1,
                    Math.max(0, index + (direction || 1) * depth),
                  )
            ];
          return (
            <button
              key={depth === 0 ? `top-${recipe.id}` : depth}
              tabIndex={depth === 0 ? 0 : -1}
              aria-hidden={depth > 0}
              aria-label={`Lire ${recipe.title}`}
              className={`recipe-card card-depth-${depth} ${depth === 0 && direction ? (direction > 0 ? "dealing-forward" : "dealing-backward") : ""}`}
              style={{ "--depth": depth } as CSSProperties}
              onClick={() => {
                if (!direction) onOpen(recipe);
              }}
            >
              <RecipeImage
                key={recipe.image_url}
                src={recipe.image_url}
                alt={recipe.title}
                className="card-photo"
              />
              <span className="card-shade" />
              <span className="category-badge">
                {recipe.category === "sale" ? "SALÉ" : "SUCRÉ"}
              </span>
              <span className="card-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="card-copy">
                <span className="card-overline">
                  FAIT MAISON, TOUT SIMPLEMENT
                </span>
                <span className="card-title">{recipe.title}</span>
                <span className="card-open">
                  Découvrir la recette <ArrowRight size={15} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="deck-footer">
        <div className="deck-pagination">
          <button
            className="small-icon"
            aria-label="Recette précédente"
            disabled={index === 0 || !!direction}
            onClick={() => go(-1)}
          >
            <ArrowLeft size={17} />
          </button>
          <p aria-live="polite">
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <span> / </span>
            {String(recipes.length).padStart(2, "0")}
          </p>
          <button
            className="small-icon"
            aria-label="Recette suivante"
            disabled={index === recipes.length - 1 || !!direction}
            onClick={() => go(1)}
          >
            <ArrowRight size={17} />
          </button>
        </div>
        <p className="gesture-hint">
          <MoveHorizontal size={14} /> Glissez. Choisissez. Cuisinez.
        </p>
      </div>
    </>
  );
}

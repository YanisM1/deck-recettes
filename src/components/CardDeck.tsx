import { ArrowLeft, ArrowRight, Layers, MoveHorizontal } from "lucide-react";
import { memo, useRef } from "react";
import type { Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { PanBadge } from "./PanBadge";
import { CaloriesBadge } from "./CaloriesBadge";
import { MOTION_TRANSITION, useDirectNavigation } from "../hooks/useDirectNavigation";

const stackTransform = (depth: number) => `translate3d(0, ${depth * 7}px, 0) rotate3d(0, 0, 1, ${depth * 2}deg) scale3d(${1 - depth * 0.025}, ${1 - depth * 0.025}, 1)`;
const movingTransform = (x: number, y = Math.abs(x) * 0.04, angle = x * 0.05) => `translate3d(${x}px, ${y}px, 0) rotate3d(0, 0, 1, ${angle}deg) scale3d(1, 1, 1)`;

export const CardDeck = memo(function CardDeck({ recipes, onOpen }: { recipes: Recipe[]; onOpen: (recipe: Recipe) => void }) {
  const layers = useRef(new Map<number, HTMLDivElement>());
  const { index, go, reset, scene, gestures, isBusy } = useDirectNavigation({
    maxIndex: recipes.length, gestureSign: 1, extent: 420,
    paint: (dx, direction, animate) => {
      const progress = Math.min(1, Math.abs(dx) / 420);
      layers.current.forEach((element, itemIndex) => {
        const offset = itemIndex - index;
        element.style.transition = animate ? MOTION_TRANSITION : "none";
        if (offset === -1) {
          const x = direction === -1 ? Math.max(0, 420 + dx) : 420;
          element.style.transform = animate && direction === -1 && dx !== 0 ? movingTransform(0) : `translate3d(calc(150% - ${420 - x}px), ${x / 420 * 20}px, 0) rotate3d(0, 0, 1, ${x / 420 * 14}deg)`;
          element.style.opacity = direction === -1 ? "1" : "0";
        } else if (offset === 0) {
          element.style.transform = direction === 1
            ? animate && dx !== 0 ? "translate3d(150%, 20px, 0) rotate3d(0, 0, 1, 14deg)" : movingTransform(dx)
            : stackTransform(0);
          element.style.opacity = "1";
        } else {
          element.style.transform = stackTransform(offset - (direction === 1 ? progress : 0));
          element.style.opacity = "1";
        }
      });
    },
  });
  const offsets = [-1, 0, 1, 2].filter(offset => index + offset >= 0 && index + offset <= recipes.length);
  return <>
    <div className="deck-scene" ref={scene} {...gestures} aria-label="Paquet de recettes" data-active-index={index}>
      {offsets.map(offset => {
        const itemIndex = index + offset, recipe = recipes[itemIndex], active = offset === 0;
        return <div key={recipe?.id ?? "deck-end"} ref={element => { if (element) layers.current.set(itemIndex, element); else layers.current.delete(itemIndex); }}
          className={`recipe-card card-depth-${offset}${recipe ? "" : " deck-end-card"}`}
          data-layer={offset} data-motion-offset={offset} data-recipe-id={recipe?.id} aria-hidden={!active} inert={!active}
          style={{ zIndex: offset === -1 ? 6 : 5 - offset }}>
          {recipe ? <button className="card-open-area" tabIndex={active ? 0 : -1} aria-label={`Lire ${recipe.title}`} onClick={() => { if (!isBusy()) onOpen(recipe); }}>
            <RecipeImage key={recipe.image_url} src={recipe.image_url} alt={recipe.title} className="card-photo" />
            <span className="card-shade" />
            <span className="category-badge">{recipe.category === "sale" ? "SALÉ" : "SUCRÉ"}</span>
            <PanBadge recipe={recipe} className="card-pan-badge" />
            <CaloriesBadge recipe={recipe} className={`card-calories-badge${recipe.panSize ? " with-pan" : ""}`} />
            <span className="card-number">{String(itemIndex + 1).padStart(2, "0")}</span>
            <span className="card-copy"><span className="card-overline">FAIT MAISON, TOUT SIMPLEMENT</span>
              <span className="card-title">{recipe.title}</span>
              <span className="card-open">Découvrir la recette <ArrowRight size={15} /></span>
            </span>
          </button> : <div className="deck-end-content">
            <Layers size={38} aria-hidden="true" />
            <p className="end-overline">LES BELLES CHOSES SE PARTAGENT</p>
            <h2>Fin du paquet</h2>
            <p>Toutes les recettes ont été vues</p>
            <button className="deck-reset" tabIndex={active ? 0 : -1} onClick={reset}>🔄 Revenir au début</button>
          </div>}
        </div>;
      })}
    </div>
    <div className="deck-footer"><div className="deck-pagination">
      <button className="small-icon" aria-label="Recette précédente" disabled={index === 0} onClick={() => go(-1)}><ArrowLeft size={17} /></button>
      <p aria-live="polite">{index === recipes.length ? "Fin du paquet" : <><strong>{String(index + 1).padStart(2, "0")}</strong><span> / </span>{String(recipes.length).padStart(2, "0")}</>}</p>
      <button className="small-icon" aria-label="Recette suivante" disabled={index === recipes.length} onClick={() => go(1)}><ArrowRight size={17} /></button>
    </div><p className="gesture-hint"><MoveHorizontal size={14} /> Glissez. Choisissez. Cuisinez.</p></div>
  </>;
});

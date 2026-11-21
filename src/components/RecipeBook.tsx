import { ArrowLeft, ArrowRight, BookOpenCheck, MoveHorizontal } from "lucide-react";
import { memo, useRef, type Ref } from "react";
import type { Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { PanBadge } from "./PanBadge";
import { CaloriesBadge } from "./CaloriesBadge";
import { MOTION_TRANSITION, useDirectNavigation } from "../hooks/useDirectNavigation";

const BookPage = memo(function BookPage({ recipe }: { recipe: Recipe }) {
  return (
    <div className="book-page-content">
      <p className="book-running-title">LES BELLES RECETTES DE LA MAISON</p>
      <div className="book-photo-frame">
        <RecipeImage key={recipe.image_url} src={recipe.image_url} alt={recipe.title} />
      </div>
      <h2 className="book-title">{recipe.title}</h2>
      <div className="book-meta">
        <p className="book-category">
          {recipe.category === "sale" ? "Du côté salé" : "Pour la douceur"}
        </p>
        <PanBadge recipe={recipe} className="book-pan-badge" />
        <CaloriesBadge recipe={recipe} className="book-calories-badge" />
      </div>
      <div className="book-flourish" aria-hidden="true"><span>✳</span></div>
      <div className="book-ingredient-preview">
        <p>Dans le panier</p>
        <ul>{recipe.ingredients.slice(0, 2).map((ingredient, index) => (
          <li key={index}>{ingredient}</li>
        ))}</ul>
      </div>
      <p className="book-page-hint">
        Toucher la page pour lire<br />la recette complète.
      </p>
    </div>
  );
});

function BookEnd({ active, reset }: { active: boolean; reset: () => void }) {
  return (
    <div className="book-end-cover">
      <span className="book-end-overline">DECKCHEF · LES RECETTES QU’ON AIME</span>
      <BookOpenCheck size={42} strokeWidth={1.2} aria-hidden="true" />
      <h2>Fin du Livre de Recettes</h2>
      <p>Une dernière page tournée,<br />et tant de bonnes choses à refaire.</p>
      <button type="button" className="book-restart"
        tabIndex={active ? 0 : -1} onClick={reset}>
        📖 Revenir au début du livre
      </button>
      <span className="book-end-ornament" aria-hidden="true">✳</span>
    </div>
  );
}

function RecipeLeaf({ recipe, active, leafRef, offset, onOpen }: {
  recipe: Recipe;
  active: boolean;
  leafRef: Ref<HTMLDivElement>;
  offset: number;
  onOpen: () => void;
}) {
  return (
    <div ref={leafRef} className="book-turn-leaf"
      data-book-layer={offset === 0 ? "current" : offset < 0 ? "previous" : "next"}
      data-motion-offset={offset} data-recipe-id={recipe.id}
      style={{ zIndex: offset < 0 ? 5 : 3 - offset }} aria-hidden={!active} inert={!active}>
      <div className="book-face book-face-front book-paper">
        <button className="book-open" aria-label={`Lire ${recipe.title}`}
          tabIndex={active ? 0 : -1} onClick={onOpen}>
          <BookPage recipe={recipe} />
        </button>
      </div>
      <div className="book-face book-face-back book-paper" aria-hidden="true">
        <span className="book-verso-mark">DeckChef<span>Les recettes qu’on aime.</span></span>
      </div>
    </div>
  );
}

export const RecipeBook = memo(function RecipeBook({ recipes, onOpen }: {
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
}) {
  const layers = useRef(new Map<number, HTMLDivElement>());
  const pageShadow = useRef<HTMLDivElement>(null);
  const { index, go, reset, scene, gestures, isBusy } = useDirectNavigation({
    maxIndex: recipes.length,
    gestureSign: -1,
    extent: 240,
    paint: (dx, direction, animate) => {
      const p = Math.min(1, Math.abs(dx) / 240);
      const transition = animate ? MOTION_TRANSITION : "none";
      layers.current.forEach((element, itemIndex) => {
        const offset = itemIndex - index;
        element.style.transition = transition;
        element.style.visibility = offset < 0 && direction !== -1 ? "hidden" : "visible";
        element.style.transform = `rotateY(${offset < 0 ? -180 + (direction === -1 ? p * 180 : 0) : offset === 0 && direction === 1 ? -p * 180 : 0}deg)`;
      });
      if (pageShadow.current) {
        pageShadow.current.style.transition = transition;
        pageShadow.current.style.opacity = direction === 0 ? "0" : String(Math.sin(p * Math.PI) * 0.55);
        pageShadow.current.style.transform = `translate3d(${-p * 28}%, 0, 0) scale3d(${0.15 + Math.sin(p * Math.PI) * 0.65}, 1, 1)`;
      }
    },
  });
  const atEnd = index === recipes.length;
  const offsets = [-1, 0, 1].filter(offset => index + offset >= 0 && index + offset <= recipes.length);

  return (
    <>
      <div className={`book-scene${atEnd ? " book-at-end" : ""}`} ref={scene}
        {...gestures} aria-label="Livre de recettes" data-active-index={index}>
        <div className="book-cover" aria-hidden="true" />
        {index < recipes.length - 1 && <div className="book-page-stack" aria-hidden="true" />}
        {offsets.map(offset => {
          const itemIndex = index + offset, recipe = recipes[itemIndex], active = offset === 0;
          return recipe ? <RecipeLeaf key={recipe.id} recipe={recipe} active={active} offset={offset}
            leafRef={element => { if (element) layers.current.set(itemIndex, element); else layers.current.delete(itemIndex); }}
            onOpen={() => { if (active && !isBusy()) onOpen(recipe); }} /> :
            <div key="book-end" className="book-end-layer" data-book-layer={active ? "current" : "next"}
              aria-hidden={!active} inert={!active} style={{ zIndex: active ? 3 : 1 }}>
              <BookEnd active={active} reset={reset} />
            </div>;
        })}
        <div ref={pageShadow} className="book-turn-shadow" aria-hidden="true" />
        <div className="book-binding" aria-hidden="true"><span /></div>
        <div className="book-page-navigation" data-gesture-ignore>
          <button className="page-corner" aria-label="Page précédente"
            disabled={index === 0} onClick={() => go(-1)}><ArrowLeft size={16} /></button>
          <p aria-live="polite">{atEnd ? "Fin du livre" : `Page ${index + 1} sur ${recipes.length}`}</p>
          <button className="page-corner next-corner" aria-label="Page suivante"
            disabled={atEnd} onClick={() => go(1)}><ArrowRight size={16} /></button>
        </div>
      </div>
      <div className="book-footer"><p className="gesture-hint">
        <MoveHorizontal size={14} /> Chaque page a quelque chose de bon.
      </p></div>
    </>
  );
});

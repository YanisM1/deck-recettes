import { ArrowLeft, ArrowRight, BookOpenCheck, MoveHorizontal } from "lucide-react";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { PanBadge } from "./PanBadge";
import { SPRING_TRANSITION, useDirectNavigation } from "../hooks/useDirectNavigation";

function BookPage({ recipe }: { recipe: Recipe }) {
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
}

function BookEnd({ active, reset }: { active: boolean; reset: () => void }) {
  return (
    <div className="book-end-cover">
      <span className="book-end-overline">DECKCHEF · LES RECETTES QU’ON AIME</span>
      <BookOpenCheck size={42} strokeWidth={1.2} aria-hidden="true" />
      <h2>Fin du Livre de Recettes</h2>
      <p>Une dernière page tournée,<br />et tant de bonnes choses à refaire.</p>
      <button type="button" className="book-restart" data-gesture-ignore
        tabIndex={active ? 0 : -1} onClick={reset}>
        📖 Revenir au début du livre
      </button>
      <span className="book-end-ornament" aria-hidden="true">✳</span>
    </div>
  );
}

function RecipeLeaf({ recipe, active, leafRef, role, onOpen }: {
  recipe: Recipe;
  active: boolean;
  leafRef: RefObject<HTMLDivElement | null>;
  role: "current" | "previous";
  onOpen: () => void;
}) {
  return (
    <div ref={leafRef} className={`book-turn-leaf book-${role}-leaf`}
      data-book-layer={role} aria-hidden={!active} inert={!active}>
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

export function RecipeBook({ recipes, onOpen }: {
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
}) {
  const currentPage = useRef<HTMLDivElement>(null);
  const previousPage = useRef<HTMLDivElement>(null);
  const pageShadow = useRef<HTMLDivElement>(null);
  const pageWidth = useRef(278);
  const { index, go, reset, scene, gestures, isBusy } = useDirectNavigation({
    maxIndex: recipes.length,
    gestureSign: -1,
    extent: "width",
    paint: (dx, direction, animate) => {
      const p = Math.max(0, Math.min(1, Math.abs(dx) / pageWidth.current));
      const transition = animate ? SPRING_TRANSITION : "none";
      if (currentPage.current) {
        currentPage.current.style.transition = transition;
        currentPage.current.style.transform = `perspective(1800px) rotateY(${direction === 1 ? -p * 180 : 0}deg)`;
      }
      if (previousPage.current) {
        previousPage.current.style.transition = transition;
        previousPage.current.style.transform = `perspective(1800px) rotateY(${direction === -1 ? -180 + p * 180 : -180}deg)`;
        previousPage.current.style.opacity = direction === -1 && (!animate || p > 0) ? "1" : "0";
      }
      if (pageShadow.current) {
        pageShadow.current.style.transition = transition;
        pageShadow.current.style.opacity = direction === 0 ? "0" : String(Math.sin(p * Math.PI) * 0.55);
        pageShadow.current.style.transform = `translate3d(${-p * 28}%, 0, 0) scale3d(${0.15 + Math.sin(p * Math.PI) * 0.65}, 1, 1)`;
      }
    },
  });
  useLayoutEffect(() => {
    const element = scene.current;
    if (!element) return;
    const measure = () => { pageWidth.current = element.getBoundingClientRect().width || 278; };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scene]);
  const atEnd = index === recipes.length;
  const current = recipes[index];
  const previous = recipes[index - 1];
  const next = recipes[index + 1];

  return (
    <>
      <div className={`book-scene${atEnd ? " book-at-end" : ""}`} ref={scene}
        {...gestures} aria-label="Livre de recettes" data-active-index={index}>
        <div className="book-cover" aria-hidden="true" />
        {index < recipes.length - 1 && <div className="book-page-stack" aria-hidden="true" />}
        {!atEnd && <div className="book-underneath" data-book-layer="next" aria-hidden="true" inert>
          {next ? <div className="book-paper"><BookPage recipe={next} /></div> : <BookEnd active={false} reset={reset} />}
        </div>}
        {current ? <RecipeLeaf key={`current-${current.id}`} recipe={current}
          active leafRef={currentPage} role="current"
          onOpen={() => { if (!isBusy()) onOpen(current); }} /> :
          <div className="book-end-layer" data-book-layer="current"><BookEnd active reset={reset} /></div>}
        {previous && <RecipeLeaf key={`previous-${previous.id}`} recipe={previous}
          active={false} leafRef={previousPage} role="previous" onOpen={() => {}} />}
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
}

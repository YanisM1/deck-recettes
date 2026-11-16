import { ArrowLeft, ArrowRight, MoveHorizontal } from "lucide-react";
import type { Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { useDeckNavigation } from "../hooks/useDeckNavigation";
function BookPage({ recipe }: { recipe: Recipe }) {
  return (
    <div className="book-page-content">
      <p className="book-running-title">LES BELLES RECETTES DE LA MAISON</p>
      <div className="book-photo-frame">
        <RecipeImage
          key={recipe.image_url}
          src={recipe.image_url}
          alt={recipe.title}
        />
      </div>
      <h2 className="book-title">{recipe.title}</h2>
      <p className="book-category">
        {recipe.category === "sale" ? "Du côté salé" : "Pour la douceur"}
      </p>
      <div className="book-flourish" aria-hidden="true">
        <span>✳</span>
      </div>
      <div className="book-ingredient-preview">
        <p>Dans le panier</p>
        <ul>
          {recipe.ingredients.slice(0, 2).map((ingredient, index) => (
            <li key={index}>{ingredient}</li>
          ))}
        </ul>
      </div>
      <p className="book-page-hint">
        Toucher la page pour lire
        <br />
        la recette complète.
      </p>
    </div>
  );
}
export function RecipeBook({
  recipes,
  onOpen,
}: {
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
}) {
  const { index, direction, go, scene, gestures } = useDeckNavigation(
    recipes.length,
    680,
    -1,
  );
  const recipe = recipes[index],
    target = recipes[index + direction] || recipe,
    beneath = direction > 0 ? target : recipe,
    flipping = direction > 0 ? recipe : target;
  return (
    <>
      <div
        className={`book-scene ${direction ? "is-turning" : ""}`}
        ref={scene}
        {...gestures}
        aria-label="Livre de recettes"
      >
        <div className="book-cover" aria-hidden="true" />
        <div className="book-page-stack" aria-hidden="true" />
        <div className="book-paper book-underneath">
          <button
            className="book-open"
            disabled={!!direction}
            aria-label={`Lire ${beneath.title}`}
            onClick={() => onOpen(beneath)}
          >
            <BookPage recipe={beneath} />
          </button>
        </div>
        {direction !== 0 && (
          <>
            <div
              className={`book-turn-shadow ${direction < 0 ? "shadow-backward" : ""}`}
              aria-hidden="true"
            />
            <div
              className={`book-turn-leaf ${direction > 0 ? "turn-forward" : "turn-backward"}`}
              aria-hidden="true"
            >
              <div className="book-face book-face-front book-paper">
                <BookPage recipe={flipping} />
              </div>
              <div className="book-face book-face-back book-paper">
                <span className="book-verso-mark">
                  DeckChef<span>Les recettes qu’on aime.</span>
                </span>
              </div>
            </div>
          </>
        )}
        <div className="book-binding" aria-hidden="true">
          <span />
        </div>
        <div className="book-page-navigation">
          <button
            className="page-corner"
            aria-label="Page précédente"
            disabled={index === 0 || !!direction}
            onClick={() => go(-1)}
          >
            <ArrowLeft size={16} />
          </button>
          <p aria-live="polite">
            Page {index + 1} sur {recipes.length}
          </p>
          <button
            className="page-corner next-corner"
            aria-label="Page suivante"
            disabled={index === recipes.length - 1 || !!direction}
            onClick={() => go(1)}
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <div className="book-footer">
        <p className="gesture-hint">
          <MoveHorizontal size={14} /> Chaque page a quelque chose de bon.
        </p>
      </div>
    </>
  );
}

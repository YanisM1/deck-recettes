import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Check, Share } from "lucide-react";
import type { LayoutMode, Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { PanBadge } from "./PanBadge";
import { CaloriesBadge } from "./CaloriesBadge";
import { Modal } from "./Modal";
import { RecipeShareDialog } from "./RecipeShareDialog";
export function RecipeReader({
  recipe,
  onClose,
  onEdit,
  onDelete,
  synchronized = false,
  shared = false,
  layout = "cards",
  themeId,
}: {
  recipe: Recipe;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  synchronized?: boolean;
  shared?: boolean;
  layout?: LayoutMode;
  themeId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [checked, setChecked] = useState<Set<number>>(new Set()),
    [confirming, setConfirming] = useState(false),
    [showShare, setShowShare] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="recipe-reader"
      aria-label={recipe.title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="reader-hero">
        <RecipeImage
          key={recipe.image_url}
          src={recipe.image_url}
          alt={recipe.title}
        />
        <span className="reader-hero-fade" />
      </div>
      <button
        className="reader-back icon-button"
        aria-label="Retour aux recettes"
        onClick={onClose}
      >
        <ArrowLeft size={20} />
      </button>
      <button
        className="reader-share"
        aria-haspopup="dialog"
        onClick={() => setShowShare(true)}
      >
        <Share size={17} aria-hidden="true" /> Partager
      </button>
      <article className="reader-content">
        <p className="reader-category">
          {recipe.category === "sale" ? "Le côté salé" : "La touche sucrée"}
          <span>·</span>Fait maison
          <PanBadge recipe={recipe} className="reader-pan-badge" />
          <CaloriesBadge recipe={recipe} className="reader-calories-badge" />
        </p>
        <h1>{recipe.title}</h1>
        <div className="reader-ornament" aria-hidden="true">
          ✳
        </div>
        <div className="section-heading">
          <h2>Les ingrédients</h2>
          <span>
            {checked.size} / {recipe.ingredients.length}
          </span>
        </div>
        <p className="section-caption">Tout ce qu’il vous faut.</p>
        <ul className="ingredient-list">
          {recipe.ingredients.map((ingredient, index) => (
            <li key={index}>
              <label className={checked.has(index) ? "checked" : ""}>
                <input
                  type="checkbox"
                  checked={checked.has(index)}
                  onChange={() =>
                    setChecked((old) => {
                      const value = new Set(old);
                      if (value.has(index)) value.delete(index);
                      else value.add(index);
                      return value;
                    })
                  }
                />
                <span className="checkbox-art" aria-hidden="true">
                  {checked.has(index) && <Check size={13} />}
                </span>
                <span>{ingredient}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="section-heading preparation-heading">
          <h2>En cuisine</h2>
          <span>{String(recipe.steps.length).padStart(2, "0")} étapes</span>
        </div>
        <p className="section-caption">Un geste après l’autre.</p>
        <ol className="steps-list">
          {recipe.steps.map((step, index) => (
            <li key={index}>
              <span className="step-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <p className="bon-appetit">Et maintenant… bon appétit.</p>
        <div className="recipe-actions">
          <button
            className="primary-button share-recipe-action"
            aria-haspopup="dialog"
            onClick={() => setShowShare(true)}
          >
            <Share size={16} aria-hidden="true" /> Partager la recette
          </button>
          {onEdit && (
            <button className="secondary-button" onClick={onEdit}>
              <Pencil size={16} /> Modifier la recette
            </button>
          )}
          {onDelete && (
            <button className="delete-recipe" onClick={() => setConfirming(true)}>
              <Trash2 size={15} /> Supprimer la recette
            </button>
          )}
        </div>
      </article>
      {showShare && ref.current && (
        <RecipeShareDialog
          recipe={recipe}
          layout={layout}
          themeElement={ref.current}
          themeId={themeId}
          synchronized={synchronized}
          shared={shared}
          onClose={() => setShowShare(false)}
        />
      )}
      {confirming && onDelete && (
        <Modal
          title="Supprimer cette recette ?"
          onClose={() => setConfirming(false)}
        >
          <p className="confirmation-copy">
            « {recipe.title} » sera retirée de votre carnet et des appareils
            synchronisés.
          </p>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
          <div className="confirmation-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirming(false)}
            >
              La garder
            </button>
            <button
              className="danger-button"
              onClick={() => {
                try {
                  onDelete();
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}
    </dialog>
  );
}

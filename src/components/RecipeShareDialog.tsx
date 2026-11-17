import { useState } from "react";
import { ArrowLeft, Image } from "lucide-react";
import type { LayoutMode, Recipe } from "../types";
import { Modal } from "./Modal";
import { RecipeLinkShare } from "./RecipeLinkShare";
import { RecipePhotoShare } from "./RecipePhotoShare";

export function RecipeShareDialog({
  recipe,
  layout,
  themeElement,
  themeId,
  synchronized,
  shared,
  onClose,
}: {
  recipe: Recipe;
  layout: LayoutMode;
  themeElement: HTMLElement;
  themeId?: string;
  synchronized: boolean;
  shared: boolean;
  onClose: () => void;
}) {
  const [showPhoto, setShowPhoto] = useState(false);
  return (
    <Modal
      className="recipe-share-dialog"
      title={showPhoto ? "Partager en photo" : "Partager la recette"}
      onClose={onClose}
    >
      {showPhoto ? (
        <>
          <button className="share-back" onClick={() => setShowPhoto(false)}>
            <ArrowLeft size={16} aria-hidden="true" /> Options de partage
          </button>
          <RecipePhotoShare
            recipe={recipe}
            layout={layout}
            themeElement={themeElement}
            themeId={themeId}
          />
        </>
      ) : (
        <div className="recipe-share-options">
          <button className="share-option" onClick={() => setShowPhoto(true)}>
            <span className="share-option-icon">
              <Image size={20} aria-hidden="true" />
            </span>
            <span>Partager la recette en photo</span>
          </button>
          <RecipeLinkShare recipe={recipe} synchronized={synchronized} shared={shared} />
        </div>
      )}
    </Modal>
  );
}

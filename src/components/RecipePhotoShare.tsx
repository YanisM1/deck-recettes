import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { LayoutMode, Recipe } from "../types";
import { scaleIngredients } from "../utils/recipePortions";
import { MANUAL_CALORIES_LABELS, MANUAL_CALORIES_UNITS, readManualCalories, type ManualCaloriesUnit } from "../services/manualCalories";
import {
  canShareRecipeImage,
  downloadRecipeImage,
  generateRecipeImage,
  shareRecipeImage,
} from "../utils/recipeImageGenerator";

export function RecipePhotoShare({
  recipe,
  layout,
  themeElement,
  themeId,
}: {
  recipe: Recipe;
  layout: LayoutMode;
  themeElement: HTMLElement;
  themeId?: string;
}) {
  const info = readManualCalories(recipe.caloriesValue, recipe.caloriesUnit);
  const initialServings = validServings(String(recipe.servings ?? "")) ? String(recipe.servings) : "";
  const [original, setOriginal] = useState(initialServings);
  const [target, setTarget] = useState(initialServings);
  const [energy, setEnergy] = useState<string | null>(null);
  const [chosenUnit, setChosenUnit] = useState<ManualCaloriesUnit | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [drawingError, setDrawingError] = useState(false);
  const [shareError, setShareError] = useState(false);
  const originalServings = validServings(original);
  const servings = originalServings && (validServings(target) ?? originalServings);
  const unit = chosenUnit ?? info?.caloriesUnit ?? "per_serving";
  const energyInput = energy ?? (info ? String(info.caloriesValue) : "");
  const calories = energyInput === "" ? NaN : Number(energyInput);
  const manualCalories = readManualCalories(calories, unit);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setPreview(null);
    setDrawingError(false);
    setShareError(false);
    const timer = window.setTimeout(() => {
      const ingredients = originalServings && servings
        ? scaleIngredients(recipe.ingredients, originalServings, servings)
        : recipe.ingredients;
      void generateRecipeImage({
        recipe,
        layout,
        themeElement,
        ingredients,
        servings,
        calories: manualCalories
          ? { value: manualCalories.caloriesValue, unit: manualCalories.caloriesUnit }
          : undefined,
      }).then(
        (file) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(file);
          setPreview({ file, url: objectUrl });
        },
        () => { if (active) setDrawingError(true); },
      );
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recipe, layout, themeElement, themeId, originalServings, servings, calories, unit]);

  return (
    <div className="recipe-photo-share">
      <details className="share-portion-settings">
        <summary>Portions et calories</summary>
        <div className="share-portion-fields">
          <label>
            Portions d’origine
            <input type="number" min="1" max="999" inputMode="numeric" value={original}
              onChange={(event) => setOriginal(event.currentTarget.value)} />
          </label>
          <label>
            Personnes
            <input type="number" min="1" max="999" inputMode="numeric" value={target}
              disabled={!originalServings}
              onChange={(event) => setTarget(event.currentTarget.value)} />
          </label>
          <label>
            Calories (kcal)
            <input type="number" min="0" max="100000" step="1" inputMode="numeric" value={energyInput}
              onChange={(event) => setEnergy(event.currentTarget.value)} />
          </label>
          <label>
            Unité
            <select value={unit}
              onChange={(event) => setChosenUnit(event.currentTarget.value as ManualCaloriesUnit)}>
              {MANUAL_CALORIES_UNITS.map(value => <option key={value} value={value}>{MANUAL_CALORIES_LABELS[value]}</option>)}
            </select>
          </label>
        </div>
        {info && (energy !== null || chosenUnit !== null) && <button type="button" className="text-button"
          onClick={() => { setEnergy(null); setChosenUnit(null); }}>Rétablir les calories de la recette</button>}
      </details>
      {drawingError && <p role="alert">L’image n’a pas pu être créée.</p>}
      {!preview && !drawingError && <p role="status">Création de l’aperçu…</p>}
      {preview && (
        <>
          <div className="share-image-preview">
            <img src={preview.url} alt={`Aperçu de la recette en photo · ${recipe.title}`} />
          </div>
          {shareError && <p role="status">Enregistrez l’image pour la partager depuis votre appareil.</p>}
          <div className="share-image-actions">
            {canShareRecipeImage(preview.file) && (
              <button className="primary-button" onClick={() => {
                void shareRecipeImage(preview.file, recipe.title).then((result) => {
                  setShareError(result === "unavailable");
                });
              }}>
                <Share2 size={16} aria-hidden="true" /> Partager l’image
              </button>
            )}
            <button className="secondary-button" onClick={() => downloadRecipeImage(preview.file)}>
              <Download size={16} aria-hidden="true" /> Enregistrer / Télécharger l’image
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function validServings(input: string) {
  const value = Number(input);
  return Number.isInteger(value) && value >= 1 && value <= 999 ? value : undefined;
}

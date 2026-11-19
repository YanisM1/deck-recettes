import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Check, Share, Minus, Plus } from "lucide-react";
import type { LayoutMode, Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { PanBadge } from "./PanBadge";
import { CaloriesBadge } from "./CaloriesBadge";
import { Modal } from "./Modal";
import { RecipeShareDialog } from "./RecipeShareDialog";
import { composeRecipes } from "../services/compositeRecipes";
import { recipeFingerprint } from "../services/calorieAnalysis";
import { scaleIngredients } from "../utils/recipePortions";
const NO_RECIPES: Recipe[] = [];
export function RecipeReader({
  recipe,
  onClose,
  onEdit,
  onDelete,
  synchronized = false,
  shared = false,
  layout = "cards",
  themeId,
  availableRecipes = NO_RECIPES,
}: {
  recipe: Recipe;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  synchronized?: boolean;
  shared?: boolean;
  layout?: LayoutMode;
  themeId?: string;
  availableRecipes?: Recipe[];
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [checked, setChecked] = useState<Set<number>>(new Set()),
    [confirming, setConfirming] = useState(false),
    [showShare, setShowShare] = useState(false),
    [servingInput, setServingInput] = useState(String(recipe.servings ?? 2)),
    [error, setError] = useState("");
  const baseServings = recipe.servings ?? 2;
  const requested = Number(servingInput);
  const validServings = Number.isInteger(requested) && requested >= 1 && requested <= 999;
  const servings = validServings ? requested : baseServings;
  const composed = useMemo(() => composeRecipes(recipe, availableRecipes), [recipe, availableRecipes]);
  const hasLinks = !!recipe.linkedRecipeIds?.length;
  const canShare = !composed.warnings.some(warning => warning.type !== "duplicate");
  const ingredientSignature = JSON.stringify(composed.sections.map(section => [section.recipeId, section.ingredients]));
  useEffect(() => { setChecked(new Set()); }, [ingredientSignature]);
  const displayedRecipe = useMemo(() => {
    const ingredients = scaleIngredients(composed.ingredients, baseServings, servings);
    const displayed: Recipe = { ...recipe, ingredients, steps: composed.steps, servings, linkedRecipeIds: undefined, caloriesInfo: undefined };
    const info = composed.caloriesInfo;
    if (info) {
      const ratio = servings / baseServings;
      const totalKcal = info.totalKcal * ratio, cookedWeightGrams = info.cookedWeightGrams * ratio;
      displayed.caloriesInfo = { ...info, totalKcal, cookedWeightGrams,
        kcal: Math.round(info.basis === "part" ? totalKcal / 8 : totalKcal / cookedWeightGrams * 100),
        fingerprint: recipeFingerprint(displayed) };
    }
    return displayed;
  }, [recipe, composed, baseServings, servings]);
  let ingredientOffset = 0, stepOffset = 0;
  const sections = composed.sections.map(section => {
    const result = { ...section, ingredientOffset, stepOffset };
    ingredientOffset += section.ingredients.length;
    stepOffset += section.steps.length;
    return result;
  });
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
        disabled={!canShare}
        title={canShare ? undefined : "Corrigez les liaisons avant de partager la recette complète."}
        onClick={() => setShowShare(true)}
      >
        <Share size={17} aria-hidden="true" /> Partager
      </button>
      <article className="reader-content">
        <p className="reader-category">
          {recipe.category === "sale" ? "Le côté salé" : "La touche sucrée"}
          <span>·</span>Fait maison
          <PanBadge recipe={recipe} className="reader-pan-badge" />
          <CaloriesBadge recipe={displayedRecipe} className="reader-calories-badge" />
        </p>
        <h1>{recipe.title}</h1>
        <div className="reader-ornament" aria-hidden="true">
          ✳
        </div>
        <div className="section-heading">
          <h2>Les ingrédients</h2>
          <span>
            {checked.size} / {composed.ingredients.length}
          </span>
        </div>
        <p className="section-caption">Tout ce qu’il vous faut.</p>
        <div className="reader-portions" aria-label="Ajuster les portions">
          <label>Personnes
            <span className="portion-number">
              <button type="button" aria-label="Moins de personnes" disabled={servings <= 1}
                onClick={() => setServingInput(String(Math.max(1, servings - 1)))}><Minus size={15} /></button>
              <input aria-label="Nombre de personnes" type="number" min="1" max="999" step="1" inputMode="numeric"
                value={servingInput} onChange={event => setServingInput(event.currentTarget.value)}
                onBlur={() => { if (!validServings) setServingInput(String(baseServings)); }} />
              <button type="button" aria-label="Plus de personnes" disabled={servings >= 999}
                onClick={() => setServingInput(String(Math.min(999, servings + 1)))}><Plus size={15} /></button>
            </span>
          </label>
          <div className="portion-shortcuts">{[2, 4, 6, 8].map(value => <button type="button" key={value}
            aria-label={`${value} personnes`} aria-pressed={servings === value}
            onClick={() => setServingInput(String(value))}>{value}p</button>)}</div>
          <p>Base : {baseServings} {baseServings === 1 ? "personne" : "personnes"}. Quantités indicatives ; ajustez les assaisonnements à votre goût.</p>
        </div>
        {hasLinks && <div className="composite-notes">
          <p>Chaque préparation est incluse avec toutes ses quantités ; les portions ajustent l’ensemble.</p>
          {composed.warnings.map((warning, index) => <p key={index} role="status">{warning.message}</p>)}
          {composed.caloriesUnavailableReason && <p role="status">{composed.caloriesUnavailableReason}</p>}
          {!canShare && <p>Corrigez les liaisons avant de partager la recette complète.</p>}
        </div>}
        {sections.map(section => <section key={section.recipeId} className="composite-ingredient-section">
          {hasLinks && <h3>{section.isBase ? "Base · " : ""}{section.title}</h3>}
          <ul className="ingredient-list">
          {section.ingredients.map((_, localIndex) => {
            const index = section.ingredientOffset + localIndex;
            const ingredient = displayedRecipe.ingredients[index];
            return (
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
            );
          })}
          </ul>
        </section>)}
        <div className="section-heading preparation-heading">
          <h2>En cuisine</h2>
          <span>{String(composed.steps.length).padStart(2, "0")} étapes</span>
        </div>
        <p className="section-caption">Un geste après l’autre.</p>
        {sections.map(section => <section key={section.recipeId} className="composite-step-section">
          {hasLinks && <h3>{section.isBase ? "Base · " : ""}{section.title}</h3>}
          <ol className="steps-list" start={section.stepOffset + 1}>
          {section.steps.map((step, index) => (
            <li key={index}>
              <span className="step-number">
                {String(section.stepOffset + index + 1).padStart(2, "0")}
              </span>
              <p>{step}</p>
            </li>
          ))}
          </ol>
        </section>)}
        {composed.assemblyStep && <section className="composite-step-section">
          <h3>Assemblage</h3>
          <ol className="steps-list" start={stepOffset + 1}><li>
            <span className="step-number">{String(stepOffset + 1).padStart(2, "0")}</span>
            <p>{composed.assemblyStep}</p>
          </li></ol>
        </section>}
        <p className="bon-appetit">Et maintenant… bon appétit.</p>
        <div className="recipe-actions">
          <button
            className="primary-button share-recipe-action"
            aria-haspopup="dialog"
            disabled={!canShare}
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
          recipe={hasLinks || servings !== baseServings ? displayedRecipe : recipe}
          layout={layout}
          themeElement={ref.current}
          themeId={themeId}
          synchronized={synchronized && !hasLinks && servings === baseServings}
          shared={shared && !hasLinks && servings === baseServings}
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

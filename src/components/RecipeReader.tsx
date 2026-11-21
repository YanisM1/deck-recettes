import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Check, Share } from "lucide-react";
import { PAN_SIZES, type LayoutMode, type Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";
import { PanBadge } from "./PanBadge";
import { CaloriesBadge } from "./CaloriesBadge";
import { Modal } from "./Modal";
import { RecipeShareDialog } from "./RecipeShareDialog";
import { readManualCalories } from "../services/manualCalories";
import { createRecipeDisplayCache } from "../services/recipeDisplay";
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
    [selection, setSelection] = useState<number | null>(null),
    [error, setError] = useState("");
  const displayCache = useMemo(() => createRecipeDisplayCache(recipe, availableRecipes), [recipe, availableRecipes]);
  const selected = selection ?? displayCache.initial;
  const display = displayCache.values[String(selected)] ?? displayCache.values[String(displayCache.initial)];
  const displayedRecipe = display.recipe;
  const composed = display.composed;
  const calories = readManualCalories(recipe.caloriesValue, recipe.caloriesUnit);
  const sharedRecipe = useMemo(() => {
    if (!display.adapted) return recipe;
    return { ...displayedRecipe,
      steps: [...displayedRecipe.steps, ...display.cookingNotes.map(note => `Conseil d’adaptation : ${note}`)] };
  }, [display, displayedRecipe, recipe]);
  const sweet = displayCache.kind === "sucre";
  const hasLinks = !!recipe.linkedRecipeIds?.length;
  const canShare = !composed.warnings.some(warning => warning.type !== "duplicate");
  const ingredientSignature = displayCache.signature;
  useEffect(() => { setChecked(new Set()); }, [ingredientSignature]);
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
          <PanBadge recipe={displayedRecipe} className="reader-pan-badge" />
        </p>
        <h1>{recipe.title}</h1>
        {calories && <section className="reader-nutrition" aria-label="Calories">
          <CaloriesBadge recipe={calories} className="reader-calories-badge" />
          {calories.caloriesUnit === "total" && selected !== displayCache.initial && <p>Valeur pour la recette d’origine.</p>}
        </section>}
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
        <fieldset className="reader-portions" aria-label={sweet ? "Choisir la taille du moule" : "Choisir le nombre de personnes"}>
          <legend>{sweet ? "Le moule souhaité" : "À table pour…"}</legend>
          <div className={`portion-shortcuts ${sweet ? "pan-shortcuts" : "serving-shortcuts"}`}>
            {(sweet ? PAN_SIZES : Object.keys(displayCache.values).map(Number)).map(value => <button type="button" key={value}
              aria-label={sweet ? `Moule ${value} cm` : `${value} ${value === 1 ? "personne" : "personnes"}`}
              aria-pressed={selected === value} onClick={() => setSelection(value)}>{sweet ? `${value} cm` : `${value}p`}</button>)}
          </div>
          <p>{sweet ? `Base : moule ${recipe.panSize ?? 26} cm.` : `Base : ${recipe.servings ?? 2} personnes. Ajustez les assaisonnements à votre goût.`}</p>
        </fieldset>
        {display.cookingNotes.length > 0 && <div className="recipe-cooking-notes">
          <p className="cooking-notes-title">{sweet ? "Proportions et cuisson" : "Conseils d’adaptation"}</p>
          {display.cookingNotes.map((note, index) => <p key={index}>{note}</p>)}
        </div>}
        {hasLinks && <div className="composite-notes">
          <p>Chaque préparation est incluse avec toutes ses quantités ; les portions ajustent l’ensemble.</p>
          {composed.warnings.map((warning, index) => <p key={index} role="status">{warning.message}</p>)}
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
          recipe={sharedRecipe}
          layout={layout}
          themeElement={ref.current}
          themeId={themeId}
          synchronized={synchronized && !display.adapted}
          shared={shared && !display.adapted}
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

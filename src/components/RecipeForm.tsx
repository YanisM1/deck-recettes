import { useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ImagePlus,
  Plus,
  Minus,
  Check,
} from "lucide-react";
import {
  PAN_SIZES,
  isPanSize,
  type PanSize,
  type Category,
  type Recipe,
  type RecipeInput,
} from "../types";
import { Modal } from "./Modal";
import { RecipeImage } from "./RecipeImage";
import { compressImage } from "../services/imageCompression";
import { buildMergedRecipeDraft } from "../services/recipeMerge";
import {
  MANUAL_CALORIES_LABELS,
  MANUAL_CALORIES_UNITS,
  MAX_MANUAL_CALORIES,
  validateManualCalories,
  type ManualCaloriesUnit,
} from "../services/manualCalories";
type Line = { id: string; value: string };
function makeLines(values: string[]): Line[] {
  return (values.length ? values : [""]).map((value) => ({
    id: crypto.randomUUID(),
    value,
  }));
}
function EditableLines({
  lines,
  onChange,
  kind,
}: {
  lines: Line[];
  onChange: (value: Line[]) => void;
  kind: "ingredients" | "steps";
}) {
  const singular = kind === "ingredients" ? "Ingrédient" : "Étape";
  return (
    <div className="editable-lines">
      {lines.map((line, index) => (
        <div className="editable-line" key={line.id}>
          <span className="line-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          {kind === "steps" ? (
            <textarea
              id={line.id}
              aria-label={`${singular} ${index + 1}`}
              rows={3}
              value={line.value}
              onChange={(e) =>
                onChange(
                  lines.map((v) =>
                    v.id === line.id ? { ...v, value: e.target.value } : v,
                  ),
                )
              }
              placeholder="Décrivez ce geste…"
            />
          ) : (
            <input
              id={line.id}
              aria-label={`${singular} ${index + 1}`}
              value={line.value}
              onChange={(e) =>
                onChange(
                  lines.map((v) =>
                    v.id === line.id ? { ...v, value: e.target.value } : v,
                  ),
                )
              }
              placeholder="Ex. 200 g de farine"
            />
          )}
          <button
            type="button"
            className="small-icon"
            aria-label={`Supprimer ${singular.toLowerCase()} ${index + 1}`}
            onClick={() =>
              onChange(
                lines.length > 1
                  ? lines.filter((v) => v.id !== line.id)
                  : [{ ...line, value: "" }],
              )
            }
          >
            <Minus size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="add-line"
        onClick={() => {
          const id = crypto.randomUUID();
          onChange([...lines, { id, value: "" }]);
          requestAnimationFrame(() => document.getElementById(id)?.focus());
        }}
      >
        <Plus size={15} /> Ajouter{" "}
        {kind === "ingredients" ? "un ingrédient" : "une étape"}
      </button>
    </div>
  );
}
export function RecipeForm({
  recipe,
  onClose,
  onSave,
  availableRecipes = [],
}: {
  recipe?: Recipe;
  onClose: () => void;
  onSave: (input: RecipeInput, id?: string) => void;
  availableRecipes?: Recipe[];
}) {
  const [step, setStep] = useState(0),
    [flow, setFlow] = useState<"new" | "select" | "merged">("new"),
    [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]),
    [title, setTitle] = useState(recipe?.title || ""),
    [category, setCategory] = useState<Category>(recipe?.category || "sale"),
    [isCake, setIsCake] = useState(
      recipe?.isCake ?? (isPanSize(recipe?.panSize) || recipe?.category === "sucre"),
    ),
    [panSize, setPanSize] = useState<PanSize>(
      isPanSize(recipe?.panSize) ? recipe.panSize : 26,
    ),
    [ingredients, setIngredients] = useState(() =>
      makeLines(recipe?.ingredients || []),
    ),
    [steps, setSteps] = useState(() => makeLines(recipe?.steps || [])),
    [image, setImage] = useState(recipe?.image_url || ""),
    [servings, setServings] = useState(String(recipe?.servings ?? 2)),
    [caloriesValue, setCaloriesValue] = useState(String(recipe?.caloriesValue ?? "")),
    [caloriesUnit, setCaloriesUnit] = useState<ManualCaloriesUnit>(recipe?.caloriesUnit ?? "per_serving"),
    [linkedRecipeIds, setLinkedRecipeIds] = useState<string[]>(recipe?.linkedRecipeIds ?? []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const photo = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    titleId = useId(),
    caloriesId = useId();
  const baseServings = Number(servings);
  const validServings = Number.isInteger(baseServings) && baseServings >= 1 && baseServings <= 999;
  const selectedSources = availableRecipes.filter(candidate => selectedRecipeIds.includes(candidate.id));
  async function importPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setImage(await compressImage(file));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function startMerge() {
    try {
      const draft = buildMergedRecipeDraft(selectedSources);
      setTitle(draft.title);
      setCategory(draft.category);
      setIsCake(draft.isCake === true);
      setPanSize(isPanSize(draft.panSize) ? draft.panSize : 26);
      setServings(String(draft.servings ?? 2));
      setImage("");
      setIngredients(makeLines(draft.ingredients));
      setSteps(makeLines(draft.steps));
      setCaloriesValue("");
      setCaloriesUnit("per_serving");
      setLinkedRecipeIds([]);
      setError("");
      setStep(0);
      setFlow("merged");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setStep(0);
      setError("Donnez un titre à votre recette.");
      return;
    }
    if (step === 0) {
      if (!validServings) {
        setError("Choisissez entre 1 et 999 portions de base.");
        return;
      }
      setStep(1);
      return;
    }
    if (!ingredients.some((line) => line.value.trim())) {
      setStep(1);
      setError("Ajoutez au moins un ingrédient.");
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (!steps.some((line) => line.value.trim())) {
      setError("Ajoutez au moins une étape.");
      return;
    }
    try {
      const manualCalories = caloriesValue.trim() === ""
        ? { caloriesValue: null, caloriesUnit: null }
        : validateManualCalories(Number(caloriesValue), caloriesUnit);
      onSave(
        {
          title,
          category,
          ingredients: ingredients.map((v) => v.value),
          steps: steps.map((v) => v.value),
          image_url: image,
          isCake,
          panSize: isCake ? panSize : undefined,
          servings: baseServings,
          ...manualCalories,
          aiScalingData: recipe?.aiScalingData,
          // Existing legacy links are retained when editing; new and merged
          // recipes are independent records with no private recipe links.
          linkedRecipeIds: recipe ? linkedRecipeIds.filter(id => availableRecipes.some(candidate => candidate.id === id)) : [],
        },
        recipe?.id,
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <Modal
      title={recipe ? "Votre touche personnelle." : flow === "select" ? "Vos recettes à réunir." : flow === "merged" ? "Créer la recette combinée." : "À vous de jouer."}
      onClose={onClose}
      className="recipe-form"
    >
      <p className="modal-subtitle">
        {recipe
          ? "Les bonnes recettes évoluent avec vous."
          : flow === "select" ? "Choisissez au moins deux préparations du carnet. Elles resteront intactes."
          : flow === "merged" ? "Une nouvelle recette indépendante sera créée à partir de votre sélection."
          : "Les recettes qu’on aime méritent une place ici."}
      </p>
      {!recipe && flow !== "merged" && <div className="recipe-flow-tabs" role="tablist" aria-label="Type de création">
        <button type="button" role="tab" aria-selected={flow === "new"} onClick={() => { setFlow("new"); setError(""); }}>
          ➕ Nouvelle recette
        </button>
        <button type="button" role="tab" aria-selected={flow === "select"} onClick={() => { setFlow("select"); setError(""); }}>
          🔗 Lier des recettes
        </button>
      </div>}
      {flow === "select" ? <section className="recipe-merge-selection" aria-label="Sélection des recettes">
        <p>Sélectionnées : <strong>{selectedRecipeIds.length}</strong>. Une copie complète sera créée pour garder chaque recette d’origine intacte.</p>
        {availableRecipes.length ? <div className="recipe-merge-choices">
          {availableRecipes.map(candidate => <label key={candidate.id}>
            <input type="checkbox" checked={selectedRecipeIds.includes(candidate.id)}
              onChange={() => setSelectedRecipeIds(ids => ids.includes(candidate.id) ? ids.filter(id => id !== candidate.id) : [...ids, candidate.id])} />
            <span>{candidate.title}<small>{candidate.category === "sucre" || candidate.isCake ? "Sucré" : "Salé"} · {candidate.ingredients.length} ingrédients · {candidate.steps.length} étapes</small></span>
          </label>)}
        </div> : <p className="recipe-merge-empty">Ajoutez au moins deux recettes au carnet pour les combiner.</p>}
        {error && <p className="notice error-notice" role="alert">{error}</p>}
        <div className="editor-footer">
          <button type="button" className="secondary-button" onClick={() => { setFlow("new"); setError(""); }}>Annuler</button>
          <button type="button" className="primary-button" disabled={selectedRecipeIds.length < 2} onClick={startMerge}>Suivant : Créer la recette combinée</button>
        </div>
      </section> : <>
      {flow === "merged" && <button type="button" className="merge-back-link" onClick={() => setFlow("select")}>← Modifier la sélection ({selectedSources.length})</button>}
      <div className="editor-progress" aria-label={`Partie ${step + 1} sur 3`}>
        {["La recette", "Ingrédients", "Préparation"].map((label, index) => (
          <div key={label} className={index <= step ? "active" : ""}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {label}
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        {step === 0 && (
          <>
            <label className="field-label" htmlFor={titleId}>
              {flow === "merged" ? "Nouveau nom de la recette" : "Le nom de votre recette"}
            </label>
            <input
              id={titleId}
              className="text-input recipe-title-input"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Le gâteau de mamie…"
              required
            />
            <span className="field-label">Plutôt…</span>
            <div className="category-picker">
              <button
                type="button"
                aria-pressed={category === "sale"}
                onClick={() => setCategory("sale")}
              >
                Salé
              </button>
              <button
                type="button"
                aria-pressed={category === "sucre"}
                onClick={() => {
                  if (!recipe && category !== "sucre" && flow === "new") setIsCake(true);
                  setCategory("sucre");
                }}
              >
                Sucré
              </button>
            </div>
            <label className="field-label servings-base-field">
              Portions de base
              <input type="number" min="1" max="999" step="1" inputMode="numeric"
                className="text-input" value={servings} required
                onChange={event => setServings(event.currentTarget.value)} />
            </label>
            <div className="cake-options">
              <label className="cake-toggle">
                <input
                  type="checkbox"
                  checked={isCake}
                  onChange={(e) => setIsCake(e.target.checked)}
                />
                <span>🎂 C’est un gâteau / moule</span>
              </label>
              {isCake && (
                <fieldset className="pan-size-options">
                  <legend>Taille du moule d’origine</legend>
                  <div>
                    {PAN_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={panSize === size}
                        onClick={() => setPanSize(size)}
                      >
                        {size} cm
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
            <span className="field-label">
              {flow === "merged" ? "Nouvelle photo du résultat final" : "La photo du résultat"}{" "}
              <span className="optional">· facultatif</span>
            </span>
            {flow === "merged" && <p className="merge-photo-invite">Ajoutez une photo du plat assemblé. Vous pouvez la prendre maintenant ou choisir une image dans la photothèque.</p>}
            <div className="photo-picker">
              {image ? (
                <RecipeImage
                  key={image}
                  src={image}
                  alt="Aperçu de votre recette"
                />
              ) : (
                <div className="photo-picker-empty">
                  <ImagePlus size={26} />
                  <span>On mange aussi avec les yeux.</span>
                </div>
              )}
            </div>
            <div className="photo-options">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => photo.current?.click()}
              >
                <ImagePlus size={15} />
                {busy ? "Préparation…" : "Photothèque"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => camera.current?.click()}
              >
                <Camera size={15} /> Appareil photo
              </button>
            </div>
            {image && (
              <button
                type="button"
                className="text-button"
                onClick={() => setImage("")}
              >
                Retirer la photo
              </button>
            )}
            <input
              ref={photo}
              type="file"
              accept="image/*"
              hidden
              aria-label="Choisir une photo"
              onChange={(e) => {
                void importPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              aria-label="Prendre une photo"
              onChange={(e) => {
                void importPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        )}
        {step === 1 && (
          <>
            <h3 className="editor-section-title">Les bonnes choses.</h3>
            <p className="section-caption">
              Un ingrédient par ligne, avec sa quantité.
            </p>
            <EditableLines
              lines={ingredients}
              onChange={setIngredients}
              kind="ingredients"
            />
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="editor-section-title">Le petit savoir-faire.</h3>
            <p className="section-caption">
              Chaque geste compte. Racontez-les dans l’ordre.
            </p>
            <EditableLines lines={steps} onChange={setSteps} kind="steps" />
            <fieldset className="manual-calories-fields">
              <legend>🔥 Calories (optionnel)</legend>
              <p className="section-caption" id={`${caloriesId}-help`}>
                Laissez vide pour ne rien afficher sur la recette.
              </p>
              <label htmlFor={caloriesId}>Calories (kcal)</label>
              <input
                id={caloriesId}
                aria-describedby={`${caloriesId}-help`}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_MANUAL_CALORIES}
                step={1}
                value={caloriesValue}
                onChange={(event) => setCaloriesValue(event.currentTarget.value)}
              />
              <div className="manual-calories-units" role="group" aria-label="Unité des calories">
                {MANUAL_CALORIES_UNITS.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={caloriesUnit === unit ? "selected" : ""}
                    aria-pressed={caloriesUnit === unit}
                    onClick={() => setCaloriesUnit(unit)}
                  >
                    {MANUAL_CALORIES_LABELS[unit]}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {error && (
          <p className="notice error-notice" role="alert">
            {error}
          </p>
        )}
        <div className="editor-footer">
          {step > 0 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setStep((value) => value - 1);
                setError("");
              }}
            >
              <ArrowLeft size={15} /> Retour
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Annuler
            </button>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {step === 2 ? (
              <>
                <Check size={16} /> Enregistrer
              </>
            ) : (
              <>
                Continuer <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>
      </>}
    </Modal>
  );
}

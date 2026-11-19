import { useEffect, useId, useRef, useState, type FormEvent } from "react";
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
import { analyzeRecipe } from "../services/geminiService";
import { hasFreshCalories, recipeFingerprint, type CaloriesInfo } from "../services/calorieAnalysis";
import { CaloriesBadge } from "./CaloriesBadge";
import { validateRecipeLinks } from "../services/compositeRecipes";
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
    [title, setTitle] = useState(recipe?.title || ""),
    [category, setCategory] = useState<Category>(recipe?.category || "sale"),
    [isCake, setIsCake] = useState(
      recipe?.isCake === true || isPanSize(recipe?.panSize),
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
    [linkedRecipeIds, setLinkedRecipeIds] = useState<string[]>(recipe?.linkedRecipeIds ?? []),
    [caloriesInfo, setCaloriesInfo] = useState<CaloriesInfo | undefined>(recipe?.caloriesInfo),
    [analyzing, setAnalyzing] = useState(false),
    [analysisError, setAnalysisError] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const photo = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    titleId = useId();
  const request = useRef<AbortController | null>(null);
  const baseServings = Number(servings);
  const validServings = Number.isInteger(baseServings) && baseServings >= 1 && baseServings <= 999;
  const analysisInput = {
    title: title.trim(), category, isCake, panSize: isCake ? panSize : undefined,
    ingredients: ingredients.map(line => line.value.trim()).filter(Boolean),
    steps: steps.map(line => line.value.trim()).filter(Boolean), servings: baseServings,
  };
  const fingerprint = recipeFingerprint(analysisInput);
  const freshCalories = hasFreshCalories({ ...analysisInput, caloriesInfo }) ? caloriesInfo : undefined;
  const canAnalyze = !!analysisInput.title && !!analysisInput.ingredients.length && !!analysisInput.steps.length && validServings;
  const linkChoices = availableRecipes.filter(candidate => candidate.id !== recipe?.id).map(candidate => {
    const selected = linkedRecipeIds.includes(candidate.id);
    let unavailable = "";
    if (!selected) {
      try { validateRecipeLinks(recipe?.id, [...linkedRecipeIds, candidate.id], availableRecipes); }
      catch (error) { unavailable = (error as Error).message; }
    }
    return { candidate, selected, unavailable };
  });
  const missingLinks = linkedRecipeIds.filter(id => !availableRecipes.some(candidate => candidate.id === id));
  useEffect(() => {
    setAnalyzing(false);
    setAnalysisError("");
    return () => { request.current?.abort(); request.current = null; };
  }, [fingerprint]);
  async function analyze() {
    if (request.current || !canAnalyze) return;
    const controller = new AbortController();
    request.current = controller;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const result = await analyzeRecipe(analysisInput, { signal: controller.signal });
      if (!controller.signal.aborted) setCaloriesInfo(result);
    } catch (error) {
      if (!controller.signal.aborted) setAnalysisError((error as Error).message || "L’analyse est indisponible pour le moment.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setAnalyzing(false);
      }
    }
  }
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
      try { validateRecipeLinks(recipe?.id, linkedRecipeIds, availableRecipes); }
      catch (error) { setStep(0); throw error; }
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
          caloriesInfo: freshCalories,
          linkedRecipeIds,
        },
        recipe?.id,
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <Modal
      title={recipe ? "Votre touche personnelle." : "À vous de jouer."}
      onClose={onClose}
      className="recipe-form"
    >
      <p className="modal-subtitle">
        {recipe
          ? "Les bonnes recettes évoluent avec vous."
          : "Les recettes qu’on aime méritent une place ici."}
      </p>
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
              Le nom de votre recette
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
                onClick={() => setCategory("sucre")}
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
                  <legend>Taille du moule</legend>
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
            <details className="linked-recipe-picker">
              <summary>🔗 Lier une autre recette{linkedRecipeIds.length ? ` · ${linkedRecipeIds.length}` : ""}</summary>
              <p>Chaque préparation liée est ajoutée avec toutes ses quantités. Le choix des portions ajuste ensuite l’ensemble.</p>
              {linkChoices.length ? <div className="linked-recipe-choices">
                {linkChoices.map(({ candidate, selected, unavailable }) => <label key={candidate.id} title={unavailable || undefined}>
                  <input type="checkbox" checked={selected} disabled={!!unavailable}
                    onChange={() => setLinkedRecipeIds(ids => selected ? ids.filter(id => id !== candidate.id) : [...ids, candidate.id])} />
                  <span>{candidate.title}{unavailable && <small>Cette liaison ne peut pas être ajoutée.</small>}</span>
                </label>)}
              </div> : <p>Ajoutez d’autres recettes au carnet pour les assembler ici.</p>}
              {missingLinks.map(id => <label className="missing-recipe-link" key={id}>
                <input type="checkbox" checked onChange={() => setLinkedRecipeIds(ids => ids.filter(value => value !== id))} />
                <span>Recette liée indisponible · décocher pour la retirer</span>
              </label>)}
            </details>
            <span className="field-label">
              La photo du résultat{" "}
              <span className="optional">· facultatif</span>
            </span>
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
            <div className="calorie-analysis">
              <button type="button" className="secondary-button" disabled={analyzing || busy || !canAnalyze}
                onClick={() => { void analyze(); }}>
                {analyzing ? "Analyse des calories…" : "✨ Analyser les calories avec l’IA"}
              </button>
              {analyzing && <p role="status">Cuisson, mélanges et quantités en cours d’analyse…</p>}
              {analysisError && <p className="notice" role="alert">{analysisError} Vous pouvez enregistrer sans analyse.</p>}
              <CaloriesBadge recipe={{ ...analysisInput, caloriesInfo: freshCalories }} />
              {freshCalories && <details className="calorie-assumptions">
                <summary>À propos de cette estimation</summary>
                <p>{freshCalories.basis === "part" ? "Gâteau divisé en 8 parts." : "Énergie rapportée à 100 g de préparation cuite."}</p>
                <ul>{freshCalories.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>
              </details>}
              <p className="section-caption">Estimation facultative. L’enregistrement reste disponible.</p>
              {linkedRecipeIds.length > 0 && <p className="section-caption">Cette analyse concerne la base. Les calories de l’assemblage seront additionnées lorsque chaque préparation aura une estimation à jour.</p>}
            </div>
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
    </Modal>
  );
}

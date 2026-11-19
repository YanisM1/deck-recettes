import { useCallback, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { Settings as SettingsIcon, ChefHat } from "lucide-react";
import { Settings } from "./components/Settings";
import { themes, usePreferences, inkOn } from "./services/preferences";
import { getRecipeStore, useRecipes } from "./services/recipeSync";
import { Sidebar } from "./components/Sidebar";
import { CardDeck } from "./components/CardDeck";
import { RecipeBook } from "./components/RecipeBook";
import { RecipeReader } from "./components/RecipeReader";
import { RecipeForm } from "./components/RecipeForm";
import { Modal } from "./components/Modal";
import { useRecipeShareRoute } from "./hooks/useRecipeShareRoute";
import { filterRecipes, type Filters, type Recipe } from "./types";
import { useRecipeAiActions } from "./hooks/useRecipeAiActions";
import { hasFreshRecipeAi } from "./services/recipeAiTypes";
export default function App() {
  const preferences = usePreferences(),
    theme = themes.find((t) => t.id === preferences.theme)!,
    [settings, setSettings] = useState(false);
  const recipes = useRecipes();
  const recipeAi = useRecipeAiActions();
  const [filters, setFilters] = useState<Filters>({ sale: true, sucre: true }),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const shareRoute = useRecipeShareRoute(recipes.recipes);
  const selected = shareRoute.route
    ? shareRoute.recipe
    : recipes.recipes.find((recipe) => recipe.id === selectedId);
  const canEdit = !shareRoute.route || shareRoute.editable;
  const selectedAiStatus = selected ? recipeAi.statusFor(selected) : undefined;
  function closeRecipe() {
    setSelectedId(null);
    if (shareRoute.route) shareRoute.close();
  }
  const visible = useMemo(() => filterRecipes(recipes.recipes, filters), [recipes.recipes, filters]);
  const openRecipe = useCallback((recipe: Recipe) => setSelectedId(recipe.id), []);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--bg-main", theme.bg);
    document.documentElement.style.colorScheme = theme.dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.bg);
  }, [theme.bg]);
  const style = {
    "--bg-main": theme.bg,
    "--bg": theme.bg,
    "--text": theme.text,
    "--accent-primary": theme.primary,
    "--accent-secondary": theme.secondary,
    "--on-primary": inkOn(theme.primary),
    "--on-secondary": inkOn(theme.secondary),
    colorScheme: theme.dark ? "dark" : "light",
  } as CSSProperties;
  return (
    <main
      className="device-frame"
      data-layout={preferences.layoutMode}
      data-theme={theme.id}
      data-tone={theme.dark ? "dark" : "light"}
      style={style}
    >
      <button
        className="settings-trigger icon-button"
        aria-label="Réglages"
        onClick={() => setSettings(true)}
      >
        <SettingsIcon size={21} />
      </button>
      <div className="home-intro">
        <p className="brand">
          <ChefHat size={17} /> DECKCHEF
        </p>
        <h1>
          {preferences.layoutMode === "book" ? "À feu doux" : "À table"}
          <span>.</span>
        </h1>
        <p className="intro-caption">
          {preferences.layoutMode === "book"
            ? "De belles pages à cuisiner."
            : "Vos recettes, à votre façon."}
        </p>
      </div>
      <Sidebar
        filters={filters}
        onToggle={(category) =>
          setFilters((value) => ({ ...value, [category]: !value[category] }))
        }
        onAdd={() => setEditing("new")}
      />
      <div className="home-content">
      {visible.length ? (
        preferences.layoutMode === "book" ? (
          <RecipeBook
            key={`book-${visible.map((r) => r.id).join("|")}`}
            recipes={visible}
            allRecipes={recipes.recipes}
            onOpen={openRecipe}
          />
        ) : (
          <CardDeck
            key={`cards-${visible.map((r) => r.id).join("|")}`}
            recipes={visible}
            allRecipes={recipes.recipes}
            onOpen={openRecipe}
          />
        )
      ) : (
        <div className="empty-state">
          <ChefHat size={34} />
          <h2>
            {recipes.recipes.length
              ? "Un peu plus de choix ?"
              : "Votre prochaine découverte."}
          </h2>
          <p>
            {recipes.recipes.length
              ? "Activez Salé ou Sucré pour retrouver vos recettes."
              : "Chaque belle recette commence par une idée."}
          </p>
          {recipes.recipes.length ? (
            <button
              className="secondary-button"
              onClick={() => setFilters({ sale: true, sucre: true })}
            >
              Tout afficher
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() => setEditing("new")}
            >
              Ajouter ma première recette
            </button>
          )}
        </div>
      )}
      </div>
      {selected && (
        <RecipeReader
          key={`reader-${selected.id}`}
          recipe={selected}
          onAnalyze={canEdit ? () => { void recipeAi.analyze(selected, true, true); } : undefined}
          analyzing={selectedAiStatus?.state === "analyzing"}
          analysisStatus={selectedAiStatus?.message}
          availableRecipes={canEdit ? recipes.recipes : []}
          onClose={closeRecipe}
          onEdit={canEdit ? () => setEditing(selected) : undefined}
          onDelete={canEdit ? () => {
            getRecipeStore().remove(selected.id);
            closeRecipe();
          } : undefined}
          shared={!!(shareRoute.route?.token || shareRoute.route?.snapshot)}
          synchronized={recipes.status === "connected" && !recipes.pending}
          layout={preferences.layoutMode}
          themeId={theme.id}
        />
      )}
      {shareRoute.route && !selected && (
        <Modal title="Recette partagée" onClose={closeRecipe}>
          {shareRoute.loading ? (
            <p role="status">Ouverture de la recette…</p>
          ) : (
            <p role="alert">Cette recette est indisponible. Vérifiez le lien ou réessayez avec une connexion internet.</p>
          )}
          <button className="secondary-button" onClick={closeRecipe}>
            Retour aux recettes
          </button>
        </Modal>
      )}
      {editing && (
        <RecipeForm
          recipe={editing === "new" ? undefined : editing}
          availableRecipes={recipes.recipes}
          onClose={() => setEditing(null)}
          onSave={(input, id) => {
            const saved = getRecipeStore().save(input, id);
            setEditing(null);
            setSelectedId(saved.id);
            if (!hasFreshRecipeAi(saved)) void recipeAi.analyze(saved);
          }}
        />
      )}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </main>
  );
}

import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "./App";
import * as sync from "./services/recipeSync";
import { setPreferences } from "./services/preferences";
import { starterRecipes } from "./data/recipes";
import * as links from "./services/recipeShareLink";

afterEach(() => window.history.replaceState(null, "", "/"));
it.each(["cards", "book"] as const)(
  "ouvre et referme un carnet à une recette sans collision de clés en mode %s",
  (mode) => {
    vi.spyOn(sync, "useRecipes").mockReturnValue({
      recipes: [starterRecipes[0]],
      status: "local",
      pending: 0,
      realtime: false,
      error: null,
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => setPreferences({ layoutMode: mode }));
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: `Lire ${starterRecipes[0].title}` }),
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Retour aux recettes" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      errors.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
  },
);

it("ouvre la recette du carnet indiquée dans l’URL et nettoie le lien au retour", () => {
  const recipe = starterRecipes[0];
  vi.spyOn(sync, "useRecipes").mockReturnValue({
    recipes: [recipe], status: "local", pending: 0, realtime: false, error: null,
  });
  window.history.replaceState({ landmark: 1 }, "", `/?recipe=${recipe.id}&vue=livre#page`);
  render(<App />);
  expect(screen.getByRole("dialog", { name: recipe.title })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Modifier la recette" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retour aux recettes" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.location.search).toBe("?vue=livre");
  expect(window.location.hash).toBe("#page");
  expect(window.history.state).toEqual({ landmark: 1 });
});

it("attend Supabase puis ouvre la recette partagée sans droit de modification même si l’identifiant est aussi local", async () => {
  const local = starterRecipes[0];
  const recipe = { ...local, title: "Recette d’un autre carnet" };
  vi.spyOn(sync, "useRecipes").mockReturnValue({
    recipes: [local], status: "connected", pending: 0, realtime: false, error: null,
  });
  const fetchRecipe = vi.spyOn(sync, "fetchLinkedRecipe").mockResolvedValue(recipe);
  const token = "ab".repeat(32);
  window.history.replaceState(null, "", `/?recipe=${recipe.id}#share=${token}`);
  render(<App />);
  expect(screen.getByRole("status")).toHaveTextContent("Ouverture de la recette");
  expect(await screen.findByRole("dialog", { name: recipe.title })).toBeInTheDocument();
  expect(fetchRecipe).toHaveBeenCalledWith(recipe.id, token, expect.any(AbortSignal));
  expect(screen.queryByRole("button", { name: "Modifier la recette" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Supprimer la recette" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "✨ Calculer calories & portions (IA)" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retour aux recettes" }));
  expect(window.location.search + window.location.hash).toBe("");
  expect(screen.getByRole("button", { name: `Lire ${local.title}` })).toBeInTheDocument();
});

it("ouvre la copie portable sans Supabase et préserve le carnet", async () => {
  const recipe = { ...starterRecipes[2], title: "Gâteau partagé hors ligne" };
  vi.spyOn(sync, "useRecipes").mockReturnValue({
    recipes: [], status: "local", pending: 0, realtime: false, error: null,
  });
  const fetchRecipe = vi.spyOn(sync, "fetchLinkedRecipe");
  vi.spyOn(links, "decodeRecipeShareSnapshot").mockResolvedValue(recipe);
  window.history.replaceState(null, "", `/?recipe=${recipe.id}#snapshot=abc`);
  render(<App />);
  expect(await screen.findByRole("dialog", { name: recipe.title })).toBeInTheDocument();
  expect(fetchRecipe).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retour aux recettes" }));
  expect(screen.getByRole("button", { name: "Ajouter ma première recette" })).toBeInTheDocument();
});

it("affiche un retour utilisable quand la recette du lien est introuvable", async () => {
  vi.spyOn(sync, "useRecipes").mockReturnValue({
    recipes: [], status: "local", pending: 0, realtime: false, error: null,
  });
  vi.spyOn(sync, "fetchLinkedRecipe").mockResolvedValue(null);
  window.history.replaceState(null, "", `/?recipe=${starterRecipes[0].id}`);
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Cette recette est indisponible");
  fireEvent.click(screen.getByRole("button", { name: "Retour aux recettes" }));
  expect(window.location.search).toBe("");
});

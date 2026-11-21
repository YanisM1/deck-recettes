import { useSyncExternalStore } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import * as sync from "./services/recipeSync";
import { RecipeStore } from "./services/recipeStore";
import { setPreferences } from "./services/preferences";
import * as imageCompression from "./services/imageCompression";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("enregistre une nouvelle recette fusionnée sans lancer de requête d’analyse", async () => {
  localStorage.clear();
  const store = new RecipeStore(localStorage, null, "app-merge-qa");
  vi.spyOn(sync, "getRecipeStore").mockReturnValue(store);
  vi.spyOn(sync, "useRecipes").mockImplementation(() => useSyncExternalStore(store.subscribe, store.getSnapshot));
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  actPreferences();
  const sources = store.getSnapshot().recipes.filter(recipe => [
    "Pancakes du dimanche", "Cookies au chocolat",
  ].includes(recipe.title));
  const sourceIds = sources.map(recipe => recipe.id);
  const originals = structuredClone(sources);
  const compressedPhoto = "data:image/jpeg;base64,merged-output";
  vi.spyOn(imageCompression, "compressImage").mockResolvedValue(compressedPhoto);
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une recette" }));
  fireEvent.click(screen.getByRole("tab", { name: /Lier des recettes/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Pancakes du dimanche/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Cookies au chocolat/ }));
  fireEvent.click(screen.getByRole("button", { name: "Suivant : Créer la recette combinée" }));
  fireEvent.change(screen.getByLabelText("Nouveau nom de la recette"), { target: { value: "Pancakes chocolatés" } });
  fireEvent.change(screen.getByLabelText("Choisir une photo"), { target: { files: [new File(["image"], "pancakes.png", { type: "image/png" })] } });
  await waitFor(() => expect(screen.getByAltText("Aperçu de votre recette")).toHaveAttribute("src", compressedPhoto));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

  const created = store.getSnapshot().recipes.find(recipe => recipe.title === "Pancakes chocolatés");
  expect(created).toBeDefined();
  expect(sourceIds).not.toContain(created!.id);
  expect(created).toMatchObject({ image_url: compressedPhoto, linkedRecipeIds: [] });
  expect(created!.ingredients).toContain("— Pancakes du dimanche —");
  expect(created!.ingredients).toContain("— Cookies au chocolat —");
  expect(created!.steps.at(-1)).toMatch(/^Assemblage final/);
  expect(store.getSnapshot().recipes.filter(recipe => sourceIds.includes(recipe.id))).toEqual(originals);
  const reloaded = new RecipeStore(localStorage, null, "app-merge-qa").getSnapshot().recipes.find(recipe => recipe.id === created!.id);
  expect(reloaded).toMatchObject({ title: "Pancakes chocolatés", image_url: compressedPhoto, linkedRecipeIds: [] });
  expect(screen.getByRole("dialog", { name: "Pancakes chocolatés" })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

function actPreferences() { setPreferences({ layoutMode: "cards" }); }

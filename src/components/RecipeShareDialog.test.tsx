import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { starterRecipes } from "../data/recipes";
import {
  canShareRecipeImage,
  downloadRecipeImage,
  generateRecipeImage,
  shareRecipeImage,
} from "../utils/recipeImageGenerator";
import { RecipeReader } from "./RecipeReader";

vi.mock("../utils/recipeImageGenerator", () => ({
  generateRecipeImage: vi.fn(),
  canShareRecipeImage: vi.fn(),
  shareRecipeImage: vi.fn(),
  downloadRecipeImage: vi.fn(),
}));

const recipe = { ...starterRecipes[2], isCake: true, panSize: 26 as const };
const file = new File(["PNG"], "deckchef.png", { type: "image/png" });
const createObjectURL = vi.fn(() => "blob:deckchef-preview");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateRecipeImage).mockResolvedValue(file);
  vi.mocked(canShareRecipeImage).mockReturnValue(true);
  vi.mocked(shareRecipeImage).mockResolvedValue("shared");
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
});

afterEach(() => vi.unstubAllGlobals());

it.each(["Partager", "Partager la recette"])(
  "présente les deux options depuis le bouton %s",
  (name) => {
    const close = vi.fn();
    render(<RecipeReader recipe={recipe} onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name }));
    const modal = screen.getByRole("dialog", { name: "Partager la recette" });
    const buttons = within(modal);
    expect(buttons.getByRole("button", { name: "Partager la recette en photo" })).toBeVisible();
    expect(buttons.getByRole("button", { name: "Partager le lien de la recette" })).toBeVisible();
    fireEvent(modal, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "Partager la recette" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: recipe.title })).toBeVisible();
    expect(close).not.toHaveBeenCalled();
  },
);

it("copie le lien, ouvre le partage natif et affiche la confirmation", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText }, share });
  render(<RecipeReader recipe={recipe} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Partager" }));

  const button = screen.getByRole("button", { name: "Partager le lien de la recette" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);

  expect(await screen.findByRole("status")).toHaveTextContent("Lien copié !");
  const url = writeText.mock.calls[0][0];
  expect(url).toMatch(new RegExp(`^https://deck-recettes\\.vercel\\.app/\\?recipe=${recipe.id}#snapshot=`));
  expect(share).toHaveBeenCalledWith({
    title: recipe.title,
    text: `Découvre ma recette : ${recipe.title}`,
    url,
  });
});

it("prévisualise le PNG Livre avec les quantités ajustées, puis partage et télécharge le fichier", async () => {
  render(<RecipeReader recipe={recipe} layout="book" onClose={vi.fn()} />);
  const reader = screen.getByRole("dialog", { name: recipe.title });
  fireEvent.click(screen.getByRole("button", { name: "Partager" }));
  fireEvent.click(screen.getByRole("button", { name: "Partager la recette en photo" }));
  const modal = screen.getByRole("dialog", { name: "Partager en photo" });
  expect(within(modal).getByRole("status")).toHaveTextContent("Création de l’aperçu");
  fireEvent.click(within(modal).getByText("Portions et calories"));
  fireEvent.change(within(modal).getByLabelText("Portions d’origine"), { target: { value: "4" } });
  fireEvent.change(within(modal).getByLabelText("Personnes"), { target: { value: "8" } });
  fireEvent.change(within(modal).getByLabelText("Calories (kcal)"), { target: { value: "350" } });
  fireEvent.change(within(modal).getByLabelText("Unité"), { target: { value: "100g" } });

  expect(await within(modal).findByAltText(`Aperçu de la recette en photo · ${recipe.title}`))
    .toHaveAttribute("src", "blob:deckchef-preview");
  expect(generateRecipeImage).toHaveBeenLastCalledWith({
    recipe,
    layout: "book",
    themeElement: reader,
    servings: 8,
    ingredients: expect.arrayContaining(["400 g de farine", "4 œufs"]),
    calories: { value: 350, unit: "100g" },
  });
  fireEvent.click(within(modal).getByRole("button", { name: "Partager l’image" }));
  expect(shareRecipeImage).toHaveBeenCalledWith(file, recipe.title);
  fireEvent.click(within(modal).getByRole("button", { name: "Enregistrer / Télécharger l’image" }));
  expect(downloadRecipeImage).toHaveBeenCalledWith(file);
  fireEvent.click(within(modal).getByRole("button", { name: "Options de partage" }));
  expect(screen.getByRole("dialog", { name: "Partager la recette" })).toBeVisible();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:deckchef-preview");
});

it("garde le téléchargement disponible quand le partage natif de fichiers manque", async () => {
  vi.mocked(canShareRecipeImage).mockReturnValue(false);
  render(<RecipeReader recipe={recipe} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Partager" }));
  fireEvent.click(screen.getByRole("button", { name: "Partager la recette en photo" }));
  expect(await screen.findByRole("button", { name: "Enregistrer / Télécharger l’image" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Partager l’image" })).not.toBeInTheDocument();
});

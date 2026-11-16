import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecipeForm } from "./RecipeForm";
import { RecipeReader } from "./RecipeReader";
import { starterRecipes } from "../data/recipes";
it("crée une recette avec plusieurs lignes à travers les trois parties", () => {
  const save = vi.fn();
  render(<RecipeForm onSave={save} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText("Le nom de votre recette"), {
    target: { value: "Mon gâteau" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sucré" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.change(screen.getByLabelText("Ingrédient 1"), {
    target: { value: "200 g de farine" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ajouter un ingrédient" }),
  );
  fireEvent.change(screen.getByLabelText("Ingrédient 2"), {
    target: { value: "2 œufs" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.change(screen.getByLabelText("Étape 1"), {
    target: { value: "Mélanger et cuire." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(save).toHaveBeenCalledWith(
    {
      title: "Mon gâteau",
      category: "sucre",
      ingredients: ["200 g de farine", "2 œufs"],
      steps: ["Mélanger et cuire."],
      image_url: "",
      isCake: false,
      panSize: undefined,
    },
    undefined,
  );
});
it("conserve la photo et les listes lors de l’édition", () => {
  const save = vi.fn(),
    recipe = starterRecipes[0];
  render(<RecipeForm recipe={recipe} onSave={save} onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(save.mock.calls[0][0].image_url).toBe(recipe.image_url);
  expect(save.mock.calls[0][1]).toBe(recipe.id);
});
it("permet de cocher un ingrédient et exige une confirmation de suppression", () => {
  const remove = vi.fn();
  render(
    <RecipeReader
      recipe={starterRecipes[0]}
      onClose={() => {}}
      onEdit={() => {}}
      onDelete={remove}
    />,
  );
  const checkbox = screen.getAllByRole("checkbox")[0];
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Supprimer la recette" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^Supprimer$/ }));
  expect(remove).toHaveBeenCalledOnce();
});

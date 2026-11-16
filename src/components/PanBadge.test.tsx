import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecipeForm } from "./RecipeForm";
import { RecipeReader } from "./RecipeReader";
import { CardDeck } from "./CardDeck";
import { RecipeBook } from "./RecipeBook";
import { starterRecipes } from "../data/recipes";
it.each([20, 26, 28] as const)(
  "sélectionne et sauvegarde un gâteau dans un moule %s cm",
  (size) => {
    const save = vi.fn();
    render(
      <RecipeForm
        recipe={starterRecipes[0]}
        onClose={() => {}}
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /C’est un gâteau/ }));
    fireEvent.click(screen.getByRole("button", { name: `${size} cm` }));
    expect(screen.getByRole("button", { name: `${size} cm` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ isCake: true, panSize: size }),
      starterRecipes[0].id,
    );
  },
);
it("supprime la taille lors de la désactivation et masque les trois choix", () => {
  const save = vi.fn();
  render(
    <RecipeForm
      recipe={{ ...starterRecipes[0], isCake: true, panSize: 26 }}
      onClose={() => {}}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /C’est un gâteau/ }));
  expect(
    screen.queryByRole("button", { name: "26 cm" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(save.mock.calls[0][0]).toMatchObject({
    isCake: false,
    panSize: undefined,
  });
});
it.each([20, 26, 28] as const)(
  "affiche le badge %s cm sur carte, page et lecteur",
  (size) => {
    const recipe = { ...starterRecipes[0], isCake: true, panSize: size };
    render(
      <>
        <CardDeck recipes={[recipe]} onOpen={() => {}} />
        <RecipeBook recipes={[recipe]} onOpen={() => {}} />
        <RecipeReader
          recipe={recipe}
          onClose={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </>,
    );
    expect(screen.getAllByText(`Moule ${size} cm`)).toHaveLength(3);
  },
);

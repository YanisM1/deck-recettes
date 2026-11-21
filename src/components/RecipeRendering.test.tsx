import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CardDeck } from "./CardDeck";
import { RecipeBook } from "./RecipeBook";
import { RecipeImage } from "./RecipeImage";
import { starterRecipes } from "../data/recipes";

vi.mock("./RecipeImage", () => ({ RecipeImage: vi.fn(({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />) }));
afterEach(cleanup);

it.each([["cards", CardDeck], ["book", RecipeBook]] as const)("%s skips image rendering on unrelated updates but displays changed recipes", (_, Component) => {
  const recipes = starterRecipes.slice(0, 2);
  const onOpen = vi.fn();
  const view = render(<Component recipes={recipes} onOpen={onOpen} />);
  const calls = vi.mocked(RecipeImage).mock.calls.length;
  view.rerender(<Component recipes={recipes} onOpen={onOpen} />);
  expect(vi.mocked(RecipeImage).mock.calls.length).toBe(calls);
  const updated = [{ ...recipes[0], title: "Recette mise à jour" }, recipes[1]];
  view.rerender(<Component recipes={updated} onOpen={onOpen} />);
  expect(screen.getByRole("button", { name: "Lire Recette mise à jour" })).toBeVisible();
  expect(vi.mocked(RecipeImage).mock.calls.length).toBeGreaterThan(calls);
});

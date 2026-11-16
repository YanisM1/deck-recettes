import { describe, it, expect } from "vitest";
import { filterRecipes } from "./types";
import { starterRecipes } from "./data/recipes";
describe("filtres cumulatifs indépendants", () => {
  it("affiche les deux catégories par défaut", () =>
    expect(
      filterRecipes(starterRecipes, { sale: true, sucre: true }),
    ).toHaveLength(4));
  it("peut désactiver chaque catégorie séparément", () => {
    expect(
      filterRecipes(starterRecipes, { sale: true, sucre: false }),
    ).toHaveLength(2);
    expect(
      filterRecipes(starterRecipes, { sale: false, sucre: true }),
    ).toHaveLength(2);
  });
  it("retourne un paquet vide quand les deux sont décochées", () =>
    expect(
      filterRecipes(starterRecipes, { sale: false, sucre: false }),
    ).toEqual([]));
});

import { expect, it } from "vitest";
import { scaleIngredients } from "./recipePortions";

it("ajuste les nombres, fractions et plages sans modifier une concentration ou un poids par paquet", () => {
  const ingredients = [
    "150 g de farine", "½ chou", "1 1/2 c. à café", "1,25 l",
    "2 à 3 pommes", "Sel selon le goût", "25 % de matières grasses",
    "2 × 200 g", "1/0 g",
  ];
  expect(scaleIngredients(ingredients, 4, 8)).toEqual([
    "300 g de farine", "1 chou", "3 c. à café", "2,5 l",
    "4 à 6 pommes", "Sel selon le goût", "25 % de matières grasses",
    "2 × 200 g", "1/0 g",
  ]);
  expect(scaleIngredients(ingredients, 4, 4)).toEqual(ingredients);
});

it("préserve entièrement les concentrations écrites en fraction ou en plage", () => {
  const ingredients = [
    "1 1/2 % de sel", "2 à 3 % de lait", "1,5 % de levure",
    "1½ % de sel", "1/2 à 3/4 % de lait", "2 x 200 g",
  ];
  expect(scaleIngredients(ingredients, 4, 8)).toEqual(ingredients);
});

it("ajuste chaque mesure accolée en préservant les poids d’emballage et les noms", () => {
  expect(scaleIngredients([
    "1 kg 500 g de pommes", "1 l 25 cl de lait", "1 boîte de 400 g de tomates",
    "200 g de farine T55", "2 sachets de 11 g", "1 kg 2 g 20 mg de sel",
  ], 4, 8)).toEqual([
    "2 kg 1 000 g de pommes", "2 l 50 cl de lait", "2 boîte de 400 g de tomates",
    "400 g de farine T55", "4 sachets de 11 g", "2 kg 4 g 40 mg de sel",
  ]);
});

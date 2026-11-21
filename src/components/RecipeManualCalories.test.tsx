import { fireEvent, render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { RecipeForm } from "./RecipeForm";
import { MANUAL_CALORIES_LABELS, MANUAL_CALORIES_UNITS, type ManualCaloriesUnit } from "../services/manualCalories";
import type { Category } from "../types";

const cases = (['sale', 'sucre'] as const).flatMap((category) =>
  MANUAL_CALORIES_UNITS.map((unit) => ({ category, unit })),
);

function openFinalForm(category: Category) {
  const onSave = vi.fn();
  render(<RecipeForm onSave={onSave} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText("Le nom de votre recette"), {
    target: { value: "Recette test" },
  });
  if (category === "sucre") fireEvent.click(screen.getByRole("button", { name: "Sucré" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.change(screen.getByLabelText("Ingrédient 1"), { target: { value: "100 g de farine" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.change(screen.getByLabelText("Étape 1"), { target: { value: "Mélanger." } });
  return onSave;
}

it.each(cases)("saisit et sauvegarde les calories $unit pour une recette $category", ({ category, unit }) => {
  const onSave = openFinalForm(category);
  const input = screen.getByLabelText("Calories (kcal)");
  expect(input).toHaveAttribute("inputmode", "numeric");
  expect(input).toHaveAttribute("min", "0");
  expect(input).toHaveAttribute("max", "100000");
  fireEvent.change(input, { target: { value: "320" } });
  fireEvent.click(screen.getByRole("button", { name: MANUAL_CALORIES_LABELS[unit] }));
  expect(screen.getByRole("button", { name: MANUAL_CALORIES_LABELS[unit] })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    category,
    caloriesValue: 320,
    caloriesUnit: unit,
  }), undefined);
});

it("enregistre une valeur vide sans unité", () => {
  const onSave = openFinalForm("sale");
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ caloriesValue: null, caloriesUnit: null }), undefined);
});

it("refuse une valeur de calories fractionnaire avant sauvegarde", () => {
  const onSave = openFinalForm("sucre");
  fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "12.5" } });
  fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }).closest("form")!);
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("nombre entier de calories");
});

it("préremplit les calories en modification et permet de les effacer", () => {
  const recipe = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Recette à modifier",
    category: "sale" as const,
    ingredients: ["100 g de farine"],
    steps: ["Mélanger."],
    image_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    caloriesValue: 245,
    caloriesUnit: "per_100g" as ManualCaloriesUnit,
  };
  const onSave = vi.fn();
  render(<RecipeForm recipe={recipe} onSave={onSave} onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
  expect(screen.getByLabelText("Calories (kcal)")).toHaveValue(245);
  expect(screen.getByRole("button", { name: "Pour 100 g" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ caloriesValue: null, caloriesUnit: null }), recipe.id);
});

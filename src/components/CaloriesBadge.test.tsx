import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaloriesBadge } from "./CaloriesBadge";

it("affiche exactement la valeur manuelle et omet le badge quand elle est effacée", () => {
  const { rerender } = render(<CaloriesBadge recipe={{ caloriesValue: 320, caloriesUnit: "per_serving" }} />);
  expect(screen.getByText("320 kcal / part")).toBeInTheDocument();
  rerender(<CaloriesBadge recipe={{ caloriesValue: null, caloriesUnit: null }} />);
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument();
});

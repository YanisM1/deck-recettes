import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "./App";
import * as sync from "./services/recipeSync";
import { setPreferences } from "./services/preferences";
import { starterRecipes } from "./data/recipes";
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

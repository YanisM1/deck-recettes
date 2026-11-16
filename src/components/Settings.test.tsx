import { it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "../App";
import { PREFERENCES_KEY, setPreferences } from "../services/preferences";
it("ouvre les réglages et applique une des dix palettes", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Dracula" }));
  expect(screen.getByRole("main")).toHaveAttribute("data-theme", "dracula");
  expect(document.documentElement.style.getPropertyValue("--bg-main")).toBe(
    "#282a36",
  );
  expect(screen.getByRole("button", { name: "Dracula" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it.each(["cards", "book"] as const)(
  "cumule les filtres et accepte une sélection vide en mode %s",
  (mode) => {
    act(() => setPreferences({ layoutMode: mode }));
    const { container } = render(<App />);
    const count = () =>
      container
        .querySelector(".book-page-navigation p,.deck-pagination p")
        ?.textContent?.replace(/\s/g, "");
    fireEvent.click(screen.getByRole("button", { name: "Sucré" }));
    expect(screen.getByRole("button", { name: "Sucré" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(count()).toBe(mode === "book" ? "Page1sur2" : "01/02");
    fireEvent.click(screen.getByRole("button", { name: "Salé" }));
    expect(screen.getByText("Un peu plus de choix ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sucré" }));
    expect(count()).toBe(mode === "book" ? "Page1sur2" : "01/02");
    fireEvent.click(screen.getByRole("button", { name: "Salé" }));
    expect(count()).toBe(mode === "book" ? "Page1sur4" : "01/04");
  },
);
it("bascule Cartes/Livre dans les réglages et persiste le choix", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
  fireEvent.click(screen.getByRole("button", { name: "Livre de recettes" }));
  expect(screen.getByRole("main")).toHaveAttribute("data-layout", "book");
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).layoutMode).toBe(
    "book",
  );
  fireEvent.click(screen.getByRole("button", { name: "Paquet de cartes" }));
  expect(screen.getByRole("main")).toHaveAttribute("data-layout", "cards");
});

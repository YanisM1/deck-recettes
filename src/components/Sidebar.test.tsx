import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
it("présente trois boutons sans texte visible et conserve les noms accessibles", () => {
  const toggle = vi.fn(),
    add = vi.fn();
  render(
    <Sidebar
      filters={{ sale: true, sucre: false }}
      onToggle={toggle}
      onAdd={add}
    />,
  );
  const sale = screen.getByRole("button", { name: "Salé" }),
    sweet = screen.getByRole("button", { name: "Sucré" });
  expect(sale.textContent).toBe("");
  expect(sweet.textContent).toBe("");
  expect(sale.querySelector(".sidebar-icon")).not.toBeNull();
  expect(sweet).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(sweet);
  expect(toggle).toHaveBeenCalledWith("sucre");
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une recette" }));
  expect(add).toHaveBeenCalledOnce();
});

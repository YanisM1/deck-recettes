import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { CardDeck } from "./CardDeck";
import { starterRecipes } from "../data/recipes";
import { TRANSITION_FALLBACK_MS } from "../hooks/useDirectNavigation";

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("PointerEvent", MouseEvent); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("suit le doigt sans rendu React et fait remonter la carte suivante", () => {
  const commits = vi.fn();
  const { container } = render(<Profiler id="deck" onRender={commits}><CardDeck recipes={starterRecipes} onOpen={() => {}} /></Profiler>);
  const scene = container.querySelector(".deck-scene")!;
  const current = container.querySelector<HTMLElement>('[data-layer="0"]')!;
  const next = container.querySelector<HTMLElement>('[data-layer="1"]')!;
  const initialCommits = commits.mock.calls.length;
  fireEvent.pointerDown(scene, { clientX: 110, clientY: 300, button: 0 });
  act(() => vi.advanceTimersByTime(100));
  fireEvent.pointerMove(scene, { clientX: 210, clientY: 300 });
  act(() => vi.advanceTimersByTime(20));
  expect(current.style.transform).toContain("translate3d(100px, 4px, 0)");
  expect(current.style.transform).toContain("5deg");
  expect(next.style.transform).not.toContain("scale3d(0.975,");
  expect(current.style.transition).toBe("none");
  expect(commits).toHaveBeenCalledTimes(initialCommits);
  fireEvent.pointerUp(scene, { clientX: 210, clientY: 300 });
  act(() => vi.advanceTimersByTime(32));
  expect(current.style.transform).toContain("translate3d(150%, 20px, 0)");
  expect(scene).toHaveAttribute("data-active-index", "0");
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(scene).toHaveAttribute("data-active-index", "1");
  expect(commits).toHaveBeenCalledTimes(initialCommits + 1);
});

it("place une vraie fin sous la dernière recette et ramène la précédente depuis la droite", () => {
  const { container } = render(<CardDeck recipes={starterRecipes.slice(0, 1)} onOpen={() => {}} />);
  expect(container.querySelector('[data-layer="1"].deck-end-card')).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Recette suivante" }));
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByRole("heading", { name: "Fin du paquet" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Recette suivante" })).toBeDisabled();
  const scene = container.querySelector(".deck-scene")!;
  fireEvent.pointerDown(scene, { clientX: 260, clientY: 300, button: 0 });
  fireEvent.pointerMove(scene, { clientX: 160, clientY: 300 });
  act(() => vi.advanceTimersByTime(20));
  expect(container.querySelector<HTMLElement>('[data-layer="-1"]')!.style.transform).toContain("translate3d(calc(150% - 100px),");
  expect(container.querySelector<HTMLElement>('[data-layer="0"]')!.style.transform).toContain("translate3d(0, 0px, 0)");
  fireEvent.pointerUp(scene, { clientX: 160, clientY: 300 });
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByRole("button", { name: `Lire ${starterRecipes[0].title}` })).toBeInTheDocument();
});

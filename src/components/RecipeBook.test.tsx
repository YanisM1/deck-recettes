import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RecipeBook } from "./RecipeBook";
import { starterRecipes } from "../data/recipes";
import { TRANSITION_FALLBACK_MS, MOTION_TRANSITION } from "../hooks/useDirectNavigation";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("tourne la feuille autour de la reliure, revient et ouvre la recette courante", () => {
  vi.useFakeTimers();
  const open = vi.fn();
  const { container } = render(<RecipeBook recipes={starterRecipes} onOpen={open} />);
  expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
  act(() => vi.advanceTimersByTime(32));
  const current = container.querySelector<HTMLElement>('[data-book-layer="current"]')!;
  expect(current.style.transform).toBe("rotateY(-180deg)");
  expect(current.style.transition).toBe(MOTION_TRANSITION);
  expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByText("Page 2 sur 4")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `Lire ${starterRecipes[1].title}` }));
  expect(open).toHaveBeenCalledWith(starterRecipes[1]);
  fireEvent.click(screen.getByRole("button", { name: "Page précédente" }));
  act(() => vi.advanceTimersByTime(32));
  const previous = container.querySelector<HTMLElement>('[data-book-layer="previous"]')!;
  expect(previous.style.transform).toBe("rotateY(0deg)");
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument();
});

it("suit le doigt en 3D et respecte le sens des gestes et de la molette", () => {
  vi.useFakeTimers();
  vi.stubGlobal("PointerEvent", MouseEvent);
  const { container } = render(<RecipeBook recipes={starterRecipes} onOpen={() => {}} />);
  const scene = container.querySelector<HTMLElement>(".book-scene")!;
  fireEvent.pointerDown(scene, { clientX: 230, clientY: 300, button: 0 });
  fireEvent.pointerMove(scene, { clientX: 120, clientY: 304, button: 0 });
  act(() => vi.advanceTimersByTime(16));
  const current = container.querySelector<HTMLElement>('[data-book-layer="current"]')!;
  expect(current.style.transform).toBe(`rotateY(${-110 / 240 * 180}deg)`);
  expect(current.style.transition).toBe("none");
  expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument();
  fireEvent.pointerUp(scene, { clientX: 120, clientY: 304, button: 0 });
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByText("Page 2 sur 4")).toBeInTheDocument();
  fireEvent.wheel(scene, { deltaX: -90, deltaY: 0 });
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByText("Page 3 sur 4")).toBeInTheDocument();
  fireEvent.pointerDown(scene, { clientX: 120, clientY: 300, button: 0 });
  fireEvent.pointerMove(scene, { clientX: 230, clientY: 304, button: 0 });
  act(() => vi.advanceTimersByTime(16));
  const previous = container.querySelector<HTMLElement>('[data-book-layer="previous"]')!;
  expect(previous.style.transform).toBe(`rotateY(${-180 + 110 / 240 * 180}deg)`);
  expect(previous.style.visibility).toBe("visible");
  fireEvent.pointerUp(scene, { clientX: 230, clientY: 304, button: 0 });
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByText("Page 2 sur 4")).toBeInTheDocument();
  fireEvent.wheel(scene, { deltaX: 90, deltaY: 0 });
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument();
  fireEvent.wheel(scene, { deltaX: 0, deltaY: 100 });
  act(() => vi.advanceTimersByTime(32 + TRANSITION_FALLBACK_MS));
  expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument();
});

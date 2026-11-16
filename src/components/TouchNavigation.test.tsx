import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { CardDeck } from "./CardDeck";
import { RecipeBook } from "./RecipeBook";
import { starterRecipes } from "../data/recipes";
import { TRANSITION_FALLBACK_MS } from "../hooks/useDirectNavigation";

class TouchPointerEvent extends MouseEvent {
  readonly pointerId = 7;
  readonly pointerType = "touch";
  readonly isPrimary = true;
}
const modes = [
  { name: "Cartes", Component: CardDeck, sign: 1, scene: ".deck-scene", current: '[data-layer="0"]', next: "Recette suivante", heading: "Fin du paquet", reset: "🔄 Revenir au début" },
  { name: "Livre", Component: RecipeBook, sign: -1, scene: ".book-scene", current: '[data-book-layer="current"]', next: "Page suivante", heading: "Fin du Livre de Recettes", reset: "📖 Revenir au début du livre" },
] as const;
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const finish = () => tick(48 + TRANSITION_FALLBACK_MS);
const finger = (target: EventTarget, x: number, y = 300, identifier = 7) => ({ identifier, target, clientX: x, clientY: y });
function touch(target: Element, type: "touchstart" | "touchmove" | "touchend" | "touchcancel", points: ReturnType<typeof finger>[], changed = points) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { touches: { value: points }, changedTouches: { value: changed } });
  fireEvent(target, event);
  return event;
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("PointerEvent", TouchPointerEvent); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe.each(modes)("swipe au doigt — $name", mode => {
  function mount(count = 4) {
    const Component = mode.Component, open = vi.fn();
    const view = render(<Component recipes={starterRecipes.slice(0, count)} onOpen={open} />);
    return { ...view, open, scene: view.container.querySelector(mode.scene)! };
  }
  function swipe(target: Element, dx: number) {
    touch(target, "touchstart", [finger(target, 180)]);
    tick(100);
    touch(target, "touchmove", [finger(target, 180 + dx)]);
    tick(20);
    touch(target, "touchend", [], [finger(target, 180 + dx)]);
    finish();
  }
  it("continue après la perte de capture implicite du bouton et les événements Pointer tactiles", () => {
    const commits = vi.fn(), open = vi.fn(), Component = mode.Component;
    const { container } = render(<Profiler id="touch" onRender={commits}><Component recipes={starterRecipes} onOpen={open} /></Profiler>);
    const scene = container.querySelector(mode.scene)!;
    const target = screen.getByRole("button", { name: `Lire ${starterRecipes[0].title}` });
    const baseline = commits.mock.calls.length;
    fireEvent.pointerDown(target, { clientX: 180, clientY: 300, button: 0 });
    touch(target, "touchstart", [finger(target, 180)]);
    tick(100);
    fireEvent.pointerMove(target, { clientX: 180 + mode.sign * 40, clientY: 300 });
    touch(target, "touchmove", [finger(target, 180 + mode.sign * 40)]);
    // Real touch starts with implicit capture on the inner button. Transfer/loss
    // bubbles through the scene and is not the same thing as lifting the finger.
    fireEvent.lostPointerCapture(target);
    fireEvent.pointerCancel(target);
    tick(20);
    touch(target, "touchmove", [finger(target, 180 + mode.sign * 100)]);
    tick(20);
    expect(commits).toHaveBeenCalledTimes(baseline);
    expect(container.querySelector<HTMLElement>(mode.current)!.style.transform).not.toContain(mode.name === "Livre" ? "rotateY(0deg)" : "translate3d(0, 0px, 0)");
    touch(target, "touchend", [], [finger(target, 180 + mode.sign * 100)]);
    fireEvent.pointerUp(target, { clientX: 180 + mode.sign * 100, clientY: 300 });
    fireEvent.click(target, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
    finish();
    expect(scene).toHaveAttribute("data-active-index", "1");
    expect(commits).toHaveBeenCalledTimes(baseline + 1);
  });

  it("fonctionne sans aucun PointerEvent, jusqu’à la fin, au retour inverse et au reset", () => {
    const { scene } = mount(1);
    const target = screen.getByRole("button", { name: `Lire ${starterRecipes[0].title}` });
    swipe(target, mode.sign * 100);
    expect(scene).toHaveAttribute("data-active-index", "1");
    expect(screen.getByRole("heading", { name: mode.heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: mode.next })).toBeDisabled();
    swipe(scene, mode.sign * 100);
    expect(scene).toHaveAttribute("data-active-index", "1");
    swipe(screen.getByRole("button", { name: mode.reset }), -mode.sign * 100);
    expect(scene).toHaveAttribute("data-active-index", "0");
    swipe(scene, mode.sign * 100);
    const reset = screen.getByRole("button", { name: mode.reset });
    touch(reset, "touchstart", [finger(reset, 200)]);
    touch(reset, "touchend", [], [finger(reset, 200)]);
    fireEvent.click(reset, { detail: 1 });
    expect(scene).toHaveAttribute("data-active-index", "0");
  });

  it("bloque le scroll horizontal dans un listener non passif et conserve l’intention verticale", () => {
    const listeners = vi.spyOn(EventTarget.prototype, "addEventListener");
    const { scene } = mount();
    expect(listeners.mock.calls.some(([type, , options]) => type === "touchmove" && typeof options === "object" && options?.passive === false)).toBe(true);
    touch(scene, "touchstart", [finger(scene, 180)]);
    tick(100);
    const horizontal = touch(scene, "touchmove", [finger(scene, 180 + mode.sign * 90)]);
    expect(horizontal.defaultPrevented).toBe(true);
    touch(scene, "touchcancel", [], []);
    finish();
    expect(scene).toHaveAttribute("data-active-index", "0");
    touch(scene, "touchstart", [finger(scene, 180)]);
    const vertical = touch(scene, "touchmove", [finger(scene, 190, 420)]);
    expect(vertical.defaultPrevented).toBe(false);
    touch(scene, "touchend", [], [finger(scene, 180 + mode.sign * 120, 420)]);
    finish();
    expect(scene).toHaveAttribute("data-active-index", "0");
  });

  it("préserve le toucher simple pour ouvrir une recette et accepte le clic après swipe", () => {
    const { scene, open } = mount();
    const first = screen.getByRole("button", { name: `Lire ${starterRecipes[0].title}` });
    touch(first, "touchstart", [finger(first, 180)]);
    touch(first, "touchend", [], [finger(first, 180)]);
    fireEvent.click(first, { detail: 1 });
    expect(open).toHaveBeenCalledWith(starterRecipes[0]);
    swipe(first, mode.sign * 100);
    expect(scene).toHaveAttribute("data-active-index", "1");
    const next = screen.getByRole("button", { name: mode.next });
    touch(next, "touchstart", [finger(next, 330)]);
    touch(next, "touchend", [], [finger(next, 330)]);
    fireEvent.click(next, { detail: 1 });
    finish();
    expect(scene).toHaveAttribute("data-active-index", "2");
  });

  it("ignore la levée d’un autre doigt et utilise les dernières coordonnées sans attendre une frame", () => {
    const { scene } = mount();
    touch(scene, "touchstart", [finger(scene, 180)]);
    tick(100);
    touch(scene, "touchend", [finger(scene, 180)], [finger(scene, 500, 300, 8)]);
    touch(scene, "touchmove", [finger(scene, 180 + mode.sign * 100)]);
    touch(scene, "touchend", [], [finger(scene, 180 + mode.sign * 100)]);
    finish();
    expect(scene).toHaveAttribute("data-active-index", "1");
  });

  it("annule au deuxième doigt et libère le geste après touchcancel sans coordonnées", () => {
    const { scene } = mount();
    touch(scene, "touchstart", [finger(scene, 180)]);
    tick(100);
    touch(scene, "touchmove", [finger(scene, 180 + mode.sign * 90)]);
    tick(20);
    touch(scene, "touchstart", [finger(scene, 180 + mode.sign * 90), finger(scene, 250, 300, 8)]);
    finish();
    expect(scene).toHaveAttribute("data-active-index", "0");
    touch(scene, "touchend", [], [finger(scene, 180), finger(scene, 250, 300, 8)]);
    touch(scene, "touchstart", [finger(scene, 180)]);
    tick(100);
    touch(scene, "touchmove", [finger(scene, 180 + mode.sign * 100)]);
    touch(scene, "touchcancel", [], []);
    finish();
    expect(scene).toHaveAttribute("data-active-index", "0");
    swipe(scene, mode.sign * 100);
    expect(scene).toHaveAttribute("data-active-index", "1");
  });

  it("retire les listeners natifs et la frame en attente au démontage", () => {
    const { scene, unmount } = mount();
    touch(scene, "touchstart", [finger(scene, 180)]);
    tick(100);
    touch(scene, "touchmove", [finger(scene, 180 + mode.sign * 100)]);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    const afterUnmount = touch(scene, "touchmove", [finger(scene, 180 + mode.sign * 150)]);
    expect(afterUnmount.defaultPrevented).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

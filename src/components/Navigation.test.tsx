import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { CardDeck } from "./CardDeck";
import { RecipeBook } from "./RecipeBook";
import { starterRecipes } from "../data/recipes";
import { SETTLE_MS, TRANSITION_FALLBACK_MS, MOTION_TRANSITION } from "../hooks/useDirectNavigation";

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly isPrimary: boolean;
  constructor(type: string, init: MouseEventInit & { pointerId?: number; isPrimary?: boolean } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}

const modes = [
  {
    name: "Cartes", Component: CardDeck, sign: 1,
    scene: ".deck-scene", next: "Recette suivante", previous: "Recette précédente",
    heading: "Fin du paquet", reset: "🔄 Revenir au début",
    current: '[data-layer="0"]', previousLayer: '[data-layer="-1"]',
  },
  {
    name: "Livre", Component: RecipeBook, sign: -1,
    scene: ".book-scene", next: "Page suivante", previous: "Page précédente",
    heading: "Fin du Livre de Recettes", reset: "📖 Revenir au début du livre",
    current: '[data-book-layer="current"]', previousLayer: '[data-book-layer="previous"]',
  },
] as const;
type Mode = (typeof modes)[number];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("PointerEvent", TestPointerEvent);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const startTransition = () => tick(32);
const finishTransition = () => { startTransition(); tick(TRANSITION_FALLBACK_MS); };
function transitionEnd(element: Element, propertyName = "transform") {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(element, event);
}
const down = (scene: Element, x = 180, pointerId = 1, isPrimary = true) =>
  fireEvent.pointerDown(scene, { clientX: x, clientY: 300, button: 0, pointerId, isPrimary });
const move = (scene: Element, x: number, y = 300, pointerId = 1) =>
  fireEvent.pointerMove(scene, { clientX: x, clientY: y, pointerId });
const up = (scene: Element, x: number, y = 300, pointerId = 1) =>
  fireEvent.pointerUp(scene, { clientX: x, clientY: y, button: 0, pointerId });

function mount(mode: Mode, count = 4) {
  const commits = vi.fn(), open = vi.fn();
  const Component = mode.Component;
  const view = render(<Profiler id={mode.name} onRender={commits}>
    <Component recipes={starterRecipes.slice(0, count)} onOpen={open} />
  </Profiler>);
  const scene = view.container.querySelector<HTMLDivElement>(mode.scene)!;
  return { ...view, scene, commits, open };
}

function drag(scene: Element, dx: number, movementMs = 100, holdMs = 20) {
  down(scene);
  tick(movementMs);
  move(scene, 180 + dx);
  tick(holdMs);
  up(scene, 180 + dx);
}

describe.each(modes)("navigation directe — $name", mode => {
  it.each([1, 4])("atteint la vraie fin après %i recettes, revient par geste inverse puis remet à zéro", count => {
    const { scene, container } = mount(mode, count);
    for (let i = 0; i < count; i++) {
      expect(scene).toHaveAttribute("data-active-index", String(i));
      expect(screen.getByRole("button", { name: mode.next })).toBeEnabled();
      if (i === count - 1) {
        const underneath = mode.name === "Cartes"
          ? container.querySelector('[data-layer="1"].deck-end-card')
          : container.querySelector('[data-book-layer="next"] .book-end-cover');
        expect(underneath).toBeInTheDocument();
        if (mode.name === "Livre") {
          expect(container.querySelector('[data-book-layer="next"] .book-paper')).not.toBeInTheDocument();
        }
      }
      fireEvent.click(screen.getByRole("button", { name: mode.next }));
      expect(scene).toHaveAttribute("data-active-index", String(i));
      finishTransition();
    }
    expect(scene).toHaveAttribute("data-active-index", String(count));
    expect(screen.getByRole("heading", { name: mode.heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: mode.next })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Lire / })).not.toBeInTheDocument();
    if (mode.name === "Cartes") {
      expect(container.querySelector('[data-layer="1"]')).not.toBeInTheDocument();
    } else {
      expect(container.querySelector(".book-page-stack")).not.toBeInTheDocument();
      expect(container.querySelector('[data-book-layer="current"] .book-paper')).not.toBeInTheDocument();
      expect(container.querySelector('[data-book-layer="next"]')).not.toBeInTheDocument();
    }

    // There is no forward item after the real endpoint, including by swipe.
    drag(scene, mode.sign * 100);
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", String(count));

    // The last recipe returns physically over the endpoint.
    down(scene);
    tick(100);
    move(scene, 180 - mode.sign * 100);
    tick(20);
    const previous = container.querySelector<HTMLElement>(mode.previousLayer)!;
    if (mode.name === "Cartes") {
      expect(previous.style.opacity).toBe("1");
      expect(previous.style.transform).toContain("translate3d(calc(150% - 100px),");
      expect(container.querySelector<HTMLElement>(mode.current)!.style.transform).toContain("translate3d(0, 0px, 0)");
    } else {
      expect(previous.style.visibility).toBe("visible");
      expect(previous.style.opacity).toBe("");
      const angle = Number(previous.style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1]);
      expect(angle).toBeCloseTo(-180 + 100 / 240 * 180);
    }
    up(scene, 180 - mode.sign * 100);
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", String(count - 1));
    expect(screen.getByRole("button", { name: `Lire ${starterRecipes[count - 1].title}` })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    finishTransition();
    fireEvent.click(screen.getByRole("button", { name: mode.reset }));
    expect(scene).toHaveAttribute("data-active-index", "0");
    expect(screen.getByRole("button", { name: `Lire ${starterRecipes[0].title}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: mode.previous })).toBeDisabled();
  });

  it("ne produit aucun rendu React pendant le suivi du doigt, puis valide une seule fois", () => {
    const { scene, container, commits, open } = mount(mode);
    const baseline = commits.mock.calls.length;
    down(scene);
    for (const distance of [20, 40, 60, 80, 100]) {
      tick(25);
      move(scene, 180 + mode.sign * distance);
      tick(20);
    }
    const current = container.querySelector<HTMLElement>(mode.current)!;
    expect(current.style.transition).toBe("none");
    if (mode.name === "Cartes") expect(current.style.transform).toContain("translate3d(100px, 4px, 0)");
    else {
      const angle = Number(current.style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1]);
      expect(angle).toBeCloseTo(-100 / 240 * 180);
    }
    expect(commits).toHaveBeenCalledTimes(baseline);
    expect(scene).toHaveAttribute("data-active-index", "0");
    up(scene, 180 + mode.sign * 100);
    startTransition();
    expect(current.style.transition).toBe(MOTION_TRANSITION);
    expect(commits).toHaveBeenCalledTimes(baseline);
    expect(scene).toHaveAttribute("aria-busy", "true");
    // A generated compatibility click must not open the recipe after a drag.
    fireEvent.click(screen.getByRole("button", { name: `Lire ${starterRecipes[0].title}` }), { detail: 1 });
    expect(open).not.toHaveBeenCalled();
    tick(SETTLE_MS - 1);
    expect(scene).toHaveAttribute("data-active-index", "0");
    tick(1);
    transitionEnd(current);
    expect(scene).toHaveAttribute("data-active-index", "1");
    expect(scene).toHaveAttribute("aria-busy", "false");
    expect(commits).toHaveBeenCalledTimes(baseline + 1);
  });

  it.each([
    { label: "petit glissement lent", distance: 40, movementMs: 200, holdMs: 20, expected: "0" },
    { label: "flick rapide sous le seuil de distance", distance: 20, movementMs: 10, holdMs: 20, expected: "1" },
    { label: "flick suivi d’une pause", distance: 40, movementMs: 10, holdMs: 120, expected: "0" },
    { label: "distance égale au seuil sans vitesse suffisante", distance: 65, movementMs: 250, holdMs: 20, expected: "0" },
    { label: "distance au-delà du seuil sans vitesse suffisante", distance: 66, movementMs: 250, holdMs: 20, expected: "1" },
  ])("applique correctement le seuil : $label", ({ distance, movementMs, holdMs, expected }) => {
    const { scene, container, commits } = mount(mode);
    const baseline = commits.mock.calls.length;
    drag(scene, mode.sign * distance, movementMs, holdMs);
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", expected);
    expect(commits).toHaveBeenCalledTimes(baseline + Number(expected));
    const current = container.querySelector<HTMLElement>(mode.current)!;
    expect(current.style.transform).toContain(mode.name === "Cartes" ? "translate3d(0, 0px, 0)" : "rotateY(0deg)");
  });

  it.each(["pointercancel", "lostpointercapture"])("annule un geste avec %s sans changer de recette", eventName => {
    const { scene, container } = mount(mode);
    const initialPose = container.querySelector<HTMLElement>(mode.current)!.style.transform;
    down(scene);
    tick(100);
    move(scene, 180 + mode.sign * 100);
    tick(20);
    fireEvent(scene, new TestPointerEvent(eventName, {
      // Cancellation may omit coordinates entirely (0,0); preserve the last pose.
      bubbles: true, pointerId: 1,
    }));
    const cancelling = container.querySelector<HTMLElement>(mode.current)!;
    startTransition();
    expect(cancelling.style.transition).toBe(MOTION_TRANSITION);
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "0");
    expect(container.querySelector<HTMLElement>(mode.current)!.style.transform).toBe(initialPose);
    expect(scene).toHaveAttribute("aria-busy", "false");
  });

  it("ignore les pointeurs secondaires sans perdre le geste du pointeur principal", () => {
    const { scene, container } = mount(mode);
    const current = container.querySelector<HTMLElement>(mode.current)!;
    const initialPose = current.style.transform;
    down(scene, 180, 2, false);
    move(scene, 180 + mode.sign * 100, 300, 2);
    up(scene, 180 + mode.sign * 100, 300, 2);
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "0");
    expect(current.style.transform).toBe(initialPose);

    down(scene, 180, 1);
    tick(100);
    down(scene, 180, 2, false);
    fireEvent.pointerLeave(scene, { pointerId: 2 });
    move(scene, 180 + mode.sign * 100, 300, 2);
    up(scene, 180 + mode.sign * 100, 300, 2);
    tick(20);
    expect(current.style.transform).toBe(initialPose);
    move(scene, 180 + mode.sign * 100, 300, 1);
    tick(20);
    up(scene, 180 + mode.sign * 100, 300, 1);
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "1");
  });

  it("conserve l’intention verticale et ignore la molette verticale", () => {
    const { scene, container, commits } = mount(mode);
    const current = container.querySelector<HTMLElement>(mode.current)!;
    const initialPose = current.style.transform, baseline = commits.mock.calls.length;
    down(scene);
    tick(100);
    move(scene, 180 + mode.sign * 20, 400);
    tick(20);
    move(scene, 180 + mode.sign * 120, 400);
    tick(20);
    up(scene, 180 + mode.sign * 120, 400);
    fireEvent.wheel(scene, { deltaX: 0, deltaY: 150 });
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "0");
    expect(current.style.transform).toBe(initialPose);
    expect(commits).toHaveBeenCalledTimes(baseline);
  });

  it("bloque les doubles commandes pendant la transition et garde les raccourcis clavier", () => {
    const { scene } = mount(mode);
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    fireEvent.wheel(scene, { deltaX: mode.sign * 90, deltaY: 0 });
    fireEvent.keyDown(scene, { key: "ArrowRight" });
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "1");
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "1");
    fireEvent.keyDown(scene, { key: "ArrowLeft" });
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "0");
    fireEvent.wheel(scene, { deltaX: mode.sign * 90, deltaY: 0 });
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "1");
  });

  it("annule la frame en attente et le temporisateur au démontage", () => {
    const first = mount(mode);
    down(first.scene);
    tick(100);
    move(first.scene, 180 + mode.sign * 100);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    first.unmount();
    expect(vi.getTimerCount()).toBe(0);
    const second = mount(mode);
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
    tick(SETTLE_MS * 2);
  });

  it("libère un pointeur sorti avant le début du glissement", () => {
    const { scene } = mount(mode);
    down(scene);
    fireEvent.pointerLeave(scene, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "1");
  });

  it("conserve les mêmes cartes/pages et images lorsqu’elles changent de rôle", () => {
    const { scene, container } = mount(mode);
    const first = container.querySelector<HTMLElement>(`[data-recipe-id="${starterRecipes[0].id}"]`)!;
    const second = container.querySelector<HTMLElement>(`[data-recipe-id="${starterRecipes[1].id}"]`)!;
    const firstImage = first.querySelector("img"), secondImage = second.querySelector("img");
    expect(firstImage).not.toBeNull();
    expect(secondImage).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    startTransition();
    transitionEnd(first);
    expect(scene).toHaveAttribute("data-active-index", "1");
    expect(container.querySelector(mode.current)).toBe(second);
    expect(second.querySelector("img")).toBe(secondImage);
    expect(container.querySelector(mode.previousLayer)).toBe(first);
    expect(first.querySelector("img")).toBe(firstImage);

    fireEvent.click(screen.getByRole("button", { name: mode.previous }));
    startTransition();
    if (mode.name === "Livre") {
      expect(first.style.opacity).toBe("");
      expect(second.style.opacity).toBe("");
    }
    transitionEnd(first);
    expect(scene).toHaveAttribute("data-active-index", "0");
    expect(container.querySelector(mode.current)).toBe(first);
    expect(first.querySelector("img")).toBe(firstImage);
    expect(second.querySelector("img")).toBe(secondImage);
  });

  it("termine sur la transition principale une seule fois et ignore les transitions enfants", () => {
    const { scene, container, commits } = mount(mode);
    const current = container.querySelector<HTMLElement>(mode.current)!;
    const baseline = commits.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    // A late event from an older motion must not finish this one before CSS starts.
    transitionEnd(current);
    expect(scene).toHaveAttribute("data-active-index", "0");
    startTransition();
    transitionEnd(current.querySelector("img")!);
    transitionEnd(current, "opacity");
    transitionEnd(container.querySelector('[data-motion-offset="1"]')!);
    expect(scene).toHaveAttribute("data-active-index", "0");
    transitionEnd(current);
    expect(scene).toHaveAttribute("data-active-index", "1");
    transitionEnd(current);
    tick(TRANSITION_FALLBACK_MS * 2);
    expect(scene).toHaveAttribute("data-active-index", "1");
    expect(commits).toHaveBeenCalledTimes(baseline + 1);
  });

  it("utilise le délai de secours si le navigateur ne transmet pas transitionend", () => {
    const { scene } = mount(mode);
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    startTransition();
    tick(TRANSITION_FALLBACK_MS - 1);
    expect(scene).toHaveAttribute("data-active-index", "0");
    tick(1);
    expect(scene).toHaveAttribute("data-active-index", "1");
  });

  it("accepte un nouveau toucher volontaire immédiatement après un swipe terminé", () => {
    const { scene, container } = mount(mode);
    drag(scene, mode.sign * 100);
    startTransition();
    tick(SETTLE_MS);
    transitionEnd(container.querySelector(mode.current)!);
    expect(scene).toHaveAttribute("data-active-index", "1");
    const next = screen.getByRole("button", { name: mode.next });
    // Real clicks have detail=1 and a fresh pointerdown, unlike fireEvent.click defaults.
    fireEvent.pointerDown(next, { clientX: 330, clientY: 690, button: 0, pointerId: 1 });
    fireEvent.pointerUp(next, { clientX: 330, clientY: 690, button: 0, pointerId: 1 });
    fireEvent.click(next, { detail: 1 });
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "2");
  });

  it("ne mesure pas le DOM pendant le glissement ni le relâchement", () => {
    const { scene } = mount(mode);
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get");
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get");
    drag(scene, mode.sign * 100);
    finishTransition();
    expect(scene).toHaveAttribute("data-active-index", "1");
    expect(bounds).not.toHaveBeenCalled();
    expect(width).not.toHaveBeenCalled();
    expect(height).not.toHaveBeenCalled();
  });

  it("respecte le mouvement réduit et permet le tap clavier de la recette", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { scene, open } = mount(mode);
    fireEvent.click(screen.getByRole("button", { name: mode.next }));
    expect(scene).toHaveAttribute("data-active-index", "1");
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: `Lire ${starterRecipes[1].title}` }), { detail: 0 });
    expect(open).toHaveBeenCalledWith(starterRecipes[1]);
  });
});

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type TransitionEvent } from "react";

export const SETTLE_MS = 300;
export const TRANSITION_FALLBACK_MS = SETTLE_MS + 80;
export const MOTION_TRANSITION = "transform 0.3s ease-out, opacity 0.3s ease-out";
type Direction = -1 | 0 | 1;
type Input = { kind: "touch" | "pointer"; id: number };
type Point = { clientX: number; clientY: number };
type Options = {
  maxIndex: number;
  gestureSign: 1 | -1;
  extent: number;
  paint: (dx: number, direction: Direction, animate: boolean) => void;
};

// React owns only the settled index. Native input -> refs -> one DOM paint/frame.
// Touch never transfers pointer capture: Safari keeps delivering the original
// finger's TouchEvents even while a page rotates away from the hit-test position.
export function useDirectNavigation({ maxIndex, gestureSign, extent, paint }: Options) {
  const [index, setIndex] = useState(0);
  const scene = useRef<HTMLDivElement>(null);
  const input = useRef<Input | null>(null);
  const startX = useRef(0), startY = useRef(0), currentX = useRef(0);
  const lastX = useRef(0), lastTime = useRef(0), velocityX = useRef(0);
  const intent = useRef<"pending" | "horizontal" | "vertical">("pending");
  const direction = useRef<Direction>(0), busy = useRef(false);
  const suppressUntil = useRef(0), painter = useRef(paint);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completeTransition = useRef<(() => void) | null>(null);
  const transitionStarted = useRef(false);
  useLayoutEffect(() => { painter.current = paint; });

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const available = useCallback((delta: Direction) => delta !== 0 && index + delta >= 0 && index + delta <= maxIndex, [index, maxIndex]);
  const setBusy = (value: boolean) => {
    busy.current = value;
    scene.current?.setAttribute("aria-busy", String(value));
  };
  const settle = useCallback((delta: Direction, from: Direction) => {
    if (busy.current) return;
    cancelFrame();
    if (from === 0) { painter.current(0, 0, false); return; }
    const commit = available(delta);
    const complete = () => {
      if (completeTransition.current !== complete) return;
      completeTransition.current = null;
      transitionStarted.current = false;
      clearTimeout(timer.current);
      cancelFrame();
      setBusy(false);
      direction.current = 0;
      if (commit) setIndex(value => value + delta);
      else painter.current(0, 0, false);
    };
    completeTransition.current = complete;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { complete(); return; }
    setBusy(true);
    direction.current = from;
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        transitionStarted.current = true;
        painter.current(commit ? delta * gestureSign * extent : 0, from, true);
        timer.current = setTimeout(complete, TRANSITION_FALLBACK_MS);
      });
    });
  }, [available, cancelFrame, extent, gestureSign]);
  const go = useCallback((delta: -1 | 1) => {
    if (busy.current || input.current || !available(delta)) return;
    painter.current(0, delta, false);
    settle(delta, delta);
  }, [available, settle]);
  const reset = useCallback(() => {
    if (busy.current || input.current) return;
    painter.current(0, 0, false);
    setIndex(0);
  }, []);
  useLayoutEffect(() => { painter.current(0, 0, false); }, [index]);

  const begin = useCallback((next: Input, point: Point, target: EventTarget | null) => {
    if (busy.current || input.current) return;
    suppressUntil.current = 0;
    if (target instanceof Element && target.closest("[data-gesture-ignore]")) return;
    input.current = next;
    startX.current = currentX.current = lastX.current = point.clientX;
    startY.current = point.clientY;
    lastTime.current = performance.now();
    velocityX.current = 0;
    direction.current = 0;
    intent.current = "pending";
    painter.current(0, 0, false);
  }, []);
  const update = useCallback((point: Point) => {
    const now = performance.now(), elapsed = now - lastTime.current;
    currentX.current = point.clientX;
    if (point.clientX !== lastX.current) {
      velocityX.current = (point.clientX - lastX.current) / Math.max(1, elapsed);
      lastX.current = point.clientX;
      lastTime.current = now;
    } else if (elapsed > 80) velocityX.current = 0;
    const dx = point.clientX - startX.current, dy = point.clientY - startY.current;
    if (intent.current === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 5) {
      intent.current = Math.abs(dx) > Math.abs(dy) * 1.15 ? "horizontal" : "vertical";
    }
    const delta = (Math.sign(dx) * gestureSign) as Direction;
    direction.current = available(delta) ? delta : 0;
    return dx;
  }, [available, gestureSign]);
  const move = useCallback((point: Point) => {
    update(point);
    if (intent.current !== "horizontal") return false;
    suppressUntil.current = Date.now() + 450;
    if (frame.current === null) frame.current = requestAnimationFrame(() => {
      frame.current = null;
      painter.current(direction.current ? currentX.current - startX.current : 0, direction.current, false);
    });
    return true;
  }, [update]);
  const end = useCallback((point?: Point, cancelled = false) => {
    if (!input.current) return;
    const dx = !cancelled && point ? update(point) : currentX.current - startX.current;
    input.current = null;
    cancelFrame();
    const from = direction.current;
    if (intent.current === "horizontal") {
      suppressUntil.current = Date.now() + 450;
      painter.current(from ? dx : 0, from, false);
      settle(!cancelled && (Math.abs(dx) > 65 || Math.abs(velocityX.current) > 0.35) ? from : 0, from);
    } else painter.current(0, 0, false);
  }, [cancelFrame, settle, update]);

  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const matches = (kind: Input["kind"], id: number) => input.current?.kind === kind && input.current.id === id;
    const findFinger = (points: TouchList) => {
      for (let i = 0; i < points.length; i++) if (points[i].identifier === input.current?.id) return points[i];
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        if (input.current?.kind === "touch") end(undefined, true);
        return;
      }
      const point = event.touches[0];
      begin({ kind: "touch", id: point.identifier }, point, event.target);
    };
    const touchMove = (event: TouchEvent) => {
      if (input.current?.kind !== "touch") return;
      if (event.touches.length !== 1) { end(undefined, true); return; }
      const point = findFinger(event.touches);
      if (point && move(point) && event.cancelable) event.preventDefault();
    };
    const touchEnd = (event: TouchEvent) => {
      if (input.current?.kind !== "touch") return;
      const point = findFinger(event.changedTouches);
      if (point) end(point);
    };
    const touchCancel = (event: TouchEvent) => {
      if (input.current?.kind === "touch" && (event.changedTouches.length === 0 || findFinger(event.changedTouches))) end(undefined, true);
    };
    const pointerDown = (event: PointerEvent) => {
      // Do not process the same finger twice through Touch and Pointer streams.
      if (event.pointerType === "touch" && "TouchEvent" in window) return;
      if (event.button !== 0 || event.isPrimary === false) return;
      begin({ kind: "pointer", id: event.pointerId ?? 0 }, event, event.target);
    };
    const pointerMove = (event: PointerEvent) => {
      if (matches("pointer", event.pointerId ?? 0) && move(event) && event.cancelable) event.preventDefault();
    };
    const pointerUp = (event: PointerEvent) => {
      if (matches("pointer", event.pointerId ?? 0)) end(event);
    };
    const pointerCancel = (event: PointerEvent) => {
      if (matches("pointer", event.pointerId ?? 0)) end(undefined, true);
    };
    const pointerLeave = (event: PointerEvent) => {
      if (matches("pointer", event.pointerId ?? 0) && intent.current !== "horizontal") end(undefined, true);
    };
    const blur = () => end(undefined, true);
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > 12 && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        go((Math.sign(event.deltaX) * gestureSign) as -1 | 1);
      }
    };
    element.addEventListener("touchstart", touchStart, { passive: true });
    // React's delegated touchmove can be passive. This listener must be native.
    element.addEventListener("touchmove", touchMove, { passive: false });
    element.addEventListener("touchend", touchEnd, { passive: true });
    element.addEventListener("touchcancel", touchCancel, { passive: true });
    element.addEventListener("pointerdown", pointerDown, { passive: true });
    element.addEventListener("pointerleave", pointerLeave);
    element.addEventListener("wheel", wheel, { passive: false });
    // Mouse/pen keeps working outside the moving card without capture transfers.
    window.addEventListener("pointermove", pointerMove, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
    window.addEventListener("blur", blur);
    return () => {
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("touchend", touchEnd);
      element.removeEventListener("touchcancel", touchCancel);
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("pointerleave", pointerLeave);
      element.removeEventListener("wheel", wheel);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("blur", blur);
    };
  }, [begin, end, gestureSign, go, move]);
  useEffect(() => () => {
    input.current = null;
    cancelFrame();
    clearTimeout(timer.current);
    completeTransition.current = null;
  }, [cancelFrame]);
  return {
    index, go, reset, scene, isBusy: () => busy.current,
    gestures: {
      onTransitionEnd: (event: TransitionEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        const movingOffset = direction.current === -1 ? "-1" : "0";
        if (transitionStarted.current && event.propertyName === "transform" && target.dataset.motionOffset === movingOffset) completeTransition.current?.();
      },
      onDragStart: (event: DragEvent) => event.preventDefault(),
      onClickCapture: (event: MouseEvent) => {
        if (event.detail !== 0 && (busy.current || Date.now() < suppressUntil.current)) {
          suppressUntil.current = 0;
          event.preventDefault(); event.stopPropagation();
        }
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault(); go(event.key === "ArrowRight" ? 1 : -1);
        }
      },
    },
  };
}

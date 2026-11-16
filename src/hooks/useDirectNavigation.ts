import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

export const SETTLE_MS = 380;
export const SPRING_TRANSITION = "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.38s ease";
type Direction = -1 | 0 | 1;
type Options = {
  maxIndex: number;
  gestureSign: 1 | -1;
  extent: number | "width";
  paint: (dx: number, direction: Direction, animate: boolean) => void;
};

// React owns the settled index. Pointer frames only write to mounted layers.
export function useDirectNavigation({ maxIndex, gestureSign, extent, paint }: Options) {
  const [index, setIndex] = useState(0);
  const scene = useRef<HTMLDivElement>(null);
  const startX = useRef(0), currentX = useRef(0), startY = useRef(0);
  const isDragging = useRef(false), lastX = useRef(0), velocityX = useRef(0);
  const lastTime = useRef(0), pointerId = useRef<number | null>(null);
  const intent = useRef<"pending" | "horizontal" | "vertical">("pending");
  const busy = useRef(false), suppressUntil = useRef(0);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const painter = useRef(paint), direction = useRef<Direction>(0);
  useLayoutEffect(() => { painter.current = paint; });
  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const available = useCallback((delta: Direction) => delta !== 0 && index + delta >= 0 && index + delta <= maxIndex, [index, maxIndex]);
  const distance = useCallback(() => extent === "width" ? scene.current?.getBoundingClientRect().width || 278 : extent, [extent]);
  const setBusy = (value: boolean) => {
    busy.current = value;
    scene.current?.setAttribute("aria-busy", String(value));
  };
  const settle = useCallback((delta: Direction, from: Direction) => {
    if (busy.current) return;
    cancelFrame();
    const commit = available(delta);
    const complete = () => {
      setBusy(false);
      direction.current = 0;
      if (commit) setIndex(value => value + delta);
      else painter.current(0, 0, false);
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { complete(); return; }
    setBusy(true);
    // Flush the finger pose once before the spring (never during pointermove).
    scene.current?.getBoundingClientRect();
    painter.current(commit ? delta * gestureSign * distance() : 0, from, true);
    timer.current = setTimeout(complete, SETTLE_MS);
  }, [available, cancelFrame, distance, gestureSign]);
  const go = useCallback((delta: -1 | 1) => {
    if (busy.current || isDragging.current || !available(delta)) return;
    painter.current(0, delta, false);
    settle(delta, delta);
  }, [available, settle]);
  const reset = useCallback(() => {
    if (busy.current || isDragging.current) return;
    painter.current(0, 0, false);
    setIndex(0);
  }, []);
  useLayoutEffect(() => { painter.current(0, 0, false); }, [index]);
  useEffect(() => () => { cancelFrame(); clearTimeout(timer.current); }, [cancelFrame]);
  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > 12 && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        go((Math.sign(event.deltaX) * gestureSign) as -1 | 1);
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [go, gestureSign]);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.isPrimary === false || busy.current || isDragging.current) return;
    if ((event.target as Element).closest("[data-gesture-ignore]")) return;
    startX.current = currentX.current = lastX.current = event.clientX;
    startY.current = event.clientY;
    velocityX.current = 0;
    lastTime.current = performance.now();
    pointerId.current = event.pointerId;
    isDragging.current = true;
    intent.current = "pending";
    direction.current = 0;
    painter.current(0, 0, false);
  };
  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    currentX.current = event.clientX;
    const now = performance.now(), elapsed = now - lastTime.current;
    if (event.clientX !== lastX.current) {
      velocityX.current = (event.clientX - lastX.current) / Math.max(1, elapsed);
      lastX.current = event.clientX;
      lastTime.current = now;
    } else if (elapsed > 80) velocityX.current = 0;
    const dx = currentX.current - startX.current, dy = event.clientY - startY.current;
    if (intent.current === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 5) {
      intent.current = Math.abs(dx) > Math.abs(dy) * 1.15 ? "horizontal" : "vertical";
      if (intent.current === "horizontal") event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const delta = (Math.sign(dx) * gestureSign) as Direction;
    direction.current = available(delta) ? delta : 0;
    return dx;
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || event.pointerId !== pointerId.current) return;
    updatePointer(event);
    if (intent.current !== "horizontal") return;
    event.preventDefault();
    suppressUntil.current = Date.now() + 450;
    if (frame.current === null) frame.current = requestAnimationFrame(() => {
      frame.current = null;
      painter.current(direction.current ? currentX.current - startX.current : 0, direction.current, false);
    });
  };
  const endPointer = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!isDragging.current || event.pointerId !== pointerId.current) return;
    const dx = updatePointer(event);
    isDragging.current = false;
    cancelFrame();
    const from = direction.current;
    if (intent.current === "horizontal") {
      suppressUntil.current = Date.now() + 450;
      painter.current(from ? dx : 0, from, false);
      const qualifies = Math.abs(dx) > 65 || Math.abs(velocityX.current) > 0.35;
      settle(!cancelled && qualifies ? from : 0, from);
    } else painter.current(0, 0, false);
    pointerId.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    index, go, reset, scene, isBusy: () => busy.current,
    gestures: {
      onPointerDown, onPointerMove,
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => endPointer(event),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => endPointer(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => endPointer(event, true),
      onDragStart: (event: DragEvent) => event.preventDefault(),
      onClickCapture: (event: MouseEvent) => {
        if (event.detail !== 0 && (busy.current || Date.now() < suppressUntil.current)) {
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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
export function useDeckNavigation(
  count: number,
  duration = 360,
  gestureSign: 1 | -1 = 1,
) {
  const [position, setPosition] = useState(0),
    [direction, setDirection] = useState(0);
  const busy = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    origin = useRef<{ x: number; y: number } | null>(null),
    suppressUntil = useRef(0),
    scene = useRef<HTMLDivElement>(null);
  const index = Math.max(0, Math.min(position, count - 1));
  const go = useCallback(
    (delta: number) => {
      if (busy.current || index + delta < 0 || index + delta >= count) return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setPosition(index + delta);
        return;
      }
      busy.current = true;
      setDirection(delta);
      timer.current = setTimeout(() => {
        setPosition(index + delta);
        setDirection(0);
        busy.current = false;
      }, duration);
    },
    [count, index, duration],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (
        Math.abs(event.deltaX) > Math.abs(event.deltaY) &&
        Math.abs(event.deltaX) > 12
      ) {
        event.preventDefault();
        go((event.deltaX > 0 ? 1 : -1) * gestureSign);
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [go, gestureSign]);
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    origin.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!origin.current) return;
    const dx = event.clientX - origin.current.x,
      dy = event.clientY - origin.current.y;
    origin.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      suppressUntil.current = Date.now() + 450;
      go((dx > 0 ? 1 : -1) * gestureSign);
    }
  };
  return {
    index,
    direction,
    go,
    scene,
    gestures: {
      onPointerDown,
      onPointerUp,
      onPointerCancel: () => {
        origin.current = null;
      },
      onClickCapture: (event: MouseEvent) => {
        if (event.detail !== 0 && Date.now() < suppressUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          go(event.key === "ArrowRight" ? 1 : -1);
        }
      },
    },
  };
}

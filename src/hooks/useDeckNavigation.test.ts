import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeckNavigation } from "./useDeckNavigation";
describe("navigation des recettes", () => {
  it("avance, bloque les doubles gestes, puis revient", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useDeckNavigation(4));
    act(() => {
      result.current.go(1);
      result.current.go(1);
    });
    expect(result.current.direction).toBe(1);
    act(() => vi.advanceTimersByTime(360));
    expect(result.current.index).toBe(1);
    act(() => result.current.go(-1));
    act(() => vi.advanceTimersByTime(360));
    expect(result.current.index).toBe(0);
    unmount();
    vi.useRealTimers();
  });
  it("respecte les limites du paquet", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useDeckNavigation(1));
    act(() => {
      result.current.go(-1);
      result.current.go(1);
    });
    expect(result.current.index).toBe(0);
    expect(result.current.direction).toBe(0);
    unmount();
    vi.useRealTimers();
  });
  it("respecte la préférence de mouvement réduit", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { result, unmount } = renderHook(() => useDeckNavigation(4));
    act(() => result.current.go(1));
    expect(result.current.index).toBe(1);
    expect(result.current.direction).toBe(0);
    unmount();
    vi.unstubAllGlobals();
  });
});

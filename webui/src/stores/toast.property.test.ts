import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { setActivePinia, createPinia } from "pinia";
import { useToastStore } from "./toast";

describe("Toast Store Properties", () => {
  it("auto dismisses after duration", () => {
    vi.useFakeTimers();
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 5000 }),
        (message, duration) => {
          setActivePinia(createPinia());
          const store = useToastStore();
          const id = store.addToast("info", message, { duration });
          expect(store.toasts.some((toast) => toast.id === id)).toBe(true);
          vi.advanceTimersByTime(duration + 1);
          expect(store.toasts.some((toast) => toast.id === id)).toBe(false);
          vi.clearAllTimers();
        }
      )
    );
    vi.useRealTimers();
  });
});

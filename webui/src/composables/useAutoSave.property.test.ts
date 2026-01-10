import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import { useAutoSave } from "./useAutoSave";

const createWrapper = (onSave: () => Promise<void>, debounceMs = 3000) => {
  return mount({
    template: "<div />",
    setup() {
      const content = ref("initial");
      const auto = useAutoSave(content, { debounceMs, onSave });
      return { content, auto };
    },
  });
};

describe("useAutoSave Properties", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces changes before triggering save", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (first, second) => {
          const onSave = vi.fn().mockResolvedValue(undefined);
          const wrapper = createWrapper(onSave);
          (wrapper.vm as { content: string }).content = first;
          await nextTick();
          (wrapper.vm as { content: string }).content = second;
          await nextTick();

          expect(onSave).not.toHaveBeenCalled();
          await vi.advanceTimersByTimeAsync(3000);
          await Promise.resolve();

          expect(onSave).toHaveBeenCalledTimes(1);
          wrapper.unmount();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 25 }
    );
  });

  it("tracks unsaved status until save completes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 20 }), async (nextValue) => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const wrapper = createWrapper(onSave);

        const auto = (wrapper.vm as { auto: { saveStatus: { value: string } } }).auto;
        expect(auto.saveStatus.value).toBe("saved");

        (wrapper.vm as { content: string }).content = nextValue;
        await nextTick();
        expect(auto.saveStatus.value).toBe("unsaved");

        await vi.advanceTimersByTimeAsync(3000);
        await Promise.resolve();
        expect(auto.saveStatus.value).toBe("saved");

        wrapper.unmount();
        vi.clearAllTimers();
      }),
      { numRuns: 20 }
    );
  });
});

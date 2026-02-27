import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import BottomPanel from "./BottomPanel.vue";

describe("BottomPanel Properties", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders task chips for all tasks", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        async (labels) => {
          const tasks = labels.map((label, idx) => ({
            id: `task-${idx}`,
            label,
            status: "running" as const,
            logs: [],
            outputFiles: [],
          }));

          const wrapper = mount(BottomPanel, {
            props: {
              tasks,
              activeTask: tasks[0] ?? null,
              activeTaskId: tasks[0]?.id ?? null,
            },
          });

          const chips = wrapper.findAll(".task-chip");
          expect(chips.length).toBe(tasks.length);
          wrapper.unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

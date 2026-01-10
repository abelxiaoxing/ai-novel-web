import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import BottomPanel from "./BottomPanel.vue";

describe("BottomPanel Properties", () => {
  it("auto scrolls to the newest log entry", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        async (logs) => {
          const task = {
            id: "task-1",
            label: "测试任务",
            status: "running",
            logs,
            outputFiles: [],
          };
          const wrapper = mount(BottomPanel, {
            props: {
              tasks: [task],
              activeTask: task,
              activeTaskId: task.id,
            },
          });

          const logStream = wrapper.find(".log-stream").element as HTMLDivElement;
          Object.defineProperty(logStream, "scrollHeight", { value: 120, configurable: true });
          logStream.scrollTop = 0;

          const nextTask = { ...task, logs: [...logs, "新日志"] };
          await wrapper.setProps({
            tasks: [nextTask],
            activeTask: nextTask,
          });
          await nextTick();

          expect(logStream.scrollTop).toBe(120);
          wrapper.unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

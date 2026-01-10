import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { setActivePinia, createPinia } from "pinia";
import { useTaskStore } from "./task";

const getTaskStatus = vi.fn();

vi.mock("@/api/tasks", () => ({
  getTaskStatus: (...args: unknown[]) => getTaskStatus(...args),
  getTaskStreamUrl: vi.fn(() => ""),
}));

describe("Task Store Properties", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    (globalThis as { EventSource?: unknown }).EventSource = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    getTaskStatus.mockReset();
  });

  it("tracks startedAt and completedAt for finished tasks", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("success", "failed"), async (status) => {
        const store = useTaskStore();
        getTaskStatus.mockResolvedValueOnce({
          status,
          result: status === "success" ? { ok: true } : undefined,
          error: status === "failed" ? "error" : undefined,
          output_files: [],
        });
        store.registerTask("task-1", "Test task");

        await vi.advanceTimersByTimeAsync(1600);
        const task = store.tasks.find((item) => item.id === "task-1");
        expect(task?.startedAt).toBeDefined();
        expect(task?.completedAt).toBeDefined();
        if (task?.startedAt && task.completedAt) {
          expect(task.completedAt).toBeGreaterThanOrEqual(task.startedAt);
        }
      }),
      { numRuns: 15 }
    );
  });
});

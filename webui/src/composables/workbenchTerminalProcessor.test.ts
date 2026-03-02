import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, type Ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useTaskStore } from "@/stores/task";
import { useToastStore } from "@/stores/toast";
import { createTerminalTaskProcessor } from "@/composables/workbenchTerminalProcessor";
import type { TaskActionMeta, TerminalTask } from "@/composables/workbenchActionTypes";

const createTerminalTask = (id: string, status: "success" | "failed"): TerminalTask => ({
  id,
  label: `task-${id}`,
  status,
  handled: false,
  outputFiles: [],
  error: status === "failed" ? "boom" : undefined,
  result: {},
});

type ProcessorContext = {
  taskStore: ReturnType<typeof useTaskStore>;
  toastStore: ReturnType<typeof useToastStore>;
  processingTaskIds: Set<string>;
  taskHandleAttempts: Map<string, number>;
  terminalProcessInFlight: Ref<boolean>;
  terminalProcessNeedsRerun: Ref<boolean>;
  actionMetaMap: Map<string, TaskActionMeta>;
  onTaskHandled: ReturnType<
    typeof vi.fn<
      (payload: { task: TerminalTask; actionMeta?: TaskActionMeta }) => void | Promise<void>
    >
  >;
};

const createProcessorContext = (): ProcessorContext => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const taskStore = useTaskStore();
  const toastStore = useToastStore();

  return {
    taskStore,
    toastStore,
    processingTaskIds: new Set<string>(),
    taskHandleAttempts: new Map<string, number>(),
    terminalProcessInFlight: ref(false),
    terminalProcessNeedsRerun: ref(false),
    actionMetaMap: new Map<string, TaskActionMeta>(),
    onTaskHandled: vi.fn<
      (payload: { task: TerminalTask; actionMeta?: TaskActionMeta }) => void | Promise<void>
    >(),
  };
};

const createProcessor = (context: ProcessorContext) => {
  const getTaskActionMeta = (taskId: string) => context.actionMetaMap.get(taskId);
  const deleteTaskActionMeta = (taskId: string) => {
    context.actionMetaMap.delete(taskId);
  };

  return createTerminalTaskProcessor({
    taskStore: context.taskStore,
    toastStore: context.toastStore,
    processingTaskIds: context.processingTaskIds,
    taskHandleAttempts: context.taskHandleAttempts,
    terminalProcessInFlight: context.terminalProcessInFlight,
    terminalProcessNeedsRerun: context.terminalProcessNeedsRerun,
    getTaskActionMeta,
    deleteTaskActionMeta,
    onTaskHandled: context.onTaskHandled,
  });
};

describe("workbenchTerminalProcessor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks terminal task handled and clears attempts/meta on success", async () => {
    const context = createProcessorContext();
    const { processTerminalTasks } = createProcessor(context);

    context.taskStore.tasks = [createTerminalTask("t1", "success")] as any;
    context.actionMetaMap.set("t1", { action: "draft", chapterNumber: 3 });

    await processTerminalTasks();

    expect(context.onTaskHandled).toHaveBeenCalledTimes(1);
    expect(context.onTaskHandled).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: "t1", status: "success" }),
      actionMeta: { action: "draft", chapterNumber: 3 },
    });

    const task = context.taskStore.tasks[0];
    expect(task.handled).toBe(true);
    expect(context.taskHandleAttempts.has("t1")).toBe(false);
    expect(context.actionMetaMap.has("t1")).toBe(false);
  });

  it("retries on transient failure and reruns processing once", async () => {
    const context = createProcessorContext();
    const { processTerminalTasks } = createProcessor(context);

    context.taskStore.tasks = [createTerminalTask("t2", "success")] as any;
    context.actionMetaMap.set("t2", { action: "finalize", chapterNumber: 2 });

    context.onTaskHandled
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(undefined);

    await processTerminalTasks();

    expect(context.onTaskHandled).toHaveBeenCalledTimes(2);
    const task = context.taskStore.tasks[0];
    expect(task.handled).toBe(true);
    expect(context.taskHandleAttempts.has("t2")).toBe(false);
    expect(context.actionMetaMap.has("t2")).toBe(false);

    const errorToasts = context.toastStore.toasts.filter((toast) => toast.type === "error");
    expect(errorToasts.filter((toast) => toast.message.includes("处理任务终态失败")).length).toBe(1);
    expect(errorToasts.filter((toast) => toast.message.includes("失败已达上限")).length).toBe(0);
  });

  it("stops retrying after max attempts and emits capped error once", async () => {
    const context = createProcessorContext();
    const { processTerminalTasks } = createProcessor(context);

    context.taskStore.tasks = [createTerminalTask("t3", "failed")] as any;
    context.actionMetaMap.set("t3", { action: "architecture" });

    context.onTaskHandled.mockRejectedValue(new Error("persistent"));

    await processTerminalTasks();

    expect(context.onTaskHandled).toHaveBeenCalledTimes(3);
    const task = context.taskStore.tasks[0];
    expect(task.handled).toBe(true);
    expect(context.taskHandleAttempts.has("t3")).toBe(false);
    expect(context.actionMetaMap.has("t3")).toBe(false);

    const errorToasts = context.toastStore.toasts.filter((toast) => toast.type === "error");
    expect(errorToasts.filter((toast) => toast.message.includes("处理任务终态失败")).length).toBe(3);
    expect(errorToasts.filter((toast) => toast.message.includes("失败已达上限")).length).toBe(1);
  });

  it("queues rerun when called reentrantly while in flight", async () => {
    const context = createProcessorContext();
    const { processTerminalTasks } = createProcessor(context);

    context.taskStore.tasks = [createTerminalTask("t4", "success")] as any;
    let release: () => void = () => {};
    const barrier = new Promise<void>((resolve) => {
      release = () => resolve();
    });

    context.onTaskHandled.mockImplementation(async () => {
      await barrier;
    });

    const running = processTerminalTasks();
    await Promise.resolve();
    await processTerminalTasks();

    expect(context.onTaskHandled).toHaveBeenCalledTimes(1);
    release();
    await running;

    expect(context.onTaskHandled).toHaveBeenCalledTimes(1);
    expect(context.terminalProcessInFlight.value).toBe(false);
    expect(context.terminalProcessNeedsRerun.value).toBe(false);

    const task = context.taskStore.tasks[0];
    expect(task.handled).toBe(true);
  });
});

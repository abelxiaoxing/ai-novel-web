import type { Ref } from "vue";
import type { useTaskStore } from "@/stores/task";
import type { useToastStore } from "@/stores/toast";
import type { TaskActionMeta, TerminalTask } from "@/composables/workbenchActionTypes";

type ProcessTerminalTasksOptions = {
  taskStore: ReturnType<typeof useTaskStore>;
  toastStore: ReturnType<typeof useToastStore>;
  processingTaskIds: Set<string>;
  taskHandleAttempts: Map<string, number>;
  terminalProcessInFlight: Ref<boolean>;
  terminalProcessNeedsRerun: Ref<boolean>;
  getTaskActionMeta: (taskId: string) => TaskActionMeta | undefined;
  deleteTaskActionMeta: (taskId: string) => void;
  onTaskHandled: (payload: {
    task: TerminalTask;
    actionMeta?: TaskActionMeta;
  }) => Promise<void> | void;
};

export function createTerminalTaskProcessor(options: ProcessTerminalTasksOptions) {
  const {
    taskStore,
    toastStore,
    processingTaskIds,
    taskHandleAttempts,
    terminalProcessInFlight,
    terminalProcessNeedsRerun,
    getTaskActionMeta,
    deleteTaskActionMeta,
    onTaskHandled,
  } = options;

  const reportTerminalProcessError = (taskLabel: string, error: unknown) => {
    const reason = error instanceof Error ? error.message : "未知错误";
    toastStore.error(`处理任务终态失败：${taskLabel}（${reason}）`);
  };

  const processTerminalTaskWithRetry = async (task: TerminalTask) => {
    if (processingTaskIds.has(task.id)) {
      return;
    }

    const actionMeta = getTaskActionMeta(task.id);
    const currentAttempts = taskHandleAttempts.get(task.id) ?? 0;
    const nextAttempt = currentAttempts + 1;
    taskHandleAttempts.set(task.id, nextAttempt);
    processingTaskIds.add(task.id);

    try {
      await onTaskHandled({ task, actionMeta });
      taskStore.updateTask(task.id, { handled: true });
      taskHandleAttempts.delete(task.id);
      if (actionMeta?.action) {
        deleteTaskActionMeta(task.id);
      }
    } catch (error) {
      if (nextAttempt >= 3) {
        taskStore.updateTask(task.id, { handled: true });
        taskHandleAttempts.delete(task.id);
        deleteTaskActionMeta(task.id);
        reportTerminalProcessError(task.label, error);
        toastStore.error(`任务终态处理失败已达上限：${task.label}`);
        return;
      }
      taskStore.updateTask(task.id, { handled: false });
      reportTerminalProcessError(task.label, error);
      terminalProcessNeedsRerun.value = true;
    } finally {
      processingTaskIds.delete(task.id);
    }
  };

  const processTerminalTasks = async () => {
    if (terminalProcessInFlight.value) {
      terminalProcessNeedsRerun.value = true;
      return;
    }

    terminalProcessInFlight.value = true;
    try {
      do {
        terminalProcessNeedsRerun.value = false;
        for (const item of taskStore.tasks) {
          if (item.status !== "success" && item.status !== "failed") {
            continue;
          }
          if (item.handled) {
            taskHandleAttempts.delete(item.id);
            deleteTaskActionMeta(item.id);
            continue;
          }

          const terminalTask: TerminalTask = {
            id: item.id,
            label: item.label,
            status: item.status,
            handled: item.handled,
            outputFiles: item.outputFiles,
            error: item.error,
            result: item.result,
          };
          await processTerminalTaskWithRetry(terminalTask);
        }
      } while (terminalProcessNeedsRerun.value);
    } finally {
      terminalProcessInFlight.value = false;
    }
  };

  return {
    processTerminalTasks,
  };
}

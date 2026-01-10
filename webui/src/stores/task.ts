import { defineStore } from "pinia";
import type { TaskStatus } from "@/api/types";
import { getTaskStatus, getTaskStreamUrl } from "@/api/tasks";

export type TaskItem = {
  id: string;
  label: string;
  status: TaskStatus;
  result?: Record<string, unknown>;
  error?: string;
  outputFiles?: string[];
  logs: string[];
  startedAt?: number;
  completedAt?: number;
};

export type TaskCompletionCallback = (task: TaskItem) => void;

export const useTaskStore = defineStore("tasks", {
  state: () => ({
    tasks: [] as TaskItem[],
    activeTaskId: null as string | null,
    pollers: {} as Record<string, number>,
    streams: {} as Record<string, EventSource>,
    completionCallbacks: [] as TaskCompletionCallback[],
  }),
  getters: {
    activeTask(state) {
      return state.tasks.find((task) => task.id === state.activeTaskId) ?? null;
    },
  },
  actions: {
    /**
     * Register a callback to be called when a task completes
     */
    onTaskComplete(callback: TaskCompletionCallback): () => void {
      this.completionCallbacks.push(callback);
      // Return unsubscribe function
      return () => {
        const index = this.completionCallbacks.indexOf(callback);
        if (index > -1) {
          this.completionCallbacks.splice(index, 1);
        }
      };
    },
    /**
     * Notify all registered callbacks of task completion
     */
    notifyTaskComplete(task: TaskItem): void {
      for (const callback of this.completionCallbacks) {
        try {
          callback(task);
        } catch (error) {
          console.error("Task completion callback error:", error);
        }
      }
    },
    registerTask(taskId: string, label: string) {
      const task: TaskItem = {
        id: taskId,
        label,
        status: "pending",
        outputFiles: [],
        logs: [],
        startedAt: Date.now(),
      };
      this.tasks = [task, ...this.tasks.filter((item) => item.id !== taskId)];
      this.activeTaskId = taskId;
      this.connectStream(taskId);
      this.pollStatus(taskId);
    },
    updateTask(taskId: string, partial: Partial<TaskItem>) {
      const index = this.tasks.findIndex((task) => task.id === taskId);
      if (index === -1) {
        return;
      }
      this.tasks[index] = { ...this.tasks[index], ...partial };
    },
    appendLog(taskId: string, message: string) {
      const task = this.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      task.logs.push(message);
    },
    async pollStatus(taskId: string) {
      if (this.pollers[taskId]) {
        return;
      }
      this.pollers[taskId] = window.setInterval(async () => {
        try {
          const statusPayload = await getTaskStatus(taskId);
          const previousStatus = this.tasks.find((t) => t.id === taskId)?.status;
          this.updateTask(taskId, {
            status: statusPayload.status,
            result: statusPayload.result,
            error: statusPayload.error,
            outputFiles: statusPayload.output_files ?? [],
          });
          if (statusPayload.status === "success" || statusPayload.status === "failed") {
            this.updateTask(taskId, { completedAt: Date.now() });
            this.clearPoller(taskId);
            this.closeStream(taskId);
            // Notify completion callbacks if status just changed to success/failed
            if (previousStatus !== statusPayload.status) {
              const task = this.tasks.find((t) => t.id === taskId);
              if (task) {
                this.notifyTaskComplete(task);
              }
            }
          }
        } catch (error) {
          this.updateTask(taskId, {
            status: "failed",
            error: error instanceof Error ? error.message : "任务执行失败",
            completedAt: Date.now(),
          });
          this.clearPoller(taskId);
          this.closeStream(taskId);
          // Notify completion callbacks on error
          const task = this.tasks.find((t) => t.id === taskId);
          if (task) {
            this.notifyTaskComplete(task);
          }
        }
      }, 1600);
    },
    clearPoller(taskId: string) {
      const poller = this.pollers[taskId];
      if (poller) {
        window.clearInterval(poller);
        delete this.pollers[taskId];
      }
    },
    connectStream(taskId: string) {
      if (typeof EventSource === "undefined") {
        return;
      }
      if (this.streams[taskId]) {
        return;
      }
      const url = getTaskStreamUrl(taskId);
      const stream = new EventSource(url);
      stream.onmessage = (event) => {
        if (!event.data) {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as { message?: string };
          const message = payload.message ?? event.data;
          this.appendLog(taskId, message);
        } catch {
          this.appendLog(taskId, event.data);
        }
      };
      stream.onerror = () => {
        this.appendLog(taskId, "日志流已断开。");
        this.closeStream(taskId);
      };
      this.streams[taskId] = stream;
    },
    closeStream(taskId: string) {
      const stream = this.streams[taskId];
      if (stream) {
        stream.close();
        delete this.streams[taskId];
      }
    },
    clearAll() {
      Object.keys(this.pollers).forEach((taskId) => this.clearPoller(taskId));
      Object.keys(this.streams).forEach((taskId) => this.closeStream(taskId));
      this.tasks = [];
      this.activeTaskId = null;
    },
  },
});

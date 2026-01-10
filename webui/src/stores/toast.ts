import { defineStore } from "pinia";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
  duration: number;
  critical: boolean;
}

export interface ToastState {
  toasts: Toast[];
  maxToasts: number;
}

let toastIdCounter = 0;

function generateToastId(): string {
  return `toast-${Date.now()}-${++toastIdCounter}`;
}

export const useToastStore = defineStore("toast", {
  state: (): ToastState => ({
    toasts: [],
    maxToasts: 5,
  }),

  actions: {
    /**
     * Add a new toast notification
     * @param type - Toast type (success, error, warning, info)
     * @param message - Toast message content
     * @param options - Optional configuration
     */
    addToast(
      type: ToastType,
      message: string,
      options?: { duration?: number; critical?: boolean }
    ): string {
      const id = generateToastId();
      const critical = options?.critical ?? false;
      // Critical errors don't auto-dismiss; default 5000ms for errors, 3000ms for success
      const defaultDuration = type === "error" ? 5000 : 3000;
      const duration = critical ? 0 : (options?.duration ?? defaultDuration);

      const toast: Toast = {
        id,
        type,
        message,
        createdAt: Date.now(),
        duration,
        critical,
      };

      // Add to the beginning of the array
      this.toasts = [toast, ...this.toasts];

      // Limit the number of toasts
      if (this.toasts.length > this.maxToasts) {
        this.toasts = this.toasts.slice(0, this.maxToasts);
      }

      // Set auto-dismiss timer if duration > 0
      if (duration > 0) {
        setTimeout(() => {
          this.removeToast(id);
        }, duration);
      }

      return id;
    },

    /**
     * Remove a toast by ID
     */
    removeToast(id: string): void {
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
    },

    /**
     * Clear all toasts
     */
    clearAll(): void {
      this.toasts = [];
    },

    // Convenience methods
    success(message: string, duration?: number): string {
      return this.addToast("success", message, { duration });
    },

    error(message: string, critical?: boolean): string {
      return this.addToast("error", message, { critical });
    },

    warning(message: string, duration?: number): string {
      return this.addToast("warning", message, { duration });
    },

    info(message: string, duration?: number): string {
      return this.addToast("info", message, { duration });
    },
  },
});

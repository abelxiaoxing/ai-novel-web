<template>
  <Teleport to="body">
    <div class="toast-container" :class="`toast-${position}`">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast-${toast.type}`"
          role="alert"
        >
          <span class="toast-icon">{{ getIcon(toast.type) }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button
            class="toast-dismiss"
            @click="dismiss(toast.id)"
            aria-label="关闭通知"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useToastStore, type ToastType } from "@/stores/toast";

withDefaults(
  defineProps<{
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  }>(),
  { position: "top-right" }
);

const toastStore = useToastStore();

const toasts = computed(() => toastStore.toasts);

function dismiss(id: string) {
  toastStore.removeToast(id);
}

function getIcon(type: ToastType): string {
  switch (type) {
    case "success":
      return "✓";
    case "error":
      return "✕";
    case "warning":
      return "⚠";
    case "info":
      return "ℹ";
    default:
      return "ℹ";
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
  pointer-events: none;
}

.toast-top-right {
  top: 16px;
  right: 16px;
}

.toast-top-left {
  top: 16px;
  left: 16px;
}

.toast-bottom-right {
  bottom: 16px;
  right: 16px;
}

.toast-bottom-left {
  bottom: 16px;
  left: 16px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--panel-strong);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-soft);
  color: var(--text);
  font-size: 14px;
  pointer-events: auto;
}

.toast-success {
  border-color: rgba(34, 197, 94, 0.4);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), var(--panel-strong));
}

.toast-error {
  border-color: rgba(239, 68, 68, 0.4);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), var(--panel-strong));
}

.toast-warning {
  border-color: rgba(245, 158, 11, 0.4);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), var(--panel-strong));
}

.toast-info {
  border-color: rgba(126, 91, 255, 0.4);
  background: linear-gradient(135deg, rgba(126, 91, 255, 0.15), var(--panel-strong));
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.toast-success .toast-icon {
  background: rgba(34, 197, 94, 0.25);
  color: var(--success);
}

.toast-error .toast-icon {
  background: rgba(239, 68, 68, 0.25);
  color: var(--danger);
}

.toast-warning .toast-icon {
  background: rgba(245, 158, 11, 0.25);
  color: var(--warn);
}

.toast-info .toast-icon {
  background: rgba(126, 91, 255, 0.25);
  color: var(--accent-bright);
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-dismiss {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.toast-dismiss:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

/* Transition animations */
.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.25s ease-in forwards;
}

.toast-move {
  transition: transform 0.3s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}
</style>

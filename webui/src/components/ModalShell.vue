<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div
        ref="panelRef"
        class="modal-panel"
        :class="[panelClass, { 'modal-panel--scrollable': panelScrollable }]"
      >
        <div ref="contentRef" class="modal-content">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref } from "vue";

type PanelClass = string | string[] | Record<string, boolean>;

defineEmits(["close"]);

defineProps<{
  panelClass?: PanelClass;
}>();

const panelRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const panelScrollable = ref(false);
let resizeRaf = 0;
let resizeObserver: ResizeObserver | null = null;

const updateScrollableState = () => {
  const panel = panelRef.value;
  const content = contentRef.value;
  if (!panel || !content) {
    panelScrollable.value = false;
    return;
  }
  const overflowHeight = content.scrollHeight - panel.clientHeight;
  panelScrollable.value = overflowHeight > 6;
};

const queueUpdateScrollableState = () => {
  if (typeof requestAnimationFrame !== "function") {
    updateScrollableState();
    return;
  }
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf);
  }
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    updateScrollableState();
  });
};

onMounted(async () => {
  await nextTick();
  queueUpdateScrollableState();
  window.addEventListener("resize", queueUpdateScrollableState);
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      queueUpdateScrollableState();
    });
    if (panelRef.value) {
      resizeObserver.observe(panelRef.value);
    }
    if (contentRef.value) {
      resizeObserver.observe(contentRef.value);
    }
  }
});

onUpdated(() => {
  queueUpdateScrollableState();
  if (resizeObserver && contentRef.value) {
    resizeObserver.disconnect();
    if (panelRef.value) {
      resizeObserver.observe(panelRef.value);
    }
    resizeObserver.observe(contentRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", queueUpdateScrollableState);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (resizeRaf && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(resizeRaf);
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 16, 0.75);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 16px;
  overflow-x: hidden;
  overflow-y: hidden;
  z-index: 100;
  opacity: 0;
  animation: backdropFadeIn 0.2s ease forwards;
  will-change: opacity;
}

@keyframes backdropFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-panel {
  width: min(540px, 100%);
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  overflow-x: hidden;
  overflow-y: hidden;
  background: linear-gradient(145deg, rgba(20, 30, 45, 0.98), rgba(12, 20, 32, 0.98));
  border-radius: 20px;
  border: 1px solid rgba(95, 170, 230, 0.35);
  padding: 28px;
  box-sizing: border-box;
  box-shadow:
    0 25px 60px rgba(5, 10, 20, 0.7),
    0 0 0 1px rgba(47, 155, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
  animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  position: relative;
  will-change: transform, opacity;
}

.modal-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.modal-panel--scrollable {
  overflow-y: auto;
}

@supports not (height: 100dvh) {
  .modal-panel {
    max-height: calc(100vh - 32px);
  }
}

.modal-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: linear-gradient(
    135deg,
    rgba(125, 211, 255, 0.15) 0%,
    rgba(47, 155, 255, 0.08) 50%,
    rgba(125, 211, 255, 0.15) 100%
  );
  z-index: -1;
  opacity: 0.6;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-panel:hover {
  border-color: rgba(125, 211, 255, 0.45);
  box-shadow:
    0 30px 70px rgba(5, 10, 20, 0.8),
    0 0 40px rgba(47, 155, 255, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* 滚动条样式优化 */
.modal-panel::-webkit-scrollbar {
  width: 6px;
}

.modal-panel::-webkit-scrollbar-track {
  background: rgba(10, 15, 25, 0.5);
  border-radius: 3px;
}

.modal-panel::-webkit-scrollbar-thumb {
  background: rgba(95, 170, 230, 0.3);
  border-radius: 3px;
}

.modal-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(95, 170, 230, 0.5);
}
</style>

<template>
  <section class="bottom-panel panel" :class="{ 'bottom-panel--collapsed': !bottomPanelVisible }">
    <button v-if="bottomPanelVisible" class="panel-collapse-btn panel-collapse-btn--top" type="button" @click="$emit('toggle')" title="收缩">
      <span>▼</span>
    </button>
    <button
      v-else
      class="panel-expand-btn panel-expand-btn--bottom"
      type="button"
      @click="$emit('toggle')"
      title="展开任务面板"
    >
      <span>▲</span>
    </button>
    <div
      v-if="bottomPanelVisible"
      class="resize-handle resize-handle--vertical"
      :class="{ 'resize-handle--active': isResizing }"
      @mousedown="startResize"
      title="拖拽调整高度"
    />
    <div class="panel-header">
      <div class="panel-title">任务面板</div>
      <div class="task-meta">
        <span v-if="isRunning" class="progress-indicator" aria-hidden="true"></span>
        <span class="muted">{{ activeLabel }}</span>
        <span v-if="elapsedLabel" class="muted">· {{ elapsedLabel }}</span>
      </div>
    </div>
    <div v-show="bottomPanelVisible" class="bottom-panel-body">
      <div class="task-strip">
        <button
          v-for="task in tasks"
          :key="task.id"
          class="task-chip"
          :class="{ active: task.id === activeTaskId }"
          type="button"
          @click="$emit('select', task.id)"
        >
          <span class="task-label">{{ task.label }}</span>
          <span class="task-status" :class="task.status">{{ statusLabel(task.status) }}</span>
        </button>
        <div v-if="!tasks.length" class="empty-state">暂无任务</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, toRefs } from "vue";
import type { TaskItem } from "@/stores/task";
import { usePanelStore } from "@/stores/panel";
import { useResizable } from "@/composables/useResizable";

const props = defineProps<{
  tasks: TaskItem[];
  activeTask: TaskItem | null;
  activeTaskId: string | null;
  bottomPanelVisible?: boolean;
}>();

defineEmits(["select", "open-file", "toggle"]);

const panelStore = usePanelStore();
const { bottomPanelHeight } = toRefs(panelStore);

const { isResizing, startResize } = useResizable({
  direction: "vertical",
  initialSize: bottomPanelHeight.value,
  minSize: 64,
  maxSize: 360,
  reverse: true,
  getCurrentSize: () => panelStore.bottomPanelHeight,
  onResize: (size) => {
    panelStore.updateSize("bottomPanel", size, { persist: false });
  },
  onResizeEnd: (size) => {
    panelStore.updateSize("bottomPanel", size);
  },
});

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: "等待中",
    running: "进行中",
    success: "已完成",
    failed: "已失败",
  };
  return map[status] ?? "未知状态";
};

const now = ref(Date.now());
let timer: number | null = null;

const activeLabel = computed(() => {
  if (!props.activeTask) {
    return "空闲";
  }
  return `${props.activeTask.label} · ${statusLabel(props.activeTask.status)}`;
});

const isRunning = computed(() =>
  props.activeTask ? ["running", "pending"].includes(props.activeTask.status) : false
);

const elapsedLabel = computed(() => {
  const task = props.activeTask;
  if (!task?.startedAt) {
    return "";
  }
  const end = task.completedAt ?? now.value;
  const elapsedMs = Math.max(0, end - task.startedAt);
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
});

watch(
  () => isRunning.value,
  (running) => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    if (running) {
      timer = window.setInterval(() => {
        now.value = Date.now();
      }, 1000);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});
</script>

<style scoped>
.bottom-panel {
  grid-column: 2 / 3;
  grid-row: 3 / 4;
  display: flex;
  flex-direction: column;
  overflow: visible;
  position: relative;
}

.bottom-panel--collapsed {
  height: 0;
  min-height: 0;
  padding: 0;
  border: none;
  overflow: visible;
}

.bottom-panel--collapsed .panel-expand-btn--bottom {
  top: auto;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 24px;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.bottom-panel-body {
  flex: 1;
  overflow: hidden;
}

.task-strip {
  height: 100%;
  padding: 10px 12px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  align-items: center;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid rgba(47, 155, 255, 0.35);
  border-top-color: var(--accent-bright);
  animation: spin 1s linear infinite;
}

.task-chip {
  border-radius: 999px;
  border: 1px solid rgba(125, 186, 233, 0.28);
  background: rgba(7, 18, 30, 0.72);
  color: var(--text-muted);
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  white-space: nowrap;
}

.task-chip.active {
  border-color: rgba(125, 186, 233, 0.55);
  color: var(--text);
}

.task-status {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(47, 155, 255, 0.3);
  color: #bde9ff;
}

.task-status.running {
  background: rgba(47, 155, 255, 0.42);
}

.task-status.failed {
  background: rgba(239, 68, 68, 0.25);
  color: #ffd0d0;
}

.task-status.success {
  background: rgba(34, 197, 94, 0.28);
  color: #c9ffd8;
}

.empty-state {
  color: var(--text-muted);
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

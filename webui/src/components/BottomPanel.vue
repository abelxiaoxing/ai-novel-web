<template>
  <section class="bottom-panel panel" :class="{ 'bottom-panel--collapsed': !bottomPanelVisible }">
    <button v-if="bottomPanelVisible" class="panel-collapse-btn panel-collapse-btn--top" type="button" @click="$emit('toggle')" title="收缩">
      <span>▼</span>
    </button>
    <button v-else class="panel-expand-btn panel-expand-btn--bottom" type="button" @click="$emit('toggle')" title="展开任务日志">
      <span>▲</span>
    </button>
    <!-- 拖拽手柄 -->
    <div
      v-if="bottomPanelVisible"
      class="resize-handle resize-handle--vertical"
      :class="{ 'resize-handle--active': isResizing }"
      @mousedown="startResize"
      title="拖拽调整高度"
    />
    <div class="panel-header">
      <div class="panel-title">任务日志</div>
      <div class="task-meta">
        <span v-if="isRunning" class="progress-indicator" aria-hidden="true"></span>
        <span class="muted">{{ activeLabel }}</span>
        <span v-if="elapsedLabel" class="muted">· {{ elapsedLabel }}</span>
      </div>
    </div>
    <div v-show="bottomPanelVisible" class="bottom-panel-body">
    <div class="log-body">
      <div v-if="activeOutputs.length" class="output-strip">
        <span class="output-label">输出文件</span>
        <button
          v-for="fileKey in activeOutputs"
          :key="fileKey"
          class="output-chip"
          @click="$emit('open-file', fileKey)"
        >
          {{ formatOutput(fileKey) }}
        </button>
      </div>
      <div v-if="!activeTask" class="empty-state">未选择任务。</div>
      <div v-else class="log-stream" ref="logRef">
        <div v-if="activeTask.error" class="log-error">{{ activeTask.error }}</div>
        <div class="log-line" v-for="(line, index) in activeTask.logs" :key="index">
          {{ line }}
        </div>
      </div>
    </div>
    <div class="task-strip">
      <button
        v-for="task in tasks"
        :key="task.id"
        class="task-chip"
        :class="{ active: task.id === activeTaskId }"
        @click="$emit('select', task.id)"
      >
        <span class="task-label">{{ task.label }}</span>
        <span class="task-status" :class="task.status">{{ statusLabel(task.status) }}</span>
      </button>
    </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, toRefs } from "vue";
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

// 使用可拖拽组合式函数
const { isResizing, startResize } = useResizable({
  direction: "vertical",
  initialSize: bottomPanelHeight.value,
  minSize: 80,
  maxSize: 500,
  reverse: true, // 向上拖拽增大高度
  onResize: (size) => {
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

const logRef = ref<HTMLDivElement | null>(null);
const now = ref(Date.now());
let timer: number | null = null;

const activeLabel = computed(() => {
  if (!props.activeTask) {
    return "空闲";
  }
  return `${props.activeTask.label} · ${statusLabel(props.activeTask.status)}`;
});

const activeOutputs = computed(() => props.activeTask?.outputFiles ?? []);

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

const formatOutput = (fileKey: string) => {
  const map: Record<string, string> = {
    architecture: "小说架构",
    directory: "章节蓝图",
    summary: "全局摘要",
    character_state: "角色状态",
    plot_arcs: "剧情要点",
  };
  if (map[fileKey]) {
    return map[fileKey];
  }
  const chapterMatch = /^chapter:(\d+)$/i.exec(fileKey);
  if (chapterMatch) {
    return `第${chapterMatch[1]}章`;
  }
  return fileKey;
};

watch(
  () => props.activeTask?.logs.length,
  async () => {
    await nextTick();
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight;
    }
  }
);

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
}

.bottom-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-toggle {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-toggle:hover {
  background: rgba(126, 91, 255, 0.1);
  color: var(--accent-bright);
}

.panel-toggle-icon {
  font-size: 12px;
}

.log-body {
  flex: 1;
  padding: 12px 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-stream {
  flex: 1;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
}

.log-error {
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ffd1d1;
  font-size: 12px;
}

.log-line {
  padding: 2px 0;
}

.empty-state {
  color: var(--text-muted);
  font-style: italic;
}

.output-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.output-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.output-chip {
  border-radius: 999px;
  border: 1px solid rgba(126, 91, 255, 0.35);
  background: rgba(12, 10, 18, 0.6);
  color: var(--text);
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.output-chip:hover {
  border-color: rgba(126, 91, 255, 0.7);
}

.task-strip {
  border-top: 1px solid var(--panel-border);
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
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
  border: 2px solid rgba(126, 91, 255, 0.3);
  border-top-color: var(--accent-bright);
  animation: spin 1s linear infinite;
}

.task-chip {
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(12, 10, 18, 0.7);
  color: var(--text-muted);
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  white-space: nowrap;
}

.task-chip.active {
  border-color: rgba(126, 91, 255, 0.45);
  color: var(--text);
}

.task-status {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(126, 91, 255, 0.2);
  color: var(--accent-bright);
}

.task-status.running {
  background: rgba(126, 91, 255, 0.35);
}

.task-status.failed {
  background: rgba(239, 68, 68, 0.2);
  color: #ff9b9b;
}

.task-status.success {
  background: rgba(34, 197, 94, 0.2);
  color: #7ef1a4;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<template>
  <section class="bottom-panel panel">
    <div class="panel-header">
      <div class="panel-title">任务日志</div>
      <div class="muted">{{ activeLabel }}</div>
    </div>
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
      <div v-else class="log-stream">
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
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TaskItem } from "@/stores/task";

const props = defineProps<{
  tasks: TaskItem[];
  activeTask: TaskItem | null;
  activeTaskId: string | null;
}>();

defineEmits(["select", "open-file"]);

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: "等待中",
    running: "进行中",
    success: "已完成",
    failed: "已失败",
  };
  return map[status] ?? "未知状态";
};

const activeLabel = computed(() => {
  if (!props.activeTask) {
    return "空闲";
  }
  return `${props.activeTask.label} · ${statusLabel(props.activeTask.status)}`;
});

const activeOutputs = computed(() => props.activeTask?.outputFiles ?? []);

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
</script>

<style scoped>
.bottom-panel {
  grid-column: 3 / 4;
  grid-row: 3 / 4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
</style>

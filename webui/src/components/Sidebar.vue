<template>
  <aside class="sidebar panel" :class="{ 'sidebar--collapsed': !sidebarVisible }">
    <button v-if="sidebarVisible" class="panel-collapse-btn panel-collapse-btn--right" type="button" @click="$emit('toggle')" title="收缩">
      <span>◀</span>
    </button>
    <button v-else class="panel-expand-btn panel-expand-btn--left" type="button" @click="$emit('toggle')" title="展开项目文件">
      <span>▶</span>
    </button>
    <!-- 拖拽手柄 -->
    <div
      v-if="sidebarVisible"
      class="resize-handle resize-handle--horizontal"
      :class="{ 'resize-handle--active': isResizing }"
      @mousedown="startResize"
      title="拖拽调整宽度"
    />
    <div class="panel-header">
      <div class="panel-title">项目文件</div>
    </div>
    <div class="sidebar-body">
      <FileTree
        :nodes="nodes"
        :active-path="activePath"
        @open="emit('open', $event)"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
      />
      <div class="task-log-section">
        <div class="task-log-title">任务日志</div>
        <button
          v-for="task in tasks"
          :key="task.id"
          class="task-log-row"
          :class="{ 'task-log-row--active': activeTaskId === task.id }"
          type="button"
          @click="emit('select-task', task.id)"
        >
          <span class="task-log-row__label">{{ task.label }}</span>
          <span class="task-log-row__status" :class="`task-log-row__status--${task.status}`">{{ statusLabel(task.status) }}</span>
        </button>
        <div v-if="!tasks.length" class="task-log-empty">暂无任务日志</div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { toRefs } from "vue";
import type { FileNode, ActiveFile } from "@/stores/project";
import type { TaskItem } from "@/stores/task";
import { usePanelStore } from "@/stores/panel";
import { useResizable } from "@/composables/useResizable";
import FileTree from "@/components/FileTree.vue";

const props = withDefaults(
  defineProps<{
    nodes: FileNode[];
    activePath?: string | null;
    sidebarVisible?: boolean;
    tasks?: TaskItem[];
    activeTaskId?: string | null;
  }>(),
  {
    tasks: () => [],
    activeTaskId: null,
  }
);

const emit = defineEmits<{
  (event: "open", payload: ActiveFile): void;
  (event: "rename", payload: { node: FileNode; name: string }): void;
  (event: "delete", node: FileNode): void;
  (event: "select-task", taskId: string): void;
  (event: "toggle"): void;
}>();

const panelStore = usePanelStore();
const { sidebarWidth } = toRefs(panelStore);

// 使用可拖拽组合式函数
const { isResizing, startResize } = useResizable({
  direction: "horizontal",
  initialSize: sidebarWidth.value,
  minSize: 80,
  maxSize: 400,
  getCurrentSize: () => panelStore.sidebarWidth,
  onResize: (size) => {
    panelStore.updateSize("sidebar", size, { persist: false });
  },
  onResizeEnd: (size) => {
    panelStore.updateSize("sidebar", size);
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
</script>

<style scoped>
.sidebar {
  grid-column: 1 / 2;
  grid-row: 2 / 4;
  display: flex;
  flex-direction: column;
  overflow: visible;
  position: relative;
}

.sidebar--collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  border: none;
  overflow: visible;
}

/* 收起状态下展开按钮的定位 - 显示在左侧 */
.sidebar--collapsed .panel-expand-btn--left {
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 40px;
  border-left: none;
  border-radius: 0 8px 8px 0;
}

.sidebar-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.task-log-section {
  border-top: 1px solid rgba(95, 170, 230, 0.24);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.task-log-title {
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.task-log-row {
  border: 1px solid rgba(113, 186, 255, 0.28);
  background: rgba(27, 61, 95, 0.32);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.task-log-row:hover {
  background: rgba(45, 103, 158, 0.42);
  border-color: rgba(139, 205, 255, 0.5);
}

.task-log-row--active {
  background: rgba(56, 126, 194, 0.52);
  border-color: rgba(156, 218, 255, 0.78);
}

.task-log-row__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-log-row__status {
  border-radius: 999px;
  padding: 2px 6px;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #e8f5ff;
  background: rgba(72, 151, 224, 0.45);
}

.task-log-row__status--failed {
  background: rgba(226, 70, 70, 0.45);
}

.task-log-row__status--success {
  background: rgba(46, 163, 92, 0.45);
}

.task-log-empty {
  font-size: 12px;
  color: var(--text-muted);
}
</style>

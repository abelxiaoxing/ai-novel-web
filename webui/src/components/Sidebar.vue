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
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, toRefs } from "vue";
import type { FileNode, ActiveFile } from "@/stores/project";
import { usePanelStore } from "@/stores/panel";
import { useResizable } from "@/composables/useResizable";
import FileTree from "@/components/FileTree.vue";

const props = defineProps<{
  nodes: FileNode[];
  activePath?: string | null;
  sidebarVisible?: boolean;
}>();

const emit = defineEmits<{
  (event: "open", payload: ActiveFile): void;
  (event: "rename", payload: { node: FileNode; name: string }): void;
  (event: "delete", node: FileNode): void;
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
  onResize: (size) => {
    panelStore.updateSize("sidebar", size);
  },
});

const fileCount = computed(() => {
  const countNodes = (nodes: FileNode[]): number =>
    nodes.reduce((total, node) => {
      if (node.type === "file") {
        return total + 1;
      }
      return total + countNodes(node.children ?? []);
    }, 0);
  return countNodes(props.nodes);
});
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
}
</style>

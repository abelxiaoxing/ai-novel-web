<template>
  <aside class="sidebar panel" :class="{ 'sidebar--collapsed': !sidebarVisible }">
    <button v-if="sidebarVisible" class="panel-collapse-btn panel-collapse-btn--right" type="button" @click="$emit('toggle')" title="收缩">
      <span>◀</span>
    </button>
    <button v-else class="panel-expand-btn panel-expand-btn--left" type="button" @click="$emit('toggle')" title="展开项目文件">
      <span>▶</span>
    </button>
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
import { computed } from "vue";
import type { FileNode, ActiveFile } from "@/stores/project";
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
}

.sidebar-body {
  flex: 1;
  overflow: hidden;
}
</style>

<template>
  <aside class="sidebar panel">
    <div class="panel-header">
      <div class="panel-title">项目文件</div>
      <span class="muted">{{ fileCount }} 项</span>
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
}>();

const emit = defineEmits<{
  (event: "open", payload: ActiveFile): void;
  (event: "rename", payload: { node: FileNode; name: string }): void;
  (event: "delete", node: FileNode): void;
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
  overflow: hidden;
}

.sidebar-body {
  flex: 1;
  overflow: hidden;
}
</style>

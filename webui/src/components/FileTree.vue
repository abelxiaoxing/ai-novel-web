<template>
  <div class="file-tree">
    <ul class="file-list">
      <FileTreeItem
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :active-path="activePath"
        @open="emit('open', $event)"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { FileNode, ActiveFile } from "@/stores/project";
import FileTreeItem from "@/components/FileTreeItem.vue";

defineProps<{
  nodes: FileNode[];
  activePath?: string | null;
}>();

const emit = defineEmits<{
  (event: "open", payload: ActiveFile): void;
}>();
</script>

<style scoped>
.file-tree {
  padding: 12px 8px 16px 8px;
  overflow-y: auto;
  height: 100%;
}

.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>

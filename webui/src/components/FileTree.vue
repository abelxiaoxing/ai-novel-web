<template>
  <div class="file-tree">
    <ul class="file-list">
      <FileTreeItem
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :active-path="activePath"
        :renaming-id="renamingId"
        @open="emit('open', $event)"
        @rename="handleRename"
        @cancel-rename="cancelRename"
        @context="openContextMenu"
      />
    </ul>
  </div>
  <FileTreeContextMenu
    v-if="contextMenu"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :items="menuItems"
    @select="handleMenuSelect"
    @close="closeContextMenu"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { FileNode, ActiveFile } from "@/stores/project";
import FileTreeItem from "@/components/FileTreeItem.vue";
import FileTreeContextMenu, { type ContextMenuItem } from "@/components/FileTreeContextMenu.vue";

defineProps<{
  nodes: FileNode[];
  activePath?: string | null;
}>();

const emit = defineEmits<{
  (event: "open", payload: ActiveFile): void;
  (event: "rename", payload: { node: FileNode; name: string }): void;
  (event: "delete", node: FileNode): void;
}>();

const renamingId = ref<string | null>(null);
const contextMenu = ref<{ x: number; y: number; node: FileNode } | null>(null);

const menuItems = computed<ContextMenuItem[]>(() => {
  if (!contextMenu.value) {
    return [];
  }
  const node = contextMenu.value.node;
  const isChapter = typeof node.chapterNumber === "number";
  const items: ContextMenuItem[] = [
    { key: "open", label: "打开" },
    { key: "rename", label: "重命名", disabled: !isChapter },
    { key: "delete", label: "删除", disabled: !isChapter },
  ];
  if (isChapter) {
    items.splice(1, 0, { key: "open-editor", label: "在编辑器中打开" });
  }
  return items;
});

const localizeNodeName = (node: FileNode) => {
  const staticMap: Record<string, string> = {
    architecture: "小说架构",
    directory: "章节蓝图",
    summary: "全局摘要",
    character_state: "角色状态",
    plot_arcs: "剧情要点",
    chapters: "章节",
    vectorstore: "向量库",
  };
  if (staticMap[node.name]) {
    return staticMap[node.name];
  }
  const chapterMatch = /^chapter_(\d+)\.txt$/i.exec(node.name);
  if (chapterMatch) {
    return `第${chapterMatch[1]}章`;
  }
  return node.name;
};

const openContextMenu = (payload: { node: FileNode; x: number; y: number }) => {
  contextMenu.value = payload;
};

const closeContextMenu = () => {
  contextMenu.value = null;
};

const handleMenuSelect = (key: string) => {
  const node = contextMenu.value?.node;
  if (!node) {
    return;
  }
  switch (key) {
    case "open":
    case "open-editor":
      emit("open", {
        path: node.path,
        name: localizeNodeName(node),
        kind: node.chapterNumber ? "chapter" : "file",
        chapterNumber: node.chapterNumber,
      });
      break;
    case "rename":
      renamingId.value = node.id;
      break;
    case "delete":
      emit("delete", node);
      break;
    default:
      break;
  }
  closeContextMenu();
};

const handleRename = (payload: { node: FileNode; name: string }) => {
  renamingId.value = null;
  emit("rename", payload);
};

const cancelRename = () => {
  renamingId.value = null;
};
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

<template>
  <li>
    <div
      class="file-row"
      :class="{
        active: isActive,
        folder: node.type === 'folder',
      }"
      @click="handleClick"
    >
      <span class="chevron" v-if="node.type === 'folder'">{{ expanded ? '▾' : '▸' }}</span>
      <span class="file-name">{{ displayName }}</span>
    </div>
    <ul v-if="node.type === 'folder' && expanded" class="file-children">
      <FileTreeItem
        v-for="child in node.children ?? []"
        :key="child.id"
        :node="child"
        :active-path="activePath"
        @open="emit('open', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { FileNode, ActiveFile } from "@/stores/project";
import FileTreeItem from "@/components/FileTreeItem.vue";

const props = defineProps<{
  node: FileNode;
  activePath?: string | null;
}>();

const emit = defineEmits<{
  (event: "open", payload: ActiveFile): void;
}>();

const expanded = ref(true);
const isActive = computed(() => props.activePath === props.node.path);
const displayName = computed(() => {
  const name = props.node.name;
  const staticMap: Record<string, string> = {
    architecture: "小说架构",
    directory: "章节蓝图",
    summary: "全局摘要",
    character_state: "角色状态",
    plot_arcs: "剧情要点",
    chapters: "章节",
    vectorstore: "向量库",
  };

  if (staticMap[name]) {
    return staticMap[name];
  }

  const chapterMatch = /^chapter_(\d+)\.txt$/i.exec(name);
  if (chapterMatch) {
    return `第${chapterMatch[1]}章`;
  }

  return name;
});

const handleClick = () => {
  if (props.node.type === "folder") {
    expanded.value = !expanded.value;
    return;
  }

  emit("open", {
    path: props.node.path,
    name: displayName.value,
    kind: props.node.chapterNumber ? "chapter" : "file",
    chapterNumber: props.node.chapterNumber,
  });
};
</script>

<style scoped>
.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-muted);
}

.file-row:hover {
  background: rgba(126, 91, 255, 0.12);
  color: var(--text);
}

.file-row.active {
  background: rgba(126, 91, 255, 0.2);
  color: var(--text);
}

.file-row.folder {
  font-weight: 600;
}

.chevron {
  width: 12px;
  display: inline-flex;
  justify-content: center;
  color: var(--accent-bright);
}

.file-children {
  list-style: none;
  padding-left: 12px;
  margin: 4px 0 0 0;
}
</style>

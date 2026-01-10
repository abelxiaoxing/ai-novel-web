<template>
  <li>
    <div
      class="file-row"
      :class="{
        active: isActive,
        folder: node.type === 'folder',
      }"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
    >
      <span class="chevron" v-if="node.type === 'folder'">{{ expanded ? '▾' : '▸' }}</span>
      <span v-if="!isRenaming" class="file-name">{{ displayName }}</span>
      <input
        v-else
        ref="renameInput"
        class="rename-input"
        :value="renameValue"
        @input="onRenameInput"
        @keydown.enter.prevent="confirmRename"
        @keydown.esc.prevent="cancelRename"
        @blur="confirmRename"
      />
    </div>
    <ul v-if="node.type === 'folder' && expanded" class="file-children">
      <FileTreeItem
        v-for="child in node.children ?? []"
        :key="child.id"
        :node="child"
        :active-path="activePath"
        :renaming-id="renamingId"
        @open="emit('open', $event)"
        @rename="emit('rename', $event)"
        @cancel-rename="emit('cancel-rename')"
        @context="emit('context', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { FileNode, ActiveFile } from "@/stores/project";
import FileTreeItem from "@/components/FileTreeItem.vue";

const props = defineProps<{
  node: FileNode;
  activePath?: string | null;
  renamingId?: string | null;
}>();

const emit = defineEmits<{
  (event: "open", payload: ActiveFile): void;
  (event: "rename", payload: { node: FileNode; name: string }): void;
  (event: "cancel-rename"): void;
  (event: "context", payload: { node: FileNode; x: number; y: number }): void;
}>();

const expanded = ref(true);
const isActive = computed(() => props.activePath === props.node.path);
const isRenaming = computed(() => props.renamingId === props.node.id);
const renameValue = ref(props.node.name);
const renameInput = ref<HTMLInputElement | null>(null);
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
  if (isRenaming.value) {
    return;
  }

  emit("open", {
    path: props.node.path,
    name: displayName.value,
    kind: props.node.chapterNumber ? "chapter" : "file",
    chapterNumber: props.node.chapterNumber,
  });
};

const handleContextMenu = (event: MouseEvent) => {
  if (props.node.type === "folder") {
    return;
  }
  emit("context", { node: props.node, x: event.clientX, y: event.clientY });
};

const onRenameInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  renameValue.value = target.value;
};

const confirmRename = () => {
  if (!isRenaming.value) {
    return;
  }
  const next = renameValue.value.trim();
  if (!next || next === props.node.name) {
    emit("cancel-rename");
    return;
  }
  emit("rename", { node: props.node, name: next });
};

const cancelRename = () => {
  emit("cancel-rename");
};

watch(
  () => isRenaming.value,
  async (value) => {
    if (value) {
      renameValue.value = props.node.name;
      await nextTick();
      renameInput.value?.focus();
      renameInput.value?.select();
    }
  }
);
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

.rename-input {
  flex: 1;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid rgba(126, 91, 255, 0.4);
  background: rgba(15, 11, 22, 0.6);
  color: var(--text);
  font-size: 12px;
}
</style>

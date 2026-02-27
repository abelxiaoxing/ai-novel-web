<template>
  <section class="editor panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">{{ title }}</div>
        <div v-if="subtitle" class="muted">{{ subtitle }}</div>
      </div>
      <div class="editor-meta">
        <div class="font-controls">
          <button class="font-btn" type="button" @click="changeFontSize(-1)">A-</button>
          <span class="font-size-label">{{ fontSize }}px</span>
          <button class="font-btn" type="button" @click="changeFontSize(1)">A+</button>
        </div>
        <span class="muted">{{ charCount }} 字</span>
        <span v-if="saveStatusText" :class="['save-status', saveStatusClass]">{{ saveStatusText }}</span>
      </div>
    </div>
    <div class="editor-body">
      <textarea
        ref="textareaRef"
        class="editor-textarea"
        :class="{ 'editor-textarea--readonly': isLogView }"
        :value="displayContent"
        :style="{ fontSize: `${fontSize}px` }"
        :readonly="isLogView"
        @input="handleInput"
        @keydown="handleKeydown"
        spellcheck="false"
      ></textarea>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { useAutoSave } from "@/composables/useAutoSave";
import { useWorkflowStore } from "@/stores/workflow";
import type { ActiveFile } from "@/stores/project";
import type { TaskItem } from "@/stores/task";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    content: string;
    activeFile?: ActiveFile;
    activeTask?: TaskItem | null;
  }>(),
  {
    subtitle: "",
    activeTask: null,
  }
);

const emit = defineEmits<{
  (event: "update:content", value: string): void;
  (event: "save"): void;
}>();

const workflowStore = useWorkflowStore();
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const localContent = ref(props.content);
const fontSize = ref(13);

watch(
  () => props.content,
  (newContent) => {
    localContent.value = newContent;
    autoSave.resetWithContent(newContent);
  }
);


const { saveStatus, saveNow, hasUnsavedChanges, resetWithContent } = useAutoSave(
  localContent,
  {
    debounceMs: 3000,
    onSave: async () => {
      emit("save");
    },
  }
);

const autoSave = { saveStatus, saveNow, hasUnsavedChanges, resetWithContent };

const isLogView = computed(() => props.activeFile?.kind === "task-log");

const activeLogContent = computed(() => {
  if (!props.activeTask) {
    return "未选择任务。";
  }
  const chunks: string[] = [];
  if (props.activeTask.error) {
    chunks.push(`[错误] ${props.activeTask.error}`);
  }
  if (props.activeTask.logs.length) {
    chunks.push(...props.activeTask.logs);
  }
  if (chunks.length === 0) {
    chunks.push("暂无日志输出。");
  }
  return chunks.join("\n");
});

const displayContent = computed(() =>
  isLogView.value ? activeLogContent.value : props.content
);

const charCount = computed(() => displayContent.value.length);

const finalizeStatus = computed(() => {
  if (isLogView.value) {
    if (!props.activeTask) {
      return "空闲";
    }
    return `${props.activeTask.label} · ${statusLabel(props.activeTask.status)}`;
  }

  if (props.activeFile?.kind === "chapter" && typeof props.activeFile.chapterNumber === "number") {
    const chapter = props.activeFile.chapterNumber;
    const state = workflowStore.getChapterStatus(chapter);

    if (state.status === "finalized") {
      if (state.deletedFromVectorstore) {
        return "待重新定稿";
      }
      return "已定稿";
    }
    if (state.status === "draft-pending") {
      if (state.modifiedSinceFinalize) {
        return "待重新定稿";
      }
      return "草稿待定稿";
    }
  }
  return null;
});

const saveStatusText = computed(() => {
  if (finalizeStatus.value) {
    return finalizeStatus.value;
  }

  switch (saveStatus.value) {
    case "saving":
      return "保存中...";
    case "unsaved":
      return "未保存";
    case "saved":
      return "";
    default:
      return "";
  }
});

const saveStatusClass = computed(() => {
  if (isLogView.value) {
    if (!props.activeTask) {
      return "status-saved";
    }
    if (props.activeTask.status === "failed") {
      return "status-unsaved";
    }
    if (props.activeTask.status === "running" || props.activeTask.status === "pending") {
      return "status-saving";
    }
    return "status-finalized";
  }

  if (finalizeStatus.value) {
    if (finalizeStatus.value === "待重新定稿") {
      return "status-needs-refinalize";
    }
    if (finalizeStatus.value === "草稿待定稿") {
      return "status-draft-pending";
    }
    return "status-finalized";
  }

  switch (saveStatus.value) {
    case "saving":
      return "status-saving";
    case "unsaved":
      return "status-unsaved";
    case "saved":
      return "status-saved";
    default:
      return "";
  }
});

const changeFontSize = (delta: number) => {
  const nextSize = Math.min(24, Math.max(11, fontSize.value + delta));
  fontSize.value = nextSize;
};

const handleInput = (event: Event) => {
  if (isLogView.value) {
    return;
  }
  const target = event.target as HTMLTextAreaElement;
  localContent.value = target.value;
  emit("update:content", target.value);
};

const handleKeydown = async (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    if (!isLogView.value) {
      await saveNow();
    }
  }
};

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!isLogView.value && hasUnsavedChanges.value) {
    event.preventDefault();
    event.returnValue = "您有未保存的更改，确定要离开吗？";
    return event.returnValue;
  }
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: "等待中",
    running: "进行中",
    success: "已完成",
    failed: "已失败",
  };
  return map[status] ?? "未知状态";
};


onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<style scoped>
.editor {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}


.font-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.font-btn {
  border: 1px solid rgba(125, 186, 233, 0.35);
  border-radius: 6px;
  background: rgba(47, 155, 255, 0.12);
  color: var(--text);
  font-size: 11px;
  padding: 3px 6px;
}

.font-size-label {
  min-width: 40px;
  font-size: 12px;
  color: var(--text-muted);
}

.editor-body {
  flex: 1;
  padding: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(229, 225, 245, 0.12);
  border-radius: 12px;
  background: rgba(12, 10, 18, 0.65);
  color: var(--text);
  padding: 14px;
  font-family: var(--font-mono);
  line-height: 1.6;
  outline: none;
}

.editor-textarea--readonly {
  border-color: rgba(125, 186, 233, 0.22);
  background: rgba(7, 18, 30, 0.78);
}


.save-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.status-saved {
  color: var(--success, #22c55e);
  background: rgba(34, 197, 94, 0.1);
}

.status-unsaved {
  color: var(--warning, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
}

.status-saving {
  color: var(--info, #3b82f6);
  background: rgba(59, 130, 246, 0.1);
}

.status-finalized {
  color: var(--success, #22c55e);
  background: rgba(34, 197, 94, 0.1);
}

.status-needs-refinalize {
  color: var(--warning, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
}

.status-draft-pending {
  color: var(--warning, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
}
</style>

<template>
  <section class="editor panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">{{ title }}</div>
        <div class="muted">{{ subtitle }}</div>
      </div>
      <div class="editor-meta">
        <span class="muted">{{ charCount }} 字</span>
        <span :class="['save-status', saveStatusClass]">{{ saveStatusText }}</span>
      </div>
    </div>
    <div class="editor-body">
      <textarea
        ref="textareaRef"
        class="editor-textarea"
        :value="content"
        @input="handleInput"
        @keydown="handleKeydown"
        spellcheck="false"
      ></textarea>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { useAutoSave, type SaveStatus } from "@/composables/useAutoSave";
import { useWorkflowStore } from "@/stores/workflow";
import type { ActiveFile } from "@/stores/project";

const props = defineProps<{
  title: string;
  subtitle?: string;
  content: string;
  activeFile?: ActiveFile;
}>();

const emit = defineEmits<{
  (event: "update:content", value: string): void;
  (event: "save"): void;
}>();

const workflowStore = useWorkflowStore();
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const localContent = ref(props.content);

// Sync local content with props
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

// Expose autoSave for external use
const autoSave = { saveStatus, saveNow, hasUnsavedChanges, resetWithContent };

const charCount = computed(() => props.content.length);

// 检查当前打开的是否是章节文件，以及需要重新定稿的状态
const finalizeStatus = computed(() => {
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
  // 优先显示定稿状态（如果是章节文件）
  if (finalizeStatus.value) {
    return finalizeStatus.value;
  }

  // 否则显示保存状态
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
  // 优先显示定稿状态（如果是章节文件）
  if (finalizeStatus.value) {
    if (finalizeStatus.value === "待重新定稿") {
      return "status-needs-refinalize";
    }
    if (finalizeStatus.value === "草稿待定稿") {
      return "status-draft-pending";
    }
    return "status-finalized";
  }

  // 否则显示保存状态
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

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  localContent.value = target.value;
  emit("update:content", target.value);
};

const handleManualSave = async () => {
  await saveNow();
};

const handleKeydown = async (event: KeyboardEvent) => {
  // Ctrl+S or Cmd+S for immediate save
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    await saveNow();
  }
};

// Warn user before leaving with unsaved changes
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    event.preventDefault();
    // Modern browsers require returnValue to be set
    event.returnValue = "您有未保存的更改，确定要离开吗？";
    return event.returnValue;
  }
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
  gap: 12px;
}

.editor-body {
  flex: 1;
  padding: 12px;
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
  font-size: 13px;
  line-height: 1.6;
  outline: none;
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

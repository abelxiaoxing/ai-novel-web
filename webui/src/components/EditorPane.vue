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
      <div
        v-if="isChapterView"
        ref="chapterEditorRef"
        class="chapter-editor"
        :style="{ fontSize: `${fontSize}px` }"
      >
        <div
          v-for="(line, index) in chapterLines"
          :key="`line-${index}`"
          class="chapter-line-row"
        >
          <textarea
            v-if="activeLineIndex === index"
            ref="lineEditorRef"
            class="chapter-line-editor"
            :class="{ 'chapter-line-editor--first': shouldIndentLine(index, lineInputValue) }"
            :value="lineInputValue"
            rows="1"
            spellcheck="false"
            @input="handleLineInput"
            @blur="finishLineEdit"
            @keydown="handleLineKeydown"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
          ></textarea>
          <div
            v-else
            class="chapter-line-preview"
            :class="{ 'chapter-line-preview--first': shouldIndentLine(index, line) }"
            :data-line-index="index"
            @click="handlePreviewClick(index)"
          >
            <span v-if="line.length > 0">{{ line }}</span>
            <span v-else class="chapter-line-placeholder"></span>
          </div>
        </div>
      </div>
      <textarea
        v-else
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
import { computed, nextTick, ref, watch, onMounted, onBeforeUnmount } from "vue";
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
const chapterEditorRef = ref<HTMLElement | null>(null);
const lineEditorRef = ref<HTMLTextAreaElement | HTMLTextAreaElement[] | null>(null);
const localContent = ref(props.content);
const fontSize = ref(13);
const activeLineIndex = ref<number | null>(null);
const lineInputValue = ref("");
const isComposing = ref(false);

watch(
  () => props.content,
  (newContent) => {
    if (newContent === localContent.value) {
      return;
    }
    localContent.value = newContent;
    activeLineIndex.value = null;
    lineInputValue.value = "";
    autoSave.resetWithContent(newContent);
  }
);

watch(
  () => props.activeFile?.path,
  () => {
    activeLineIndex.value = null;
    lineInputValue.value = "";
    autoSave.resetWithContent(localContent.value);
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
const isChapterView = computed(
  () => !isLogView.value && props.activeFile?.kind === "chapter"
);

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
  isLogView.value ? activeLogContent.value : localContent.value
);

const charCount = computed(() => displayContent.value.length);
const chapterLines = computed(() => displayContent.value.split("\n"));

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
    if (props.activeTask.status === "cancelled") {
      return "status-draft-pending";
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

const syncContent = (value: string) => {
  localContent.value = value;
  emit("update:content", value);
};

const normalizeLineInput = (value: string) => value.replace(/\r\n?/g, "\n");

const isSaveShortcut = (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

const shouldIndentLine = (_index: number, line: string) => line.trim().length > 0;

const focusLineEditor = async (cursor: "start" | "end" | number) => {
  await nextTick();
  const editorRef = lineEditorRef.value;
  const editor = Array.isArray(editorRef) ? (editorRef[0] ?? null) : editorRef;
  if (!editor) {
    return;
  }
  editor.focus();
  const pos =
    typeof cursor === "number" ? cursor : cursor === "start" ? 0 : editor.value.length;
  editor.setSelectionRange(pos, pos);
  editor.style.height = "auto";
  editor.style.height = `${editor.scrollHeight}px`;
};

const startLineEdit = async (index: number, cursor: "start" | "end" = "end") => {
  const lines = chapterLines.value;
  if (index < 0 || index >= lines.length) {
    return;
  }
  activeLineIndex.value = index;
  lineInputValue.value = lines[index];
  await focusLineEditor(cursor);
};

const finishLineEdit = () => {
  activeLineIndex.value = null;
  lineInputValue.value = "";
};

const hasPreviewSelection = (): boolean => {
  const selection = window.getSelection();
  const root = chapterEditorRef.value;
  if (!selection || !root || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer) && root.contains(range.endContainer);
};

const handlePreviewClick = async (index: number) => {
  if (hasPreviewSelection()) {
    return;
  }
  await startLineEdit(index);
};

const replaceLine = (index: number, value: string) => {
  const lines = chapterLines.value.slice();
  if (index < 0 || index >= lines.length) {
    return;
  }
  lines[index] = value;
  syncContent(lines.join("\n"));
};

const replaceLineWithLines = (index: number, values: string[]) => {
  const lines = chapterLines.value.slice();
  if (index < 0 || index >= lines.length) {
    return;
  }
  lines.splice(index, 1, ...values);
  syncContent(lines.join("\n"));
};

const handleLineInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  const index = activeLineIndex.value;
  if (index === null) {
    return;
  }
  const nextValue = normalizeLineInput(target.value);
  if (nextValue.includes("\n")) {
    const nextLines = nextValue.split("\n");
    replaceLineWithLines(index, nextLines);
    const caret = Math.max(0, Math.min(target.selectionStart ?? nextValue.length, nextValue.length));
    const beforeCaretLines = nextValue.slice(0, caret).split("\n");
    const lineOffset = beforeCaretLines.length - 1;
    activeLineIndex.value = index + lineOffset;
    lineInputValue.value = nextLines[lineOffset] ?? "";
    const caretOffset = beforeCaretLines[beforeCaretLines.length - 1]?.length ?? 0;
    void focusLineEditor(caretOffset);
    return;
  }
  if (target.value !== nextValue) {
    target.value = nextValue;
  }
  lineInputValue.value = nextValue;
  replaceLine(index, nextValue);
  target.style.height = "auto";
  target.style.height = `${target.scrollHeight}px`;
};

const splitToNextLine = async (target: HTMLTextAreaElement) => {
  const index = activeLineIndex.value;
  if (index === null) {
    return;
  }
  const value = lineInputValue.value;
  const selectionStart = target.selectionStart ?? value.length;
  const selectionEnd = target.selectionEnd ?? value.length;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const lines = chapterLines.value.slice();
  lines[index] = before;
  lines.splice(index + 1, 0, after);
  syncContent(lines.join("\n"));
  activeLineIndex.value = index + 1;
  lineInputValue.value = after;
  await focusLineEditor("start");
};

const mergeLineByDelete = async (
  mode: "backspace" | "delete",
  target: HTMLTextAreaElement
): Promise<boolean> => {
  const index = activeLineIndex.value;
  if (index === null) {
    return false;
  }
  const selectionStart = target.selectionStart ?? 0;
  const selectionEnd = target.selectionEnd ?? 0;
  const valueLength = target.value.length;
  const lines = chapterLines.value.slice();
  if (mode === "backspace") {
    if (selectionStart !== 0 || selectionEnd !== 0 || index <= 0) {
      return false;
    }
    const previous = lines[index - 1] ?? "";
    const current = lines[index] ?? "";
    const caret = previous.length;
    lines[index - 1] = previous + current;
    lines.splice(index, 1);
    syncContent(lines.join("\n"));
    activeLineIndex.value = index - 1;
    lineInputValue.value = lines[index - 1] ?? "";
    await focusLineEditor(caret);
    return true;
  }
  if (selectionStart !== valueLength || selectionEnd !== valueLength || index >= lines.length - 1) {
    return false;
  }
  const current = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  const caret = current.length;
  lines[index] = current + next;
  lines.splice(index + 1, 1);
  syncContent(lines.join("\n"));
  activeLineIndex.value = index;
  lineInputValue.value = lines[index] ?? "";
  await focusLineEditor(caret);
  return true;
};

const moveLineEdit = async (
  direction: "up" | "down",
  target: HTMLTextAreaElement
): Promise<boolean> => {
  const index = activeLineIndex.value;
  if (index === null) {
    return false;
  }
  const caret = target.selectionStart ?? 0;
  const atStart = caret === 0 && target.selectionEnd === 0;
  const atEnd = caret === target.value.length && target.selectionEnd === target.value.length;
  if (direction === "up") {
    if (!atStart || index <= 0) {
      return false;
    }
    await startLineEdit(index - 1, "end");
    return true;
  }
  if (!atEnd || index >= chapterLines.value.length - 1) {
    return false;
  }
  await startLineEdit(index + 1, "start");
  return true;
};

const getLineBaseOffset = (lineIndex: number): number => {
  let offset = 0;
  for (let i = 0; i < lineIndex; i += 1) {
    offset += chapterLines.value[i].length + 1;
  }
  return offset;
};

const resolveLineIndex = (node: Node): number | null => {
  const element = node instanceof Element ? node : node.parentElement;
  const lineElement = element?.closest(".chapter-line-preview") as HTMLElement | null;
  if (!lineElement) {
    return null;
  }
  const index = Number(lineElement.dataset.lineIndex);
  return Number.isInteger(index) ? index : null;
};

const resolveOffsetInLine = (node: Node, offset: number, lineIndex: number): number | null => {
  const element = node instanceof Element ? node : node.parentElement;
  const lineElement = element?.closest(".chapter-line-preview") as HTMLElement | null;
  if (!lineElement) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(lineElement);
  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }
  const lineText = chapterLines.value[lineIndex] ?? "";
  const charOffset = range.toString().length;
  return Math.max(0, Math.min(charOffset, lineText.length));
};

const getPreviewSelectionRange = (): { start: number; end: number } | null => {
  const selection = window.getSelection();
  const root = chapterEditorRef.value;
  if (!selection || !root || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const startLineIndex = resolveLineIndex(range.startContainer);
  const endLineIndex = resolveLineIndex(range.endContainer);
  if (startLineIndex === null || endLineIndex === null) {
    return null;
  }

  const startOffset = resolveOffsetInLine(range.startContainer, range.startOffset, startLineIndex);
  const endOffset = resolveOffsetInLine(range.endContainer, range.endOffset, endLineIndex);
  if (startOffset === null || endOffset === null) {
    return null;
  }

  const start = getLineBaseOffset(startLineIndex) + startOffset;
  const end = getLineBaseOffset(endLineIndex) + endOffset;
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
};

const removePreviewSelection = (start: number, end: number) => {
  if (start >= end) {
    return;
  }
  const next = displayContent.value.slice(0, start) + displayContent.value.slice(end);
  syncContent(next);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  finishLineEdit();
};

const isChapterPreviewHotkeyTarget = (target: EventTarget | null): boolean => {
  const root = chapterEditorRef.value;
  if (!root) {
    return false;
  }
  if (target instanceof Node && root.contains(target)) {
    return true;
  }
  const activeElement = document.activeElement;
  if (
    activeElement &&
    activeElement !== document.body &&
    activeElement !== document.documentElement &&
    !root.contains(activeElement)
  ) {
    return false;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer) && root.contains(range.endContainer);
};

const handleChapterPreviewKeydown = (event: KeyboardEvent) => {
  if (!isChapterView.value || activeLineIndex.value !== null) {
    return;
  }
  if (isSaveShortcut(event)) {
    event.preventDefault();
    void saveNow();
    return;
  }
  if (event.key !== "Backspace" && event.key !== "Delete") {
    return;
  }
  if (!isChapterPreviewHotkeyTarget(event.target)) {
    return;
  }
  const selectionRange = getPreviewSelectionRange();
  if (!selectionRange || selectionRange.start === selectionRange.end) {
    return;
  }
  event.preventDefault();
  removePreviewSelection(selectionRange.start, selectionRange.end);
};

const handleLineKeydown = async (event: KeyboardEvent) => {
  if (isSaveShortcut(event)) {
    event.preventDefault();
    await saveNow();
    return;
  }

  const target = event.target as HTMLTextAreaElement;
  if (event.key === "Enter" && !isComposing.value) {
    event.preventDefault();
    await splitToNextLine(target);
    return;
  }
  if (!isComposing.value && (event.key === "Backspace" || event.key === "Delete")) {
    const merged = await mergeLineByDelete(
      event.key === "Backspace" ? "backspace" : "delete",
      target
    );
    if (merged) {
      event.preventDefault();
      return;
    }
  }
  if (event.key === "ArrowUp") {
    const moved = await moveLineEdit("up", target);
    if (moved) {
      event.preventDefault();
    }
    return;
  }
  if (event.key === "ArrowDown") {
    const moved = await moveLineEdit("down", target);
    if (moved) {
      event.preventDefault();
    }
  }
};

const handleInput = (event: Event) => {
  if (isLogView.value) {
    return;
  }
  const target = event.target as HTMLTextAreaElement;
  syncContent(target.value);
};

const handleKeydown = async (event: KeyboardEvent) => {
  if (isSaveShortcut(event)) {
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
    cancelled: "已取消",
  };
  return map[status] ?? "未知状态";
};


onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("keydown", handleChapterPreviewKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("keydown", handleChapterPreviewKeydown);
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

.chapter-editor {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(229, 225, 245, 0.12);
  border-radius: 12px;
  background: rgba(12, 10, 18, 0.65);
  color: var(--text);
  padding: 14px;
  font-family: var(--font-ui);
  line-height: 1.85;
  overflow: auto;
}

.chapter-line-row {
  min-height: 1.85em;
}

.chapter-line-preview {
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
  user-select: text;
  border-radius: 6px;
  padding: 0 2px;
}

.chapter-line-preview:hover {
  background: rgba(47, 155, 255, 0.08);
}

.chapter-line-preview--first {
  text-indent: 2em;
}

.chapter-line-placeholder {
  display: inline-block;
  width: 100%;
  min-height: 1.85em;
}

.chapter-line-editor {
  width: 100%;
  min-height: 1.85em;
  resize: none;
  overflow: hidden;
  border: 1px solid rgba(47, 155, 255, 0.35);
  border-radius: 6px;
  background: rgba(17, 29, 45, 0.82);
  color: var(--text);
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0 6px;
  outline: none;
}

.chapter-line-editor--first {
  text-indent: 2em;
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

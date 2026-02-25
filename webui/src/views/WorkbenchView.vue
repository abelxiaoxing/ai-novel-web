<template>
  <div class="workbench-view">
    <GlobalProgressBar
      :visible="batchRunning"
      :label="batchProgressText"
      :percent="batchProgressPercent"
      :show-cancel="true"
      :cancel-disabled="batchCancelRequested"
      @cancel="cancelBatch"
    />
    <div class="app-grid" :class="[batchRunning ? 'with-progress' : '', panelStore.gridClass].filter(Boolean).join(' ')">
      <TopBar
        :project-name="projectStore.currentProject?.name"
        :genre="projectStore.currentProject?.genre"
        :status-label="statusLabel"
        :status-variant="statusVariant"
        :file-count="fileCount"
        :chapter-count="chapterCount"
        :export-disabled="chapterCount === 0"
        @export-txt="handleExport('txt')"
        @export-epub="handleExport('epub')"
        @projects="goProjects"
        @settings="goSettings"
      />

      <Sidebar
        class="sidebar"
        :nodes="projectStore.fileTree"
        :active-path="projectStore.activeFile?.path"
        :sidebar-visible="panelStore.sidebar"
        @open="projectStore.openFile"
        @rename="handleFileRename"
        @delete="handleFileDelete"
        @toggle="panelStore.toggle('sidebar')"
      />

      <EditorPane
        :title="editorTitle"
        :subtitle="editorSubtitle"
        :content="projectStore.editorContent"
        :active-file="projectStore.activeFile"
        @update:content="projectStore.setEditorContent"
        @save="handleSaveActiveFile"
      />

      <RightPanel
        :form="form"
        :right-panel-visible="panelStore.rightPanel"
        @update:form="handleFormUpdate"
        @run="runAction"
        @next-chapter="handleNextChapter"
        @import-knowledge="handleKnowledgeImport"
        @manage-vectorstore="handleVectorstoreManage"
        @toggle="panelStore.toggle('rightPanel')"
      />

      <BottomPanel
        :tasks="taskStore.tasks"
        :active-task="taskStore.activeTask"
        :active-task-id="taskStore.activeTaskId"
        :bottom-panel-visible="panelStore.bottomPanel"
        @select="taskStore.activeTaskId = $event"
        @open-file="openOutputFile"
        @toggle="panelStore.toggle('bottomPanel')"
      />
    </div>

    <PromptModal
      v-if="promptModalOpen"
      :content="promptText"
      @close="promptModalOpen = false"
      @confirm="usePrompt"
    />

    <VectorstoreModal
      v-if="vectorstoreModalOpen && projectStore.currentProject"
      :project-id="projectStore.currentProject.id"
      :embedding-config-name="form.embeddingConfigName"
      @close="vectorstoreModalOpen = false"
      @cleared="handleVectorstoreCleared"
      @deleted-chapter="handleVectorstoreDeletedChapter"
    />

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BottomPanel from "@/components/BottomPanel.vue";
import EditorPane from "@/components/EditorPane.vue";
import GlobalProgressBar from "@/components/GlobalProgressBar.vue";
import PromptModal from "@/components/PromptModal.vue";
import VectorstoreModal from "@/components/VectorstoreModal.vue";
import RightPanel, { type WorkbenchForm } from "@/components/RightPanel.vue";
import Sidebar from "@/components/Sidebar.vue";
import TopBar from "@/components/TopBar.vue";
import type { ProjectState, WorkbenchFormState, WorkflowSnapshot, BatchTaskState } from "@/api/types";
import type { ChapterState } from "@/stores/workflow";
import {
  downloadProjectExport,
  getProjectFile,
  getProjectState,
  updateProjectState,
  type ProjectExportFormat,
} from "@/api/projects";
import { useConfigStore } from "@/stores/config";
import { useProjectStore, type ActiveFile, type FileNode } from "@/stores/project";
import { useTaskStore } from "@/stores/task";
import { useToastStore } from "@/stores/toast";
import { useWorkflowStore } from "@/stores/workflow";
import { usePanelStore } from "@/stores/panel";
import { useChapterInfo } from "@/composables/useChapterInfo";
import {
  buildPrompt,
  cancelTask,
  consistencyCheck,
  clearVectorStore,
  finalizeChapter,
  generateArchitecture,
  generateBlueprint,
  generateBatch,
  generateDraft,
  getVectorstoreSummary,
  importKnowledge,
} from "@/api/tasks";

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const taskStore = useTaskStore();
const configStore = useConfigStore();
const toastStore = useToastStore();
const workflowStore = useWorkflowStore();
const panelStore = usePanelStore();

const promptModalOpen = ref(false);
const promptText = ref("");
const vectorstoreModalOpen = ref(false);
const pendingPromptTask = ref<string | null>(null);
const handledTasks = ref(new Set<string>());
const stateLoaded = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const taskActionMap = new Map<string, string>();

const form = reactive<WorkbenchForm>({
  topic: "",
  genre: "",
  numberOfChapters: "10",
  wordNumber: "3000",
  userGuidance: "",
  chapterNumber: "1",
  charactersInvolved: "",
  keyItems: "",
  sceneLocation: "",
  timeConstraint: "",
  llmConfigName: "",
  embeddingConfigName: "",
  batchEndChapter: "10",
});

const blueprintContent = ref("");
const autoFillLock = ref(false);
const chapterNumberValue = computed(() => {
  const parsed = Number(form.chapterNumber);
  return Number.isNaN(parsed) ? 0 : parsed;
});

const { markAsOverridden } = useChapterInfo({
  chapterNumber: chapterNumberValue,
  blueprintContent,
  onAutoFill: (info) => {
    autoFillLock.value = true;
    form.charactersInvolved = info.characters.join("、");
    form.sceneLocation = info.scenes.join("、");
    autoFillLock.value = false;
  },
});

const batchRunning = ref(false);
const batchCancelRequested = ref(false);
const batchProgress = ref({ current: 0, total: 0 });
const batchSummary = ref("");
const batchError = ref("");
const batchTaskId = ref<string | null>(null);
const batchConfig = ref({ start: 1, end: 1, delaySeconds: 0 });
const workflowSnapshot = ref<WorkflowSnapshot>({ chapterStatuses: {} });
let batchRefreshTimer: ReturnType<typeof setInterval> | null = null;
let batchRefreshPending = false;

const localStatePrefix = "ainovel:project-state:";

const hasLocalStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const buildLocalStateKey = (projectId: string) => `${localStatePrefix}${projectId}`;

const loadLocalState = (projectId: string): ProjectState | null => {
  if (!hasLocalStorage()) {
    return null;
  }
  try {
    const raw = localStorage.getItem(buildLocalStateKey(projectId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as ProjectState;
  } catch (error) {
    console.warn("Failed to read local project state.", error);
    return null;
  }
};

const saveLocalState = (projectId: string, payload: ProjectState) => {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    localStorage.setItem(buildLocalStateKey(projectId), JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to cache local project state.", error);
  }
};

const mergeProjectState = (
  remote: ProjectState | null,
  local: ProjectState | null
): ProjectState => {
  const safeRemote = remote ?? {};
  const safeLocal = local ?? {};

  // Deep merge workflow.chapterStatuses to preserve local chapter states
  const remoteChapterStatuses = safeRemote.workflow?.chapterStatuses ?? {};
  const localChapterStatuses = safeLocal.workflow?.chapterStatuses ?? {};
  const mergedChapterStatuses = { ...localChapterStatuses, ...remoteChapterStatuses };

  return {
    ...safeLocal,
    ...safeRemote,
    form: { ...safeLocal.form, ...safeRemote.form },
    activeFile: safeRemote.activeFile ?? safeLocal.activeFile,
    workflow: {
      ...safeLocal.workflow,
      ...safeRemote.workflow,
      chapterStatuses: mergedChapterStatuses,
    },
  };
};

const normalizeWorkflowSnapshot = (value?: WorkflowSnapshot): WorkflowSnapshot => {
  if (!value || typeof value !== "object") {
    return { chapterStatuses: {} };
  }

  // 兼容旧的 finalizedChapters 格式
  if (Array.isArray(value.finalizedChapters)) {
    const chapterStatuses: Record<number, ChapterState> = {};
    value.finalizedChapters.forEach((chapter) => {
      const chapterNum = Number(chapter);
      if (Number.isInteger(chapterNum) && chapterNum > 0) {
        chapterStatuses[chapterNum] = { status: "finalized" };
      }
    });
    return { chapterStatuses };
  }

  // 新格式 chapterStatuses
  if (value.chapterStatuses && typeof value.chapterStatuses === "object") {
    const chapterStatuses: Record<number, ChapterState> = {};
    Object.entries(value.chapterStatuses).forEach(([key, val]) => {
      const chapterNum = Number(key);
      const state = val as ChapterState;
      if (Number.isInteger(chapterNum) && chapterNum > 0 && state && typeof state.status === "string") {
        chapterStatuses[chapterNum] = state;
      }
    });
    return { chapterStatuses };
  }

  return { chapterStatuses: {} };
};

const buildWorkflowSnapshot = (): WorkflowSnapshot => ({
  chapterStatuses: { ...workflowStore.chapterStatuses },
});

const normalizePayloadContent = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "content" in payload &&
    typeof (payload as { content: string }).content === "string"
  ) {
    return (payload as { content: string }).content;
  }
  return "";
};

const reconcileChapterStatuses = (
  chapterNumbers: number[],
  snapshotStatuses: Record<number, ChapterState>
): { chapterStatuses: Record<number, ChapterState>; updated: boolean } => {
  if (!chapterNumbers.length) {
    return { chapterStatuses: { ...snapshotStatuses }, updated: false };
  }
  const nextStatuses = { ...snapshotStatuses };
  let updated = false;
  chapterNumbers.forEach((chapterNumber) => {
    if (!nextStatuses[chapterNumber]) {
      // Assume chapters on disk are ready to continue if state is missing.
      nextStatuses[chapterNumber] = { status: "finalized" };
      updated = true;
    }
  });
  return { chapterStatuses: nextStatuses, updated };
};

const loadBlueprintContent = async () => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    blueprintContent.value = "";
    return;
  }
  try {
    const payload = await getProjectFile(projectId, "directory");
    blueprintContent.value = normalizePayloadContent(payload);
  } catch (error) {
    console.warn("Failed to load blueprint content.", error);
    blueprintContent.value = "";
  }
};

const statusLabel = computed(() => {
  if (projectStore.loading) {
    return "同步中";
  }
  if (projectStore.error) {
    return "异常";
  }
  return "就绪";
});

const statusVariant = computed(() => {
  if (projectStore.error) {
    return "danger";
  }
  if (projectStore.loading) {
    return "warn";
  }
  return "success";
});

const countNodes = (nodes: FileNode[]): number =>
  nodes.reduce((total, node) => {
    const next = node.children ? countNodes(node.children) : 0;
    return total + (node.type === "file" ? 1 : 0) + next;
  }, 0);

const countChapters = (nodes: FileNode[]): number =>
  nodes.reduce((total, node) => {
    const next = node.children ? countChapters(node.children) : 0;
    return total + (node.chapterNumber ? 1 : 0) + next;
  }, 0);

const fileCount = computed(() => countNodes(projectStore.fileTree));
const chapterCount = computed(() => countChapters(projectStore.fileTree));

const localizePath = (path: string) => {
  const map: Record<string, string> = {
    architecture: "小说架构",
    directory: "章节蓝图",
    summary: "全局摘要",
    character_state: "角色状态",
    plot_arcs: "剧情要点",
    chapters: "章节",
    vectorstore: "向量库",
  };
  return path
    .split("/")
    .map((part) => {
      if (map[part]) {
        return map[part];
      }
      const chapterKeyMatch = /^chapter:(\d+)$/i.exec(part);
      if (chapterKeyMatch) {
        return `第${chapterKeyMatch[1]}章`;
      }
      const chapterMatch = /^chapter_(\d+)\.txt$/i.exec(part);
      if (chapterMatch) {
        return `第${chapterMatch[1]}章`;
      }
      return part;
    })
    .join("/");
};

const editorTitle = computed(() =>
  projectStore.activeFile ? projectStore.activeFile.name : "请选择文件"
);
const editorSubtitle = computed(() => {
  if (!projectStore.activeFile) {
    return "打开项目文件进行编辑";
  }
  const name = projectStore.activeFile.name;
  const path = localizePath(projectStore.activeFile.path);
  if (name === path) {
    return "";
  }
  return path;
});

const resolveOutputFile = (fileKey: string): ActiveFile | null => {
  if (!fileKey) {
    return null;
  }
  const chapterMatch = /^chapter:(\d+)$/i.exec(fileKey);
  if (chapterMatch) {
    const chapterNumber = Number(chapterMatch[1]);
    if (!Number.isNaN(chapterNumber)) {
      return {
        path: `chapter:${chapterNumber}`,
        name: localizePath(`chapter:${chapterNumber}`),
        kind: "chapter",
        chapterNumber,
      };
    }
  }
  return {
    path: fileKey,
    name: localizePath(fileKey),
    kind: "file",
  };
};

const openOutputFile = async (fileKey: string) => {
  const target = resolveOutputFile(fileKey);
  if (!target) {
    return;
  }
  await projectStore.openFile(target);
};

const parseErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const message = error.message?.trim();
  if (!message) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object" && "detail" in parsed) {
      const detail = (parsed as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) {
        return detail;
      }
    }
  } catch {
    // 非 JSON 字符串，直接使用原始错误信息。
  }
  return message;
};

const triggerDownload = (blob: Blob, filename: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
};

const handleExport = async (format: ProjectExportFormat) => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }
  const formatLabel = format.toUpperCase();
  try {
    const { filename, blob } = await downloadProjectExport(projectId, format);
    triggerDownload(blob, filename);
    toastStore.success(`已导出 ${formatLabel}：${filename}`);
  } catch (error) {
    toastStore.error(parseErrorMessage(error, `导出 ${formatLabel} 失败`));
  }
};

const formKeys: (keyof WorkbenchForm)[] = [
  "topic",
  "genre",
  "numberOfChapters",
  "wordNumber",
  "userGuidance",
  "chapterNumber",
  "charactersInvolved",
  "keyItems",
  "sceneLocation",
  "timeConstraint",
  "llmConfigName",
  "embeddingConfigName",
  "batchEndChapter",
];

const applyFormState = (state?: WorkbenchFormState) => {
  if (!state) {
    return;
  }
  formKeys.forEach((key) => {
    const value = state[key];
    if (value === undefined || value === null) {
      return;
    }
    form[key] = String(value);
  });
};

const normalizeActiveFile = (value?: ProjectState["activeFile"]): ActiveFile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const { path, kind, chapterNumber } = value;
  if (typeof path !== "string" || (kind !== "file" && kind !== "chapter")) {
    return null;
  }
  let resolvedChapterNumber = chapterNumber;
  if (kind === "chapter" && typeof resolvedChapterNumber !== "number") {
    const match = /^chapter:(\d+)$/i.exec(path);
    if (match) {
      const parsed = Number(match[1]);
      if (!Number.isNaN(parsed)) {
        resolvedChapterNumber = parsed;
      }
    }
  }
  if (
    kind === "chapter" &&
    (typeof resolvedChapterNumber !== "number" ||
      Number.isNaN(resolvedChapterNumber))
  ) {
    return null;
  }
  return {
    path,
    name: localizePath(path),
    kind,
    chapterNumber: resolvedChapterNumber,
  };
};

const collectChapterNumbers = (nodes: FileNode[]): number[] => {
  const numbers: number[] = [];
  const walk = (entries: FileNode[]) => {
    entries.forEach((node) => {
      if (typeof node.chapterNumber === "number") {
        numbers.push(node.chapterNumber);
      }
      if (node.children) {
        walk(node.children);
      }
    });
  };
  walk(nodes);
  return numbers;
};

const resolveFallbackFile = (): ActiveFile | null => {
  const chapters = collectChapterNumbers(projectStore.fileTree);
  if (chapters.length) {
    const latest = Math.max(...chapters);
    return {
      path: `chapter:${latest}`,
      name: localizePath(`chapter:${latest}`),
      kind: "chapter",
      chapterNumber: latest,
    };
  }
  return {
    path: "architecture",
    name: localizePath("architecture"),
    kind: "file",
  };
};

const fetchProjectFileContent = async (fileKey: string): Promise<string> => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return "";
  }
  try {
    const payload = await getProjectFile(projectId, fileKey);
    return normalizePayloadContent(payload);
  } catch (error) {
    console.warn(`Failed to load ${fileKey} content.`, error);
    return "";
  }
};

const resolveEmbeddingConfigName = (): string | undefined => {
  if (form.embeddingConfigName) {
    return form.embeddingConfigName;
  }
  if (configStore.chooseConfigs.embedding) {
    return configStore.chooseConfigs.embedding;
  }
  if (configStore.embeddingConfigs.length > 0) {
    return configStore.embeddingConfigs[0];
  }
  return undefined;
};

const loadVectorstoreChapters = async (): Promise<Set<number> | null> => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return null;
  }
  try {
    const embeddingConfigName = resolveEmbeddingConfigName();
    const summary = await getVectorstoreSummary(projectId, embeddingConfigName);
    const chapters = new Set<number>();
    summary.groups.forEach((group) => {
      if (group.type === "chapter" && typeof group.chapter === "number") {
        chapters.add(group.chapter);
      }
    });
    return chapters;
  } catch (error) {
    console.warn("Failed to load vectorstore summary for workflow sync.", error);
    return null;
  }
};

const applyVectorstoreStatus = (
  chapterStatuses: Record<number, ChapterState>,
  vectorstoreChapters: Set<number>
): { chapterStatuses: Record<number, ChapterState>; updated: boolean } => {
  let updated = false;
  const nextStatuses: Record<number, ChapterState> = { ...chapterStatuses };

  Object.entries(chapterStatuses).forEach(([chapterKey, state]) => {
    const chapterNumber = Number(chapterKey);
    if (!Number.isInteger(chapterNumber)) {
      return;
    }
    if (state.status !== "finalized") {
      return;
    }
    const existsInVectorstore = vectorstoreChapters.has(chapterNumber);
    if (!existsInVectorstore && !state.deletedFromVectorstore) {
      nextStatuses[chapterNumber] = { ...state, deletedFromVectorstore: true };
      updated = true;
    }
    if (existsInVectorstore && state.deletedFromVectorstore) {
      nextStatuses[chapterNumber] = { ...state, deletedFromVectorstore: false };
      updated = true;
    }
  });

  return { chapterStatuses: updated ? nextStatuses : chapterStatuses, updated };
};

const syncWorkflowFromProject = async (
  options: { checkVectorstore?: boolean } = {}
): Promise<boolean> => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return false;
  }

  const currentChapter =
    chapterNumberValue.value > 0 ? chapterNumberValue.value : workflowStore.currentChapter;
  const chapters = collectChapterNumbers(projectStore.fileTree);

  // 从 workflowSnapshot 获取章节状态
  const snapshotStatuses = workflowSnapshot.value.chapterStatuses ?? {};
  let { chapterStatuses, updated } = reconcileChapterStatuses(chapters, snapshotStatuses);
  if (updated) {
    workflowSnapshot.value = { chapterStatuses };
  }

  // hasDraft: 检查是否存在任意章节的草稿（文件树中有章节文件）
  // 只要有章节文件，就认为有草稿
  const hasDraft = chapters.length > 0;

  // hasFinalize: 检查是否存在任意章节已定稿
  const hasFinalize = Object.values(chapterStatuses).some((state) => state.status === "finalized");

  if (options.checkVectorstore && hasFinalize) {
    const vectorstoreChapters = await loadVectorstoreChapters();
    if (vectorstoreChapters) {
      const vectorstoreResult = applyVectorstoreStatus(chapterStatuses, vectorstoreChapters);
      chapterStatuses = vectorstoreResult.chapterStatuses;
      if (vectorstoreResult.updated) {
        updated = true;
        workflowSnapshot.value = { chapterStatuses };
      }
    }
  }

  const [architectureText, blueprintText] = await Promise.all([
    fetchProjectFileContent("architecture"),
    fetchProjectFileContent("directory"),
  ]);

  const hasArchitecture = architectureText.trim().length > 0;
  const hasBlueprint = blueprintText.trim().length > 0;

  // normalizedHasBlueprint: 有蓝图文件，或者有任意章节的草稿/定稿
  const normalizedHasBlueprint = hasBlueprint || hasDraft || hasFinalize;
  const normalizedHasArchitecture = hasArchitecture || normalizedHasBlueprint;

  const totalChapters = Number(form.numberOfChapters);
  const resolvedTotalChapters =
    Number.isFinite(totalChapters) && totalChapters > 0
      ? totalChapters
      : workflowStore.totalChapters;

  workflowStore.initializeFromProject({
    hasArchitecture: normalizedHasArchitecture,
    hasBlueprint: normalizedHasBlueprint,
    hasDraft,
    hasFinalize,
    totalChapters: resolvedTotalChapters,
    currentChapter,
    chapterStatuses,
  });
  return updated;
};

const queueSaveState = () => {
  if (!stateLoaded.value) {
    return;
  }
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  const workflow = buildWorkflowSnapshot();
  workflowSnapshot.value = workflow;
  const payload: ProjectState = {
    form: { ...form },
    activeFile: projectStore.activeFile
      ? {
          path: projectStore.activeFile.path,
          kind: projectStore.activeFile.kind,
          chapterNumber: projectStore.activeFile.chapterNumber,
        }
      : undefined,
    workflow,
    batchTask: batchRunning.value && batchTaskId.value
      ? {
          taskId: batchTaskId.value,
          start: batchConfig.value.start,
          end: batchConfig.value.end,
          delaySeconds: batchConfig.value.delaySeconds,
        }
      : undefined,
  };
  saveLocalState(projectId, payload);
  saveTimer = setTimeout(async () => {
    try {
      await updateProjectState(projectId, payload);
    } catch (error) {
      console.warn("Failed to save project state.", error);
    }
  }, 500);
};

const startBatchRefresh = () => {
  if (batchRefreshTimer) {
    clearInterval(batchRefreshTimer);
  }
  batchRefreshTimer = window.setInterval(async () => {
    if (!batchRunning.value || batchRefreshPending) {
      return;
    }
    batchRefreshPending = true;
    try {
      await projectStore.refreshFileTree();
    } finally {
      batchRefreshPending = false;
    }
  }, 2000);
};

const stopBatchRefresh = () => {
  if (batchRefreshTimer) {
    clearInterval(batchRefreshTimer);
    batchRefreshTimer = null;
  }
};

const loadProjectState = async () => {
  stateLoaded.value = false;
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    stateLoaded.value = true;
    return;
  }
  const localState = loadLocalState(projectId);
  let remoteState: ProjectState | null = null;
  try {
    remoteState = await getProjectState(projectId);
  } catch (error) {
    console.warn("Failed to load project state.", error);
  }
  const state = mergeProjectState(remoteState, localState);
  workflowSnapshot.value = normalizeWorkflowSnapshot(state.workflow);
  // Restore batch task state
  if (state.batchTask?.taskId) {
    const existingTask = taskStore.tasks.find((t) => t.id === state.batchTask!.taskId);
    if (existingTask && (existingTask.status === "pending" || existingTask.status === "running")) {
      batchTaskId.value = state.batchTask.taskId;
      batchConfig.value = {
        start: state.batchTask.start,
        end: state.batchTask.end,
        delaySeconds: state.batchTask.delaySeconds,
      };
      batchProgress.value = {
        current: 0,
        total: Math.max(0, state.batchTask.end - state.batchTask.start + 1),
      };
      batchRunning.value = true;
      taskActionMap.set(state.batchTask.taskId, "batch");
      parseBatchProgress(existingTask.logs);
    }
  }
  applyFormState(state.form);
  const activeFile = normalizeActiveFile(state.activeFile);
  if (activeFile) {
    await projectStore.openFile(activeFile);
  }
  if (!projectStore.activeFile) {
    const fallback = resolveFallbackFile();
    if (fallback) {
      await projectStore.openFile(fallback);
    }
  }
  const workflowUpdated = await syncWorkflowFromProject({ checkVectorstore: true });
  stateLoaded.value = true;
  if (workflowUpdated) {
    queueSaveState();
  }

  // 设置章节号为当前定稿章节+1
  const lastFinalized = workflowStore.lastFinalizedChapter();
  if (lastFinalized > 0 && (!state.form?.chapterNumber || Number(state.form.chapterNumber) <= lastFinalized)) {
    form.chapterNumber = String(lastFinalized + 1);
  }
};

const handleSaveActiveFile = async () => {
  await projectStore.saveActiveFile();
  const activeFile = projectStore.activeFile;
  if (
    activeFile?.kind === "chapter" ||
    activeFile?.path === "architecture" ||
    activeFile?.path === "directory"
  ) {
    await syncWorkflowFromProject();
  }
};

const goProjects = () => {
  router.push("/");
};

const goSettings = () => {
  router.push("/settings");
};

const handleFormUpdate = (nextForm: WorkbenchForm) => {
  const prevCharacters = form.charactersInvolved;
  const prevScene = form.sceneLocation;
  Object.assign(form, nextForm);
  if (
    !autoFillLock.value &&
    (nextForm.charactersInvolved !== prevCharacters ||
      nextForm.sceneLocation !== prevScene)
  ) {
    markAsOverridden();
  }
};

const clearChapterFields = () => {
  form.charactersInvolved = "";
  form.keyItems = "";
  form.sceneLocation = "";
  form.timeConstraint = "";
};

const advanceChapter = (clearFields: boolean) => {
  const advanced = workflowStore.incrementChapter();
  if (!advanced) {
    toastStore.info("章节已全部完成。");
    return false;
  }
  form.chapterNumber = String(workflowStore.currentChapter);
  if (clearFields) {
    clearChapterFields();
  }
  return true;
};

const handleNextChapter = () => {
  advanceChapter(true);
};

const batchDefaults = computed(() => {
  const start = chapterNumberValue.value > 0 ? chapterNumberValue.value : 1;
  const userEnd = Number(form.batchEndChapter);
  const total = Number(form.numberOfChapters);
  const end = Number.isFinite(userEnd) && userEnd >= start
    ? Math.min(userEnd, Number.isFinite(total) ? total : userEnd)
    : (Number.isFinite(total) && total >= start ? total : start);
  return { start, end };
});

const batchProgressText = computed(() => {
  if (!batchRunning.value) {
    return "准备生成...";
  }
  if (batchCancelRequested.value) {
    return "正在取消批量生成...";
  }
  const total = batchProgress.value.total;
  if (!total || batchProgress.value.current === 0) {
    return "准备生成...";
  }
  return `正在生成第 ${batchProgress.value.current}/${total} 章`;
});

const batchProgressPercent = computed(() => {
  const total = batchProgress.value.total;
  if (!total) {
    return 0;
  }
  return Math.min(100, Math.round((batchProgress.value.current / total) * 100));
});

const parseBatchProgress = (logs: string[]) => {
  const pattern = /(Drafting|Enriching) chapter (\d+)/i;
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = pattern.exec(logs[i]);
    if (match) {
      const chapterNumber = Number(match[2]);
      if (!Number.isNaN(chapterNumber)) {
        const current = chapterNumber - batchConfig.value.start + 1;
        batchProgress.value.current = Math.max(1, current);
      }
      break;
    }
  }
  if (logs.some((line) => /batch completed/i.test(line))) {
    batchProgress.value.current = batchProgress.value.total;
  }
};

const batchTask = computed(() =>
  batchTaskId.value ? taskStore.tasks.find((task) => task.id === batchTaskId.value) ?? null : null
);

const buildBatchSummary = (task: { result?: Record<string, unknown> | null }) => {
  const payload = task.result as { chapters?: Array<{ chapter?: number; length?: number }> } | null;
  const chapters = payload?.chapters;
  if (Array.isArray(chapters) && chapters.length) {
    const total = chapters.length;
    const avgLength = Math.round(
      chapters.reduce((sum, item) => sum + (item.length ?? 0), 0) / total
    );
    return `批量生成完成：${total} 章，平均字数 ${avgLength}。`;
  }
  return "批量生成完成。";
};

const runTask = async (
  label: string,
  apiCall: () => Promise<{ task_id: string }>,
  actionKey?: string
) => {
  try {
    const payload = await apiCall();
    taskStore.registerTask(payload.task_id, label);
    if (actionKey) {
      taskActionMap.set(payload.task_id, actionKey);
    }
    return payload.task_id;
  } catch (error) {
    projectStore.error = error instanceof Error ? error.message : "任务执行失败";
    return null;
  }
};

const startBatchDirect = () => {
  const defaults = batchDefaults.value;
  startBatch({ start: defaults.start, end: defaults.end, delaySeconds: batchConfig.value.delaySeconds });
};

const startBatch = async (payload: { start: number; end: number; delaySeconds: number }) => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }

  // 如果当前章节有未定稿的草稿，先自动定稿
  if (workflowStore.hasPendingDraft) {
    toastStore.info("当前章节有未定稿草稿，正在自动定稿...");
    const finalizeTaskId = await runTask(
      "自动定稿",
      () =>
        finalizeChapter(projectId, {
          novel_number: workflowStore.currentChapter,
          word_number: Number(form.wordNumber),
          llm_config_name: configStore.chooseConfigs.finalize_llm || form.llmConfigName || undefined,
          embedding_config_name: form.embeddingConfigName || configStore.chooseConfigs.embedding || undefined,
        }),
      "finalize"
    );
    if (finalizeTaskId) {
      // 等待定稿完成后再继续批量生成
      const checkInterval = setInterval(() => {
        const task = taskStore.tasks.find(t => t.id === finalizeTaskId);
        if (task && (task.status === "success" || task.status === "failed")) {
          clearInterval(checkInterval);
          if (task.status === "success") {
            workflowStore.finalizeChapter();
            queueSaveState();
            // 定稿成功后继续批量生成
            executeBatchGeneration(projectId, payload);
          } else {
            toastStore.error("自动定稿失败，已取消批量生成");
            batchRunning.value = false;
          }
        }
      }, 500);
    }
    return;
  }

  // 直接执行批量生成
  executeBatchGeneration(projectId, payload);
};

const executeBatchGeneration = async (projectId: string, payload: { start: number; end: number; delaySeconds: number }) => {
  const choose = configStore.chooseConfigs;
  const resolveLlm = (fallback?: string) => form.llmConfigName || fallback || undefined;
  const resolveEmbedding = () => form.embeddingConfigName || choose.embedding || undefined;
  batchSummary.value = "";
  batchError.value = "";
  batchRunning.value = true;
  batchCancelRequested.value = false;
  batchConfig.value = payload;
  batchProgress.value = {
    current: 0,
    total: Math.max(0, payload.end - payload.start + 1),
  };
  const taskId = await runTask(
    "批量生成",
    () =>
      generateBatch(projectId, {
        start_chapter: payload.start,
        end_chapter: payload.end,
        delay_seconds: payload.delaySeconds,
        word_number: Number(form.wordNumber),
        characters_involved: form.charactersInvolved,
        key_items: form.keyItems,
        scene_location: form.sceneLocation,
        time_constraint: form.timeConstraint,
        user_guidance: form.userGuidance,
        llm_config_name: resolveLlm(choose.prompt_draft_llm),
        embedding_config_name: resolveEmbedding(),
      }),
    "batch"
  );
  if (!taskId) {
    batchRunning.value = false;
    return;
  }
  batchTaskId.value = taskId;
  queueSaveState();
};

const cancelBatch = async () => {
  if (!batchTaskId.value || batchCancelRequested.value) {
    return;
  }
  batchCancelRequested.value = true;
  try {
    await cancelTask(batchTaskId.value);
  } catch (error) {
    batchCancelRequested.value = false;
    batchError.value = error instanceof Error ? error.message : "取消失败";
  }
};

const runAction = async (action: string) => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }
  const choose = configStore.chooseConfigs;
  const resolveLlm = (fallback?: string) => form.llmConfigName || fallback || undefined;
  const resolveEmbedding = () => form.embeddingConfigName || choose.embedding || undefined;
  const payloadBase = {
    novel_number: Number(form.chapterNumber),
    word_number: Number(form.wordNumber),
    characters_involved: form.charactersInvolved,
    key_items: form.keyItems,
    scene_location: form.sceneLocation,
    time_constraint: form.timeConstraint,
    user_guidance: form.userGuidance,
    llm_config_name: resolveLlm(choose.prompt_draft_llm),
    embedding_config_name: resolveEmbedding(),
  };

  switch (action) {
    case "architecture":
      await runTask(
        "生成架构",
        () =>
          generateArchitecture(projectId, {
            topic: form.topic,
            genre: form.genre,
            number_of_chapters: Number(form.numberOfChapters),
            word_number: Number(form.wordNumber),
            user_guidance: form.userGuidance,
            llm_config_name: resolveLlm(choose.architecture_llm),
          }),
        "architecture"
      );
      break;
    case "blueprint":
      await runTask(
        "生成章节蓝图",
        () =>
          generateBlueprint(projectId, {
            number_of_chapters: Number(form.numberOfChapters),
            user_guidance: form.userGuidance,
            llm_config_name: resolveLlm(choose.chapter_outline_llm),
          }),
        "blueprint"
      );
      break;
    case "preview-prompt": {
      const taskId = await runTask(
        "预览提示词",
        () => buildPrompt(projectId, payloadBase),
        "preview-prompt"
      );
      if (taskId) {
        pendingPromptTask.value = taskId;
      }
      break;
    }
    case "batch":
      startBatchDirect();
      break;
    case "draft":
      await runTask("生成草稿", () => generateDraft(projectId, payloadBase), "draft");
      break;
    case "finalize":
      await runTask(
        "章节定稿",
        () =>
          finalizeChapter(projectId, {
            novel_number: Number(form.chapterNumber),
            word_number: Number(form.wordNumber),
            llm_config_name: resolveLlm(choose.finalize_llm),
            embedding_config_name: resolveEmbedding(),
          }),
        "finalize"
      );
      break;
    case "consistency":
      await runTask(
        "一致性检查",
        () =>
          consistencyCheck(projectId, {
            novel_setting: "",
            character_state: "",
            global_summary: "",
            chapter_text: projectStore.editorContent,
            llm_config_name: resolveLlm(choose.consistency_llm),
          }),
        "consistency"
      );
      break;
    default:
      break;
  }
};

const usePrompt = async (value: string) => {
  promptModalOpen.value = false;
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }
  const choose = configStore.chooseConfigs;
  const resolveLlm = (fallback?: string) => form.llmConfigName || fallback || undefined;
  const resolveEmbedding = () => form.embeddingConfigName || choose.embedding || undefined;
  await runTask(
    "生成草稿",
    () =>
      generateDraft(projectId, {
        novel_number: Number(form.chapterNumber),
        word_number: Number(form.wordNumber),
        characters_involved: form.charactersInvolved,
        key_items: form.keyItems,
        scene_location: form.sceneLocation,
        time_constraint: form.timeConstraint,
        user_guidance: form.userGuidance,
        llm_config_name: resolveLlm(choose.prompt_draft_llm),
        embedding_config_name: resolveEmbedding(),
        custom_prompt_text: value,
      }),
    "draft"
  );
};

const handleKnowledgeImport = async (file: File) => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  await runTask("导入知识库", () => importKnowledge(projectId, formData));
};

const handleVectorstoreManage = () => {
  vectorstoreModalOpen.value = true;
};

const handleVectorstoreCleared = () => {
  // 标记所有已定稿的章节需要重新定稿
  workflowStore.markAllChaptersDeletedFromVectorstore();
  queueSaveState();
  toastStore.success("向量库已清空");
};

const handleVectorstoreDeletedChapter = (chapter: number) => {
  // 标记该章节需要重新定稿
  workflowStore.markChapterDeletedFromVectorstore(chapter);
  toastStore.warning(`第 ${chapter} 章的向量记录已删除，需要重新定稿`);
  queueSaveState();
};

const parseChapterNumber = (name: string): number | null => {
  const numeric = Number(name);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }
  const match = /^chapter_(\d+)\.txt$/i.exec(name.trim());
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const handleFileDelete = async (node: FileNode) => {
  if (typeof node.chapterNumber !== "number") {
    toastStore.warning("仅支持删除章节文件。");
    return;
  }
  const ok = window.confirm(`确定要删除第 ${node.chapterNumber} 章吗？该操作无法撤销。`);
  if (!ok) {
    return;
  }
  try {
    await projectStore.deleteChapterFile(node.chapterNumber);
    if (workflowStore.chapterStatuses[node.chapterNumber]) {
      const nextStatuses = { ...workflowStore.chapterStatuses };
      delete nextStatuses[node.chapterNumber];
      workflowStore.chapterStatuses = nextStatuses;
      queueSaveState();
    }
    toastStore.success(`已删除第 ${node.chapterNumber} 章`);
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : "删除章节失败");
  }
};

const handleFileRename = async (payload: { node: FileNode; name: string }) => {
  const { node, name } = payload;
  if (typeof node.chapterNumber !== "number") {
    toastStore.warning("仅支持重命名章节文件。");
    return;
  }
  const nextNumber = parseChapterNumber(name);
  if (!nextNumber) {
    toastStore.warning("章节命名需为数字或 chapter_数字.txt 格式。");
    return;
  }
  if (nextNumber === node.chapterNumber) {
    return;
  }
  try {
    await projectStore.renameChapterFile(node.chapterNumber, nextNumber);
    if (projectStore.activeFile?.chapterNumber === node.chapterNumber) {
      await projectStore.openFile({
        path: `chapter:${nextNumber}`,
        name: localizePath(`chapter:${nextNumber}`),
        kind: "chapter",
        chapterNumber: nextNumber,
      });
    }
    const currentStatuses = workflowStore.chapterStatuses[node.chapterNumber];
    if (currentStatuses) {
      const nextStatuses = { ...workflowStore.chapterStatuses };
      delete nextStatuses[node.chapterNumber];
      nextStatuses[nextNumber] = currentStatuses;
      workflowStore.chapterStatuses = nextStatuses;
      queueSaveState();
    }
    toastStore.success(`章节已重命名为第 ${nextNumber} 章`);
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : "重命名章节失败");
  }
};

watch(
  () => taskStore.tasks,
  async () => {
    for (const task of taskStore.tasks) {
      if (
        (task.status === "success" || task.status === "failed") &&
        !handledTasks.value.has(task.id)
      ) {
        handledTasks.value.add(task.id);
        const action = taskActionMap.get(task.id);
        if (task.status === "success") {
          await projectStore.refreshFileTree();
          const outputFile = task.outputFiles?.[0];
          if (
            outputFile &&
            (!projectStore.activeFile || !projectStore.editorContent.trim())
          ) {
            await openOutputFile(outputFile);
          }
        }
        const currentChapter = workflowStore.currentChapter;
        if (task.status === "success") {
          // 只处理在 WORKFLOW_STEPS 中的步骤
          if (action === "architecture" || action === "blueprint" || action === "draft") {
            workflowStore.completeStep(action);
            // 草稿生成完成
            if (action === "draft") {
              // 草稿状态已在 completeStep 中设置
              queueSaveState();
            }
          }
          // 定稿完成 - 不再是 workflow step，单独处理
          if (action === "finalize") {
            workflowStore.finalizeChapter();
            queueSaveState();
          }
          if (action === "blueprint") {
            await loadBlueprintContent();
          }
          // 定稿完成后切换章节
          if (action === "finalize") {
            advanceChapter(false);
          }
          // 批量生成完成后切换章节到最后一章+1
          if (action === "batch") {
            batchRunning.value = false;
            batchCancelRequested.value = false;
            batchProgress.value.current = batchProgress.value.total;
            batchSummary.value = buildBatchSummary(task);
            // 切换到批量生成的最后一章的下一章
            const batchEnd = batchConfig.value?.end ?? 0;
            if (batchEnd > 0) {
              workflowStore.setCurrentChapter(batchEnd + 1);
              form.chapterNumber = String(workflowStore.currentChapter);
              clearChapterFields();
            }
            await syncWorkflowFromProject({ checkVectorstore: true });
            queueSaveState();
          }
          const stepToastMap: Record<string, string> = {
            architecture: "架构已完成，下一步生成章节蓝图。",
            blueprint: "蓝图已完成，下一步生成章节草稿。",
            draft: "章节草稿已生成，请确认内容后点击「确认定稿」。",
            finalize: "章节已定稿，可以继续生成下一章。",
          };
          if (action && stepToastMap[action]) {
            toastStore.success(stepToastMap[action]);
          } else {
            toastStore.success(`${task.label}完成`);
          }
        } else {
          const message = task.error ? `${task.label}失败：${task.error}` : `${task.label}失败`;
          if (action === "batch") {
            await projectStore.refreshFileTree();
            batchRunning.value = false;
            batchCancelRequested.value = false;
            if (task.error && task.error.includes("取消")) {
              batchSummary.value = "批量生成已取消。";
              batchError.value = "";
            } else {
              batchError.value = task.error ?? "批量生成失败。";
            }
            queueSaveState();
          }
          toastStore.error(message);
        }
        if (action) {
          taskActionMap.delete(task.id);
        }
      }
    }
    if (!pendingPromptTask.value) {
      return;
    }
    const task = taskStore.tasks.find((item) => item.id === pendingPromptTask.value);
    if (!task || task.status !== "success") {
      if (task?.status === "failed") {
        pendingPromptTask.value = null;
      }
      return;
    }
    const prompt = task.result?.prompt_text;
    if (typeof prompt === "string") {
      promptText.value = prompt;
      promptModalOpen.value = true;
    }
    pendingPromptTask.value = null;
  },
  { deep: true }
);

watch(
  () => batchTask.value?.logs,
  async (logs, oldLogs) => {
    if (!logs) {
      return;
    }
    parseBatchProgress(logs);
    // Detect chapter completion, refresh file tree and open chapter
    const oldLen = oldLogs?.length ?? 0;
    for (let i = oldLen; i < logs.length; i++) {
      const match = /\[CHAPTER_DONE\]\s*(\d+)/.exec(logs[i]);
      if (match) {
        const chapterNum = Number(match[1]);
        await projectStore.refreshFileTree();
        await openOutputFile(`chapter:${chapterNum}`);
      }
    }
  },
  { deep: true }
);

watch(
  () => batchRunning.value,
  (running) => {
    if (running) {
      startBatchRefresh();
    } else {
      stopBatchRefresh();
    }
  }
);

watch(form, () => queueSaveState(), { deep: true });

watch(
  () => projectStore.activeFile,
  () => queueSaveState()
);

watch(
  () => workflowStore.chapterStatuses,
  () => {
    workflowSnapshot.value = buildWorkflowSnapshot();
  },
  { deep: true }
);

onBeforeUnmount(() => stopBatchRefresh());

watch(
  () => form.numberOfChapters,
  (value) => {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      workflowStore.setTotalChapters(parsed);
      // 如果批量结束章节大于新的总章节数，则自动调整
      const currentEnd = Number(form.batchEndChapter);
      if (Number.isNaN(currentEnd) || currentEnd > parsed) {
        form.batchEndChapter = String(parsed);
      }
    }
  },
  { immediate: true }
);

watch(
  () => form.chapterNumber,
  (value) => {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      workflowStore.setCurrentChapter(parsed);
    }
  },
  { immediate: true }
);

watch(
  () => projectStore.currentProject,
  (project) => {
    if (!project) {
      return;
    }
    if (project.topic) {
      form.topic = project.topic;
    }
    form.genre = project.genre ?? form.genre;
    if (project.num_chapters) {
      form.numberOfChapters = String(project.num_chapters);
    }
    if (project.word_number) {
      form.wordNumber = String(project.word_number);
    }
    loadBlueprintContent();
  },
  { immediate: true }
);

watch(
  () => projectStore.error,
  (error) => {
    if (error) {
      toastStore.error(error);
      projectStore.error = null;
    }
  }
);

onMounted(async () => {
  await Promise.all([
    projectStore.loadProject(String(route.params.id)),
    configStore.fetchConfigs(),
  ]);
  await loadProjectState();
  await loadBlueprintContent();
});
</script>

<style scoped>
.workbench-view {
  min-height: 100vh;
}
</style>

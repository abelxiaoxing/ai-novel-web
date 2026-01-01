<template>
  <div class="workbench-view">
    <div class="app-grid">
      <TopBar
        :project-name="projectStore.currentProject?.name"
        :status-label="statusLabel"
        :status-variant="statusVariant"
        @projects="goProjects"
        @save="projectStore.saveActiveFile()"
        @settings="goSettings"
      />

      <ActivityBar :active-key="activeTool" @select="handleToolSelect" />

      <aside v-if="activeTool === 'workspace'" class="sidebar panel">
        <div class="panel-header">
          <div class="panel-title">工作区</div>
          <span class="muted">概览</span>
        </div>
        <div class="sidebar-body">
          <div class="section panel-section">
            <div class="panel-kv">
              <span class="panel-label">项目名称</span>
              <span class="panel-value">{{ projectStore.currentProject?.name || "未载入" }}</span>
            </div>
            <div class="panel-kv">
              <span class="panel-label">题材类型</span>
              <span class="panel-value">{{ projectStore.currentProject?.genre || "未设置" }}</span>
            </div>
            <div class="panel-kv">
              <span class="panel-label">目标章节</span>
              <span class="panel-value">{{ projectStore.currentProject?.num_chapters ?? "未设置" }}</span>
            </div>
            <div class="panel-kv">
              <span class="panel-label">目标字数</span>
              <span class="panel-value">{{ projectStore.currentProject?.word_number ?? "未设置" }}</span>
            </div>
            <div class="panel-kv">
              <span class="panel-label">文件数量</span>
              <span class="panel-value">{{ fileCount }}</span>
            </div>
            <div class="panel-kv">
              <span class="panel-label">已生成章节</span>
              <span class="panel-value">{{ chapterCount }}</span>
            </div>
            <div class="panel-actions">
              <button class="btn btn-ghost" @click="projectStore.refreshFileTree()">刷新文件</button>
              <button class="btn btn-outline" @click="goProjects">项目列表</button>
            </div>
          </div>
        </div>
      </aside>

      <Sidebar
        v-else-if="activeTool === 'files'"
        class="sidebar"
        :nodes="projectStore.fileTree"
        :active-path="projectStore.activeFile?.path"
        @open="projectStore.openFile"
      />

      <aside v-else-if="activeTool === 'roles'" class="sidebar panel">
        <div class="panel-header">
          <div class="panel-title">角色库</div>
          <span class="muted">说明</span>
        </div>
        <div class="sidebar-body">
          <div class="section panel-section">
            <p class="panel-note">
              角色库管理尚未接入 Web API。你可以先在草稿生成时手动填写核心人物，或通过桌面端维护角色库。
            </p>
            <div class="panel-actions">
              <button class="btn btn-ghost" @click="activeTool = 'files'">查看文件</button>
              <button class="btn btn-outline" @click="goSettings">设置模型</button>
            </div>
          </div>
        </div>
      </aside>

      <EditorPane
        :title="editorTitle"
        :subtitle="editorSubtitle"
        :content="projectStore.editorContent"
        @update:content="projectStore.setEditorContent"
        @save="projectStore.saveActiveFile()"
      />

      <RightPanel
        :form="form"
        :llm-options="configStore.llmConfigs.length ? configStore.llmConfigs : ['默认']"
        :embedding-options="configStore.embeddingConfigs.length ? configStore.embeddingConfigs : ['默认']"
        @update:form="Object.assign(form, $event)"
        @run="runAction"
        @import-knowledge="handleKnowledgeImport"
        @clear-vectorstore="handleVectorStoreClear"
      />

      <BottomPanel
        :tasks="taskStore.tasks"
        :active-task="taskStore.activeTask"
        :active-task-id="taskStore.activeTaskId"
        @select="taskStore.activeTaskId = $event"
        @open-file="openOutputFile"
      />
    </div>

    <PromptModal
      v-if="promptModalOpen"
      :content="promptText"
      @close="promptModalOpen = false"
      @confirm="usePrompt"
    />

    <div v-if="projectStore.error" class="error-banner">
      {{ projectStore.error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ActivityBar from "@/components/ActivityBar.vue";
import BottomPanel from "@/components/BottomPanel.vue";
import EditorPane from "@/components/EditorPane.vue";
import PromptModal from "@/components/PromptModal.vue";
import RightPanel, { type WorkbenchForm } from "@/components/RightPanel.vue";
import Sidebar from "@/components/Sidebar.vue";
import TopBar from "@/components/TopBar.vue";
import type { ProjectState, WorkbenchFormState } from "@/api/types";
import { getProjectState, updateProjectState } from "@/api/projects";
import { useConfigStore } from "@/stores/config";
import { useProjectStore, type ActiveFile, type FileNode } from "@/stores/project";
import { useTaskStore } from "@/stores/task";
import {
  buildPrompt,
  consistencyCheck,
  clearVectorStore,
  finalizeChapter,
  generateArchitecture,
  generateBlueprint,
  generateDraft,
  importKnowledge,
} from "@/api/tasks";

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const taskStore = useTaskStore();
const configStore = useConfigStore();

const activeTool = ref("files");
const promptModalOpen = ref(false);
const promptText = ref("");
const pendingPromptTask = ref<string | null>(null);
const handledTasks = ref(new Set<string>());
const stateLoaded = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
});

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
  return {
    ...safeLocal,
    ...safeRemote,
    form: { ...safeLocal.form, ...safeRemote.form },
    activeFile: safeRemote.activeFile ?? safeLocal.activeFile,
  };
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
const editorSubtitle = computed(() =>
  projectStore.activeFile ? localizePath(projectStore.activeFile.path) : "打开项目文件进行编辑"
);

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
  if (activeTool.value !== "files") {
    activeTool.value = "files";
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
  const payload: ProjectState = {
    form: { ...form },
    activeFile: projectStore.activeFile
      ? {
          path: projectStore.activeFile.path,
          kind: projectStore.activeFile.kind,
          chapterNumber: projectStore.activeFile.chapterNumber,
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
  try {
    applyFormState(state.form);
    const activeFile = normalizeActiveFile(state.activeFile);
    if (activeFile) {
      await projectStore.openFile(activeFile);
    }
  } finally {
    stateLoaded.value = true;
  }
  if (!projectStore.activeFile) {
    const fallback = resolveFallbackFile();
    if (fallback) {
      await projectStore.openFile(fallback);
    }
  }
};

const goProjects = () => {
  router.push("/");
};

const goSettings = () => {
  router.push("/settings");
};

const handleToolSelect = (tool: string) => {
  if (tool === "settings") {
    goSettings();
    return;
  }
  activeTool.value = tool;
};

const runTask = async (label: string, apiCall: () => Promise<{ task_id: string }>) => {
  try {
    const payload = await apiCall();
    taskStore.registerTask(payload.task_id, label);
    return payload.task_id;
  } catch (error) {
    projectStore.error = error instanceof Error ? error.message : "任务执行失败";
    return null;
  }
};

const runAction = async (action: string) => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }
  const payloadBase = {
    novel_number: Number(form.chapterNumber),
    word_number: Number(form.wordNumber),
    characters_involved: form.charactersInvolved,
    key_items: form.keyItems,
    scene_location: form.sceneLocation,
    time_constraint: form.timeConstraint,
    user_guidance: form.userGuidance,
    llm_config_name: form.llmConfigName || undefined,
    embedding_config_name: form.embeddingConfigName || undefined,
  };

  switch (action) {
    case "architecture":
      await runTask("生成架构", () =>
        generateArchitecture(projectId, {
          topic: form.topic,
          genre: form.genre,
          number_of_chapters: Number(form.numberOfChapters),
          word_number: Number(form.wordNumber),
          user_guidance: form.userGuidance,
          llm_config_name: form.llmConfigName || undefined,
        })
      );
      break;
    case "blueprint":
      await runTask("生成目录", () =>
        generateBlueprint(projectId, {
          number_of_chapters: Number(form.numberOfChapters),
          user_guidance: form.userGuidance,
          llm_config_name: form.llmConfigName || undefined,
        })
      );
      break;
    case "build-prompt": {
      const taskId = await runTask("构建提示词", () => buildPrompt(projectId, payloadBase));
      if (taskId) {
        pendingPromptTask.value = taskId;
      }
      break;
    }
    case "draft":
      await runTask("生成草稿", () => generateDraft(projectId, payloadBase));
      break;
    case "finalize":
      await runTask("章节定稿", () =>
        finalizeChapter(projectId, {
          novel_number: Number(form.chapterNumber),
          word_number: Number(form.wordNumber),
          llm_config_name: form.llmConfigName || undefined,
          embedding_config_name: form.embeddingConfigName || undefined,
        })
      );
      break;
    case "consistency":
      await runTask("一致性检查", () =>
        consistencyCheck(projectId, {
          novel_setting: "",
          character_state: "",
          global_summary: "",
          chapter_text: projectStore.editorContent,
          llm_config_name: form.llmConfigName || undefined,
        })
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
  await runTask("生成草稿", () =>
    generateDraft(projectId, {
      novel_number: Number(form.chapterNumber),
      word_number: Number(form.wordNumber),
      characters_involved: form.charactersInvolved,
      key_items: form.keyItems,
      scene_location: form.sceneLocation,
      time_constraint: form.timeConstraint,
      user_guidance: form.userGuidance,
      llm_config_name: form.llmConfigName || undefined,
      embedding_config_name: form.embeddingConfigName || undefined,
      custom_prompt_text: value,
    })
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

const handleVectorStoreClear = async () => {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    return;
  }
  await runTask("清空向量库", () => clearVectorStore(projectId));
};

watch(
  () => taskStore.tasks,
  async () => {
    for (const task of taskStore.tasks) {
      if (task.status === "success" && !handledTasks.value.has(task.id)) {
        handledTasks.value.add(task.id);
        await projectStore.refreshFileTree();
        const outputFile = task.outputFiles?.[0];
        if (outputFile && (!projectStore.activeFile || !projectStore.editorContent.trim())) {
          await openOutputFile(outputFile);
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

watch(form, () => queueSaveState(), { deep: true });

watch(
  () => projectStore.activeFile,
  () => queueSaveState()
);

watch(
  () => projectStore.currentProject,
  (project) => {
    if (!project) {
      return;
    }
    form.genre = project.genre ?? form.genre;
    if (project.num_chapters) {
      form.numberOfChapters = String(project.num_chapters);
    }
    if (project.word_number) {
      form.wordNumber = String(project.word_number);
    }
  },
  { immediate: true }
);

watch(
  () => configStore.llmConfigs,
  (values) => {
    if (!form.llmConfigName && values.length) {
      form.llmConfigName = values[0];
    }
  }
);

watch(
  () => configStore.embeddingConfigs,
  (values) => {
    if (!form.embeddingConfigName && values.length) {
      form.embeddingConfigName = values[0];
    }
  }
);

onMounted(async () => {
  await Promise.all([
    projectStore.loadProject(String(route.params.id)),
    configStore.fetchConfigs(),
  ]);
  await loadProjectState();
});
</script>

<style scoped>
.workbench-view {
  min-height: 100vh;
}

.error-banner {
  position: fixed;
  bottom: 24px;
  left: 24px;
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.4);
  padding: 12px 16px;
  border-radius: 12px;
}

.sidebar {
  grid-column: 2 / 3;
  grid-row: 2 / 4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-body {
  flex: 1;
  overflow: hidden;
}

.panel-section {
  gap: 14px;
}

.panel-kv {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.panel-value {
  font-size: 14px;
  color: var(--text);
}

.panel-note {
  margin: 0;
  line-height: 1.5;
  color: var(--text-muted);
}

.panel-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>

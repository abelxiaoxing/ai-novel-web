import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import WorkbenchView from "./WorkbenchView.vue";
import { useProjectStore } from "@/stores/project";
import { useConfigStore } from "@/stores/config";
import { useTaskStore } from "@/stores/task";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "p1" } }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/api/tasks", () => ({
  buildPrompt: vi.fn().mockResolvedValue({ task_id: "task-prompt" }),
  cancelTask: vi.fn().mockResolvedValue(undefined),
  consistencyCheck: vi.fn().mockResolvedValue({ task_id: "task-c" }),
  clearVectorStore: vi.fn().mockResolvedValue({ task_id: "task-clear" }),
  finalizeChapter: vi.fn().mockResolvedValue({ task_id: "task-f" }),
  generateArchitecture: vi.fn().mockResolvedValue({ task_id: "task-a" }),
  generateBlueprint: vi.fn().mockResolvedValue({ task_id: "task-b" }),
  generateBatch: vi.fn().mockResolvedValue({ task_id: "task-batch" }),
  generateDraft: vi.fn().mockResolvedValue({ task_id: "task-draft" }),
  getVectorstoreSummary: vi.fn().mockResolvedValue({ total_count: 0, groups: [] }),
  importKnowledge: vi.fn().mockResolvedValue({ task_id: "task-i" }),
}));

vi.mock("@/api/projects", () => ({
  downloadProjectExport: vi.fn().mockResolvedValue({
    filename: "test.txt",
    blob: new Blob(["test"], { type: "text/plain" }),
  }),
  getProjectState: vi.fn().mockResolvedValue({}),
  updateProjectState: vi.fn().mockResolvedValue(undefined),
  getProjectFile: vi.fn().mockResolvedValue({ content: "" }),
}));

describe("WorkbenchView task log flow", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const projectStore = useProjectStore();
    projectStore.currentProject = { id: "p1", name: "Test Project" };
    projectStore.loadProject = vi.fn().mockResolvedValue(undefined);
    projectStore.refreshFileTree = vi.fn().mockResolvedValue(undefined);

    const configStore = useConfigStore();
    configStore.chooseConfigs = { prompt_draft_llm: "default-llm", embedding: "default-emb" };
    configStore.fetchConfigs = vi.fn().mockResolvedValue(undefined);

    const taskStore = useTaskStore();
    taskStore.tasks = [
      {
        id: "task-1",
        label: "章节生成",
        status: "running",
        logs: ["line-1", "line-2"],
        outputFiles: [],
      },
    ] as any;
    taskStore.activeTaskId = "task-1";
  });

  it("opens readonly task log in editor when selecting task from sidebar", async () => {
    const wrapper = mount(WorkbenchView, {
      global: {
        stubs: {
          ActivityBar: true,
          Sidebar: {
            template: '<button class="select-task" @click="$emit(\'select-task\', \'task-1\')">select-task</button>',
          },
          TopBar: true,
          RightPanel: true,
          GlobalProgressBar: true,
          PromptModal: true,
          VectorstoreModal: true,
        },
      },
    });

    await nextTick();
    await wrapper.find(".select-task").trigger("click");
    await nextTick();

    const textarea = wrapper.find("textarea.editor-textarea");
    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes("readonly")).toBeDefined();
    const value = (textarea.element as HTMLTextAreaElement).value;
    expect(value).toContain("line-1");
    expect(value).toContain("line-2");

    wrapper.unmount();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import WorkbenchView from "./WorkbenchView.vue";
import { useProjectStore } from "@/stores/project";
import { useConfigStore } from "@/stores/config";
import { useTaskStore } from "@/stores/task";
import PromptModal from "@/components/PromptModal.vue";

const mockGenerateDraft = vi.fn().mockResolvedValue({ task_id: "task-draft" });
const mockBuildPrompt = vi.fn().mockResolvedValue({ task_id: "task-prompt" });
const mockGenerateBatch = vi.fn().mockResolvedValue({ task_id: "task-batch" });

const mockUpdateProjectState = vi.fn().mockResolvedValue(undefined);

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "p1" } }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/api/tasks", () => ({
  buildPrompt: (...args: unknown[]) => mockBuildPrompt(...args),
  cancelTask: vi.fn().mockResolvedValue(undefined),
  consistencyCheck: vi.fn().mockResolvedValue({ task_id: "task-c" }),
  clearVectorStore: vi.fn().mockResolvedValue({ task_id: "task-clear" }),
  finalizeChapter: vi.fn().mockResolvedValue({ task_id: "task-f" }),
  generateArchitecture: vi.fn().mockResolvedValue({ task_id: "task-a" }),
  generateBlueprint: vi.fn().mockResolvedValue({ task_id: "task-b" }),
  generateBatch: (...args: unknown[]) => mockGenerateBatch(...args),
  generateDraft: (...args: unknown[]) => mockGenerateDraft(...args),
  importKnowledge: vi.fn().mockResolvedValue({ task_id: "task-i" }),
}));

vi.mock("@/api/projects", () => ({
  getProjectState: vi.fn().mockResolvedValue({}),
  updateProjectState: (...args: unknown[]) => mockUpdateProjectState(...args),
  getProjectFile: vi.fn().mockResolvedValue({ content: "" }),
}));

const mountWorkbench = () => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectStore = useProjectStore();
  projectStore.currentProject = { id: "p1", name: "Test Project" };
  projectStore.loadProject = vi.fn().mockResolvedValue(undefined);
  projectStore.refreshFileTree = vi.fn().mockResolvedValue(undefined);
  projectStore.openFile = vi.fn().mockResolvedValue(undefined);

  const configStore = useConfigStore();
  configStore.chooseConfigs = { prompt_draft_llm: "default-llm", embedding: "default-emb" };
  configStore.fetchConfigs = vi.fn().mockResolvedValue(undefined);

  const wrapper = mount(WorkbenchView, {
    global: {
      plugins: [pinia],
      stubs: {
        ActivityBar: true,
        BottomPanel: true,
        EditorPane: true,
        Sidebar: true,
        TopBar: true,
        RightPanel: true,
      },
    },
  });

  return { wrapper, projectStore, configStore };
};

describe("WorkbenchView Properties", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockGenerateDraft.mockClear();
    mockBuildPrompt.mockClear();
    mockGenerateBatch.mockClear();
    mockUpdateProjectState.mockClear();
  });

  it("uses selected model configs when generating drafts", async () => {
    const { wrapper } = mountWorkbench();
    await nextTick();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        async (llmName, embedName) => {
          mockGenerateDraft.mockClear();
          (wrapper.vm as any).form.llmConfigName = llmName;
          (wrapper.vm as any).form.embeddingConfigName = embedName;
          await nextTick();
          await (wrapper.vm as any).runAction("draft");
          expect(mockGenerateDraft).toHaveBeenCalled();
          const payload = mockGenerateDraft.mock.calls[0][1] as Record<string, unknown>;
          expect(payload.llm_config_name).toBe(llmName);
          expect(payload.embedding_config_name).toBe(embedName);
        }
      ),
      { numRuns: 12 }
    );

    wrapper.unmount();
  });

  it("persists selected model configs to project state", async () => {
    const { wrapper } = mountWorkbench();
    await nextTick();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        async (llmName, embedName) => {
          mockUpdateProjectState.mockClear();
          (wrapper.vm as any).form.llmConfigName = llmName;
          (wrapper.vm as any).form.embeddingConfigName = embedName;
          await nextTick();
          await vi.advanceTimersByTimeAsync(500);
          expect(mockUpdateProjectState).toHaveBeenCalled();
          const payload = mockUpdateProjectState.mock.calls[0][1] as { form?: Record<string, string> };
          expect(payload.form?.llmConfigName).toBe(llmName);
          expect(payload.form?.embeddingConfigName).toBe(embedName);
        }
      ),
      { numRuns: 10 }
    );

    wrapper.unmount();
  });

  it("populates form fields from project metadata", async () => {
    const { wrapper, projectStore } = mountWorkbench();
    await nextTick();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1000, max: 10000 }),
        async (topic, genre, chapters, words) => {
          projectStore.currentProject = {
            id: "p1",
            name: "Test Project",
            topic,
            genre,
            num_chapters: chapters,
            word_number: words,
          };
          await nextTick();
          expect((wrapper.vm as any).form.topic).toBe(topic);
          expect((wrapper.vm as any).form.genre).toBe(genre);
          expect((wrapper.vm as any).form.numberOfChapters).toBe(String(chapters));
          expect((wrapper.vm as any).form.wordNumber).toBe(String(words));
        }
      ),
      { numRuns: 10 }
    );

    wrapper.unmount();
  });

  it("persists core form fields to project state", async () => {
    const { wrapper } = mountWorkbench();
    await nextTick();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1000, max: 10000 }),
        async (topic, genre, chapters, words) => {
          mockUpdateProjectState.mockClear();
          (wrapper.vm as any).form.topic = topic;
          (wrapper.vm as any).form.genre = genre;
          (wrapper.vm as any).form.numberOfChapters = String(chapters);
          (wrapper.vm as any).form.wordNumber = String(words);
          await nextTick();
          await vi.advanceTimersByTimeAsync(500);
          expect(mockUpdateProjectState).toHaveBeenCalled();
          const payload = mockUpdateProjectState.mock.calls[0][1] as { form?: Record<string, string> };
          expect(payload.form?.topic).toBe(topic);
          expect(payload.form?.genre).toBe(genre);
          expect(payload.form?.numberOfChapters).toBe(String(chapters));
          expect(payload.form?.wordNumber).toBe(String(words));
        }
      ),
      { numRuns: 8 }
    );

    wrapper.unmount();
  });

  it("opens the prompt modal only after preview prompt succeeds", async () => {
    const { wrapper } = mountWorkbench();
    const taskStore = useTaskStore();
    await nextTick();

    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 20 }), async (promptText) => {
        taskStore.clearAll();
        (wrapper.vm as any).promptModalOpen = false;
        await (wrapper.vm as any).runAction("draft");
        await nextTick();
        expect(wrapper.findComponent(PromptModal).exists()).toBe(false);

        await (wrapper.vm as any).runAction("preview-prompt");
        const taskId = taskStore.activeTaskId as string;
        taskStore.updateTask(taskId, { status: "success", result: { prompt_text: promptText } });
        await nextTick();
        expect(wrapper.findComponent(PromptModal).exists()).toBe(true);
      }),
      { numRuns: 10 }
    );

    wrapper.unmount();
  });

  it("shows batch progress based on draft logs", async () => {
    const { wrapper } = mountWorkbench();
    const taskStore = useTaskStore();
    await nextTick();

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 6, max: 12 }),
        fc.integer({ min: 1, max: 5 }),
        async (start, end, offset) => {
          const current = Math.min(end, start + offset);
          taskStore.clearAll();
          taskStore.tasks = [
            {
              id: "batch-1",
              label: "批量生成",
              status: "running",
              logs: [],
              outputFiles: [],
              startedAt: Date.now(),
            },
          ] as any;
          (wrapper.vm as any).batchTaskId = "batch-1";
          (wrapper.vm as any).batchRunning = true;
          (wrapper.vm as any).batchConfig = { start, end, delaySeconds: 0 };
          (wrapper.vm as any).batchProgress = {
            current: 0,
            total: end - start + 1,
          };
          taskStore.appendLog("batch-1", `Drafting chapter ${current}...`);
          await nextTick();
          const expected = `${current - start + 1}/${end - start + 1}`;
          expect((wrapper.vm as any).batchProgressText).toContain(expected);
        }
      ),
      { numRuns: 10 }
    );

    wrapper.unmount();
  });
});

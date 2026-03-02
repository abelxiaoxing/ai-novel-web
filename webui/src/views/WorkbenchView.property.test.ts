import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import WorkbenchView from "./WorkbenchView.vue";
import { useProjectStore } from "@/stores/project";
import { useConfigStore } from "@/stores/config";
import { useTaskStore } from "@/stores/task";
import { useWorkflowStore } from "@/stores/workflow";
import PromptModal from "@/components/PromptModal.vue";
import { toPayloadNumber } from "@/composables/workbenchPayloadHelpers";

vi.mock("@/composables/workbenchPayloadHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/composables/workbenchPayloadHelpers")>();
  return {
    ...actual,
    toPayloadNumber: vi.fn(actual.toPayloadNumber),
  };
});

const mockedToPayloadNumber = vi.mocked(toPayloadNumber);

const mockGenerateArchitecture = vi.fn().mockResolvedValue({ task_id: "task-a" });
const mockGenerateBlueprint = vi.fn().mockResolvedValue({ task_id: "task-b" });
const mockGenerateDraft = vi.fn().mockResolvedValue({ task_id: "task-draft" });
const mockBuildPrompt = vi.fn().mockResolvedValue({ task_id: "task-prompt" });
const mockGenerateBatch = vi.fn().mockResolvedValue({ task_id: "task-batch" });
const mockFinalizeChapter = vi.fn().mockResolvedValue({ task_id: "task-f" });
const mockGetTaskStatus = vi.fn().mockResolvedValue({ status: "running", result: null, error: null, output_files: [] });
const mockCancelTask = vi.fn().mockResolvedValue(undefined);

const mockUpdateProjectState = vi.fn().mockResolvedValue(undefined);

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "p1" } }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/api/tasks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/tasks")>();
  return {
    ...actual,
    buildPrompt: (...args: unknown[]) => mockBuildPrompt(...args),
    cancelTask: (...args: unknown[]) => mockCancelTask(...args),
    consistencyCheck: vi.fn().mockResolvedValue({ task_id: "task-c" }),
    finalizeChapter: (...args: unknown[]) => mockFinalizeChapter(...args),
    generateArchitecture: (...args: unknown[]) => mockGenerateArchitecture(...args),
    generateBlueprint: (...args: unknown[]) => mockGenerateBlueprint(...args),
    generateBatch: (...args: unknown[]) => mockGenerateBatch(...args),
    generateDraft: (...args: unknown[]) => mockGenerateDraft(...args),
    getTaskStatus: (...args: unknown[]) => mockGetTaskStatus(...args),
    importKnowledge: vi.fn().mockResolvedValue({ task_id: "task-i" }),
  };
});

vi.mock("@/api/vectorstore", () => ({
  clearVectorStore: vi.fn().mockResolvedValue({ task_id: "task-clear" }),
  deleteVectorstoreChapter: vi.fn().mockResolvedValue({ task_id: "task-delete" }),
  getVectorstoreSummary: vi.fn().mockResolvedValue({ total_count: 0, groups: [] }),
}));

vi.mock("@/api/projects", () => ({
  downloadProjectExport: vi.fn().mockResolvedValue({
    filename: "test.txt",
    blob: new Blob(["test"], { type: "text/plain" }),
  }),
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
        EditorPane: true,
        Sidebar: true,
        TopBar: true,
        RightPanel: true,
      },
    },
  });

  return { wrapper, projectStore, configStore };
};

const waitForWorkbenchReady = async () => {
  await nextTick();
  await flushPromises();
  await nextTick();
};

describe("WorkbenchView Properties", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockGenerateArchitecture.mockClear();
    mockGenerateBlueprint.mockClear();
    mockGenerateDraft.mockClear();
    mockBuildPrompt.mockClear();
    mockGenerateBatch.mockClear();
    mockFinalizeChapter.mockClear();
    mockGetTaskStatus.mockClear();
    mockCancelTask.mockClear();
    mockUpdateProjectState.mockClear();
    mockedToPayloadNumber.mockImplementation((value: number | string, rule?: Parameters<typeof toPayloadNumber>[1]) =>
      Number(value)
    );
  });

  it("uses selected model configs when generating drafts", async () => {
    const { wrapper } = mountWorkbench();
    await waitForWorkbenchReady();

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
    await waitForWorkbenchReady();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        async (llmName, embedName) => {
          mockUpdateProjectState.mockClear();
          (wrapper.vm as any).form.llmConfigName = llmName;
          (wrapper.vm as any).form.embeddingConfigName = embedName;
          await nextTick();
          await flushPromises();
          await vi.advanceTimersByTimeAsync(600);
          await flushPromises();
          expect(mockUpdateProjectState).toHaveBeenCalled();
          const calls = mockUpdateProjectState.mock.calls;
          const payload = calls[calls.length - 1]?.[1] as { form?: Record<string, string> };
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
    await waitForWorkbenchReady();

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
          await flushPromises();
          await vi.advanceTimersByTimeAsync(600);
          await flushPromises();
          expect(mockUpdateProjectState).toHaveBeenCalled();
          const calls = mockUpdateProjectState.mock.calls;
          const payload = calls[calls.length - 1]?.[1] as { form?: Record<string, string> };
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
        await flushPromises();
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

  it("keeps core request contract for architecture and blueprint actions", async () => {
    const { wrapper, configStore } = mountWorkbench();
    await waitForWorkbenchReady();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 500, max: 20000 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        async (topic, genre, chapters, words, architectureLlm, blueprintLlm) => {
          mockGenerateArchitecture.mockClear();
          mockGenerateBlueprint.mockClear();

          (wrapper.vm as any).form.topic = topic;
          (wrapper.vm as any).form.genre = genre;
          (wrapper.vm as any).form.numberOfChapters = String(chapters);
          (wrapper.vm as any).form.wordNumber = String(words);
          (wrapper.vm as any).form.userGuidance = "guidance";
          (wrapper.vm as any).form.llmConfigName = "";
          configStore.chooseConfigs.architecture_llm = architectureLlm;
          configStore.chooseConfigs.chapter_outline_llm = blueprintLlm;
          await nextTick();

          await (wrapper.vm as any).runAction("architecture");
          expect(mockGenerateArchitecture).toHaveBeenCalledTimes(1);
          const architecturePayload = mockGenerateArchitecture.mock.calls[0][1] as Record<string, unknown>;
          expect(architecturePayload).toMatchObject({
            topic,
            genre,
            number_of_chapters: chapters,
            word_number: words,
            user_guidance: "guidance",
            llm_config_name: architectureLlm,
          });

          await (wrapper.vm as any).runAction("blueprint");
          expect(mockGenerateBlueprint).toHaveBeenCalledTimes(1);
          const blueprintPayload = mockGenerateBlueprint.mock.calls[0][1] as Record<string, unknown>;
          expect(blueprintPayload).toMatchObject({
            number_of_chapters: chapters,
            user_guidance: "guidance",
            llm_config_name: blueprintLlm,
          });
          expect(blueprintPayload).not.toHaveProperty("topic");
          expect(blueprintPayload).not.toHaveProperty("genre");
        }
      ),
      { numRuns: 10 }
    );

    wrapper.unmount();
  });

  it("keeps chapter progression semantics for finalize and batch completion", async () => {
    const { wrapper } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    // finalize success should auto-advance when target chapter is still the current focus
    workflowStore.setTotalChapters(10);
    (wrapper.vm as any).form.numberOfChapters = "10";
    workflowStore.setCurrentChapter(2);
    (wrapper.vm as any).form.chapterNumber = "2";
    await nextTick();
    await (wrapper.vm as any).runAction("finalize");
    const finalizeTaskId = taskStore.tasks.find((task) => task.label === "章节定稿")?.id;
    expect(finalizeTaskId).toBeTruthy();

    taskStore.updateTask(finalizeTaskId as string, { status: "success" });
    await flushPromises();
    await nextTick();

    expect(workflowStore.chapterStatuses[2]?.status).toBe("finalized");
    expect(workflowStore.currentChapter).toBe(3);

    // batch success should jump to end + 1 with setCurrentChapter clamping
    workflowStore.setTotalChapters(5);
    (wrapper.vm as any).form.numberOfChapters = "5";
    (wrapper.vm as any).batchConfig = { start: 3, end: 99, delaySeconds: 0 };
    await nextTick();

    await (wrapper.vm as any).runAction("batch");
    const batchTaskId = taskStore.tasks.find((task) => task.label === "批量生成")?.id;
    expect(batchTaskId).toBeTruthy();

    taskStore.updateTask(batchTaskId as string, {
      status: "success",
      result: { chapters: [{ chapter: 3, length: 1000 }] },
    });
    await flushPromises();
    await nextTick();

    expect(workflowStore.currentChapter).toBe(5);

    wrapper.unmount();
  });

  it("applies finalize terminal side effects at most once under status/log interleavings", async () => {
    const { wrapper, projectStore } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    type InterleavingEvent =
      | { type: "log"; message: string }
      | { type: "status"; status: "pending" | "running" | "success" | "failed" };

    const preTerminalEventArb = fc.oneof(
      fc.record({ type: fc.constant("log"), message: fc.string({ minLength: 1, maxLength: 24 }) }),
      fc.record({ type: fc.constant("status"), status: fc.constantFrom("pending", "running") })
    );

    const postTerminalEventArb = fc.oneof(
      fc.record({ type: fc.constant("log"), message: fc.string({ minLength: 1, maxLength: 24 }) }),
      fc.record({ type: fc.constant("status"), status: fc.constantFrom("pending", "running", "success", "failed") })
    );

    const applyEvent = async (taskId: string, event: InterleavingEvent) => {
      if (event.type === "log") {
        taskStore.appendLog(taskId, event.message);
      } else {
        taskStore.updateTask(taskId, { status: event.status });
      }
      await flushPromises();
      await nextTick();
    };

    await fc.assert(
      fc.asyncProperty(
        fc.array(preTerminalEventArb, { minLength: 0, maxLength: 8 }),
        fc.constantFrom("success", "failed"),
        fc.array(postTerminalEventArb, { minLength: 0, maxLength: 12 }),
        async (beforeTerminal, firstTerminalStatus, afterTerminal) => {
          taskStore.clearAll();
          workflowStore.reset();
          workflowStore.setTotalChapters(10);
          workflowStore.setCurrentChapter(2);
          workflowStore.markChapterDraftPending(2);
          (wrapper.vm as any).form.numberOfChapters = "10";
          (wrapper.vm as any).form.chapterNumber = "2";
          await nextTick();

          await (wrapper.vm as any).runAction("finalize");
          const finalizeTaskId = taskStore.tasks.find((task) => task.label === "章节定稿")?.id;
          expect(finalizeTaskId).toBeTruthy();

          (projectStore.refreshFileTree as ReturnType<typeof vi.fn>).mockClear();

          for (const event of beforeTerminal) {
            await applyEvent(finalizeTaskId as string, event as InterleavingEvent);
          }

          await applyEvent(finalizeTaskId as string, {
            type: "status",
            status: firstTerminalStatus as "success" | "failed",
          });

          const shouldFinalize = firstTerminalStatus === "success";
          const chapterAfterFirstTerminal = workflowStore.currentChapter;
          const chapterStatusAfterFirstTerminal = workflowStore.chapterStatuses[2]?.status;
          const refreshCallsAfterFirstTerminal = (
            projectStore.refreshFileTree as ReturnType<typeof vi.fn>
          ).mock.calls.length;

          for (const event of afterTerminal) {
            await applyEvent(finalizeTaskId as string, event as InterleavingEvent);
          }

          expect(workflowStore.currentChapter).toBe(chapterAfterFirstTerminal);
          expect(workflowStore.chapterStatuses[2]?.status).toBe(chapterStatusAfterFirstTerminal);
          if (shouldFinalize) {
            expect(chapterStatusAfterFirstTerminal).toBe("finalized");
          } else {
            expect(chapterStatusAfterFirstTerminal).not.toBe("finalized");
          }

          const finalizeTask = taskStore.tasks.find((task) => task.id === finalizeTaskId);
          expect(finalizeTask?.handled).toBe(true);
          expect((projectStore.refreshFileTree as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(
            refreshCallsAfterFirstTerminal
          );
          expect(refreshCallsAfterFirstTerminal).toBe(shouldFinalize ? 1 : 0);
        }
      ),
      { numRuns: 25 }
    );

    wrapper.unmount();
  });

  it("keeps terminal processing single-flight under reentrant task updates", async () => {
    const { wrapper, projectStore } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    workflowStore.setTotalChapters(10);
    workflowStore.setCurrentChapter(2);
    workflowStore.markChapterDraftPending(2);
    (wrapper.vm as any).form.numberOfChapters = "10";
    (wrapper.vm as any).form.chapterNumber = "2";
    await nextTick();

    let releaseRefresh: () => void = () => {};
    const refreshBarrier = new Promise<void>((resolve) => {
      releaseRefresh = () => resolve();
    });
    (projectStore.refreshFileTree as ReturnType<typeof vi.fn>).mockImplementation(() => refreshBarrier);

    await (wrapper.vm as any).runAction("finalize");
    const finalizeTaskId = taskStore.tasks.find((task) => task.label === "章节定稿")?.id;
    expect(finalizeTaskId).toBeTruthy();

    taskStore.updateTask(finalizeTaskId as string, { status: "success" });
    await flushPromises();
    await nextTick();

    const inFlightTask = taskStore.tasks.find((task) => task.id === finalizeTaskId);
    expect(inFlightTask?.handled).toBeUndefined();
    expect((projectStore.refreshFileTree as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);

    taskStore.updateTask(finalizeTaskId as string, { status: "failed", error: "late update" });
    taskStore.updateTask(finalizeTaskId as string, { status: "success" });
    await flushPromises();
    await nextTick();

    expect((projectStore.refreshFileTree as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(workflowStore.chapterStatuses[2]?.status).not.toBe("finalized");

    releaseRefresh();
    await flushPromises();
    await nextTick();

    expect((projectStore.refreshFileTree as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(workflowStore.chapterStatuses[2]?.status).toBe("finalized");
    expect(workflowStore.currentChapter).toBe(3);

    wrapper.unmount();
  });

  it("aborts batch when pre-finalize task times out", async () => {
    const { wrapper } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    workflowStore.setCurrentChapter(1);
    workflowStore.markChapterDraftPending(1);
    (wrapper.vm as any).form.wordNumber = "3000";
    (wrapper.vm as any).form.chapterNumber = "1";
    (wrapper.vm as any).batchConfig = { start: 1, end: 3, delaySeconds: 0 };
    await nextTick();

    mockGenerateBatch.mockClear();
    mockCancelTask.mockClear();
    const batchPromise = (wrapper.vm as any).runAction("batch");
    await nextTick();
    await flushPromises();

    const autoFinalizeTaskId = taskStore.tasks.find((task) => task.label === "自动定稿")?.id;
    expect(autoFinalizeTaskId).toBeTruthy();

    await vi.advanceTimersByTimeAsync(90_100);
    await batchPromise;
    await flushPromises();
    await nextTick();

    expect(mockGenerateBatch).not.toHaveBeenCalled();
    expect(mockCancelTask).toHaveBeenCalledWith(autoFinalizeTaskId);
    expect((wrapper.vm as any).batchRunning).toBe(false);

    wrapper.unmount();
  });

  it("aborts batch when pre-finalize task is externally aborted and propagates cancel", async () => {
    const { wrapper } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    workflowStore.setCurrentChapter(1);
    workflowStore.markChapterDraftPending(1);
    (wrapper.vm as any).form.wordNumber = "3000";
    (wrapper.vm as any).form.chapterNumber = "1";
    (wrapper.vm as any).batchConfig = { start: 1, end: 3, delaySeconds: 0 };
    await nextTick();

    mockGenerateBatch.mockClear();
    mockCancelTask.mockClear();
    let abortSignal: AbortSignal | undefined;
    mockFinalizeChapter.mockImplementationOnce(async () => {
      await Promise.resolve();
      return { task_id: "task-f" };
    });
    const addEventListenerSpy = vi
      .spyOn(AbortSignal.prototype, "addEventListener")
      .mockImplementation(function (this: AbortSignal, type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) {
        if (type === "abort") {
          abortSignal = this;
        }
        return EventTarget.prototype.addEventListener.call(this, type, listener, options);
      });

    const batchPromise = (wrapper.vm as any).runAction("batch");
    await nextTick();
    await flushPromises();

    const autoFinalizeTaskId = taskStore.tasks.find((task) => task.label === "自动定稿")?.id;
    expect(autoFinalizeTaskId).toBeTruthy();

    abortSignal?.dispatchEvent(new Event("abort"));
    await batchPromise;
    await flushPromises();
    await nextTick();

    expect(mockGenerateBatch).not.toHaveBeenCalled();
    expect(mockCancelTask).toHaveBeenCalledWith(autoFinalizeTaskId);
    expect((wrapper.vm as any).batchRunning).toBe(false);

    addEventListenerSpy.mockRestore();
    wrapper.unmount();
  });

  it("aborts batch when pre-finalize task fails", async () => {
    const { wrapper } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    workflowStore.setCurrentChapter(1);
    workflowStore.markChapterDraftPending(1);
    (wrapper.vm as any).form.wordNumber = "3000";
    (wrapper.vm as any).form.chapterNumber = "1";
    (wrapper.vm as any).batchConfig = { start: 1, end: 3, delaySeconds: 0 };
    await nextTick();

    mockGenerateBatch.mockClear();
    mockCancelTask.mockClear();
    const batchPromise = (wrapper.vm as any).runAction("batch");
    await nextTick();
    await flushPromises();

    const autoFinalizeTaskId = taskStore.tasks.find((task) => task.label === "自动定稿")?.id;
    expect(autoFinalizeTaskId).toBeTruthy();

    taskStore.updateTask(autoFinalizeTaskId as string, { status: "failed", error: "auto finalize failed" });
    await vi.advanceTimersByTimeAsync(600);
    await flushPromises();
    await nextTick();
    await batchPromise;

    expect(mockGenerateBatch).not.toHaveBeenCalled();
    expect(mockCancelTask).not.toHaveBeenCalled();
    expect((wrapper.vm as any).batchRunning).toBe(false);

    wrapper.unmount();
  });

  it("suppresses stale pre-finalize success side effects", async () => {
    const { wrapper } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    workflowStore.setTotalChapters(10);
    workflowStore.setCurrentChapter(1);
    workflowStore.markChapterDraftPending(1);
    (wrapper.vm as any).form.numberOfChapters = "10";
    (wrapper.vm as any).form.chapterNumber = "1";
    (wrapper.vm as any).batchConfig = { start: 1, end: 3, delaySeconds: 0 };
    await nextTick();

    mockGenerateBatch.mockClear();
    mockCancelTask.mockClear();
    const batchPromise = (wrapper.vm as any).runAction("batch");
    await nextTick();
    await flushPromises();

    const autoFinalizeTask = taskStore.tasks.find((task) => task.label === "自动定稿");
    expect(autoFinalizeTask?.id).toBeTruthy();

    await vi.advanceTimersByTimeAsync(90_100);
    await batchPromise;
    await flushPromises();
    await nextTick();

    taskStore.updateTask(autoFinalizeTask!.id, { status: "success" });
    await flushPromises();
    await nextTick();

    expect(workflowStore.chapterStatuses[1]?.status).not.toBe("finalized");
    expect(mockGenerateBatch).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("retries terminal handling after transient failure and side effect still executes once", async () => {
    const { wrapper, projectStore } = mountWorkbench();
    const taskStore = useTaskStore();
    const workflowStore = useWorkflowStore();
    await waitForWorkbenchReady();

    workflowStore.setTotalChapters(10);
    workflowStore.setCurrentChapter(2);
    workflowStore.markChapterDraftPending(2);
    (wrapper.vm as any).form.numberOfChapters = "10";
    (wrapper.vm as any).form.chapterNumber = "2";
    await nextTick();

    const refreshSpy = projectStore.refreshFileTree as ReturnType<typeof vi.fn>;
    refreshSpy.mockReset();
    refreshSpy.mockImplementationOnce(async () => {
      throw new Error("transient refresh failure");
    });
    refreshSpy.mockImplementation(async () => undefined);

    await (wrapper.vm as any).runAction("finalize");
    const finalizeTaskId = taskStore.tasks.find((task) => task.label === "章节定稿")?.id;
    expect(finalizeTaskId).toBeTruthy();

    taskStore.updateTask(finalizeTaskId as string, { status: "success" });
    await flushPromises();
    await nextTick();
    await flushPromises();
    await nextTick();

    const finalizeTask = taskStore.tasks.find((task) => task.id === finalizeTaskId);
    expect(finalizeTask?.handled).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(2);
    expect(workflowStore.chapterStatuses[2]?.status).toBe("finalized");

    wrapper.unmount();
  });

  it("stops retrying terminal handling after max attempts without toast flooding", async () => {
    const { wrapper, projectStore } = mountWorkbench();
    const taskStore = useTaskStore();
    await waitForWorkbenchReady();

    const refreshSpy = projectStore.refreshFileTree as ReturnType<typeof vi.fn>;
    refreshSpy.mockReset();
    refreshSpy.mockImplementation(async () => {
      throw new Error("persistent refresh failure");
    });

    await (wrapper.vm as any).runAction("architecture");
    const taskId = taskStore.tasks.find((task) => task.label === "生成架构")?.id;
    expect(taskId).toBeTruthy();

    taskStore.updateTask(taskId as string, { status: "success" });
    await flushPromises();
    await nextTick();
    await flushPromises();
    await nextTick();

    const task = taskStore.tasks.find((item) => item.id === taskId);
    expect(task?.handled).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(3);

    const toasts = (wrapper.vm as any).toastStore.toasts as Array<{ type: string; message: string }>;
    const errorToasts = toasts.filter((toast) => toast.type === "error");

    expect(errorToasts.length).toBe(4);
    expect(errorToasts.filter((toast) => toast.message.includes("处理任务终态失败")).length).toBe(3);
    expect(errorToasts.filter((toast) => toast.message.includes("失败已达上限")).length).toBe(1);

    wrapper.unmount();
  });

  it("blocks API calls and shows warning when numeric payload fields are invalid", async () => {
    const { wrapper } = mountWorkbench();
    await waitForWorkbenchReady();

    mockedToPayloadNumber.mockImplementation((value: number | string, rule?: Parameters<typeof toPayloadNumber>[1]) => {
      const parsed = Number(value);
      if (rule?.label === "章节号" && (!Number.isInteger(parsed) || parsed < 1)) {
        throw new Error("章节号必须大于或等于1");
      }
      if (rule?.label === "目标字数" && (!Number.isInteger(parsed) || parsed < 1)) {
        throw new Error("目标字数必须大于或等于1");
      }
      if (rule?.label === "章节总数" && (!Number.isInteger(parsed) || parsed < 1)) {
        throw new Error("章节总数必须大于或等于1");
      }
      return parsed;
    });

    mockGenerateArchitecture.mockClear();
    (wrapper.vm as any).form.numberOfChapters = "0";
    await nextTick();

    await (wrapper.vm as any).runAction("architecture");
    expect(mockGenerateArchitecture).not.toHaveBeenCalled();

    const warningToasts = (wrapper.vm as any).toastStore.toasts as Array<{ type: string; message: string }>;
    expect(warningToasts.some((toast) => toast.type === "warning" && toast.message.includes("章节总数"))).toBe(true);

    wrapper.unmount();
  });

});

import { ref, type Ref } from "vue";
import {
  buildChapterPayload,
  buildChapterSharedPayload,
  buildPrompt,
  cancelTask,
  consistencyCheck,
  finalizeChapter,
  generateArchitecture,
  generateBatch,
  generateBlueprint,
  generateDraft,
  type BatchPayload as ApiBatchPayload,
  type BuildPromptPayload,
  type ConsistencyCheckPayload,
  type DraftPayload,
  type FinalizePayload,
} from "@/api/tasks";
import type { TaskResponse } from "@/api/types";
import {
  resolveConfigName,
  toPayloadNumber,
  type NumberValidationRule,
} from "@/composables/workbenchPayloadHelpers";
import { createPreFinalizeSessionManager } from "@/composables/workbenchPreFinalizeSession";
import { createTerminalTaskProcessor } from "@/composables/workbenchTerminalProcessor";
import type { TaskActionMeta, TerminalTask, WorkbenchAction } from "@/composables/workbenchActionTypes";
import type { WorkbenchForm } from "@/composables/workbenchFormTypes";
import type { useConfigStore } from "@/stores/config";
import type { useProjectStore } from "@/stores/project";
import type { useTaskStore } from "@/stores/task";
import type { useToastStore } from "@/stores/toast";
import type { useWorkflowStore } from "@/stores/workflow";

type BatchRangePayload = {
  start: number;
  end: number;
  delaySeconds: number;
};

type TerminalStatus = "success" | "failed";
type WaitForTaskTerminalStatus = "success" | "failed" | "timeout" | "aborted";
type NumericFieldKey = "chapterNumber" | "wordNumber" | "numberOfChapters";

type WaitForTaskTerminalOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ValidationFailure = { field: NumericFieldKey; reason: string };
type ActionLockKey = string;

type UseWorkbenchActionsOptions = {
  form: WorkbenchForm;
  configStore: ReturnType<typeof useConfigStore>;
  projectStore: ReturnType<typeof useProjectStore>;
  taskStore: ReturnType<typeof useTaskStore>;
  toastStore: ReturnType<typeof useToastStore>;
  workflowStore: ReturnType<typeof useWorkflowStore>;
  pendingPromptTask: Ref<string | null>;
  batchRunning: Ref<boolean>;
  batchCancelRequested: Ref<boolean>;
  batchProgress: Ref<{ current: number; total: number }>;
  batchSummary: Ref<string>;
  batchError: Ref<string>;
  batchTaskId: Ref<string | null>;
  batchConfig: Ref<BatchRangePayload>;
  getBatchDefaults: () => { start: number; end: number };
  onQueueSaveState: () => void;
  onTaskHandled: (payload: {
    task: TerminalTask;
    actionMeta?: TaskActionMeta;
  }) => Promise<void> | void;
};

export function useWorkbenchActions(options: UseWorkbenchActionsOptions) {
  const {
    form,
    configStore,
    projectStore,
    taskStore,
    toastStore,
    workflowStore,
    pendingPromptTask,
    batchRunning,
    batchCancelRequested,
    batchProgress,
    batchSummary,
    batchError,
    batchTaskId,
    batchConfig,
    getBatchDefaults,
    onQueueSaveState,
    onTaskHandled,
  } = options;

  const taskActionMap = new Map<string, TaskActionMeta>();
  const taskLockKeyMap = new Map<string, ActionLockKey>();
  const duplicateNoticeAt = new Map<ActionLockKey, number>();
  const processingTaskIds = new Set<string>();
  const taskHandleAttempts = new Map<string, number>();
  const preFinalizeSessionManager = createPreFinalizeSessionManager();
  const actionLockCounts = ref<Record<string, number>>({});
  const batchPrepareRunning = ref(false);
  const terminalProcessInFlight = ref(false);
  const terminalProcessNeedsRerun = ref(false);

  const setTaskActionMeta = (taskId: string, meta: TaskActionMeta) => {
    taskActionMap.set(taskId, meta);
  };

  const getTaskActionMeta = (taskId: string) => taskActionMap.get(taskId);

  const deleteTaskActionMeta = (taskId: string) => {
    taskActionMap.delete(taskId);
  };

  const resolveActionChapterNumber = () => {
    const numeric = Number(form.chapterNumber);
    if (Number.isInteger(numeric) && numeric > 0) {
      return numeric;
    }
    return workflowStore.currentChapter;
  };

  const toActionLockKey = (action: WorkbenchAction, chapterNumber?: number): ActionLockKey => {
    if (action === "draft" || action === "finalize" || action === "preview-prompt" || action === "consistency") {
      const chapter =
        typeof chapterNumber === "number" && Number.isInteger(chapterNumber) && chapterNumber > 0
          ? chapterNumber
          : resolveActionChapterNumber();
      return `${action}:${chapter}`;
    }
    return action;
  };

  const resolveActionLockKey = (meta: TaskActionMeta): ActionLockKey =>
    toActionLockKey(meta.action, meta.chapterNumber);

  const getActionLockCount = (key: ActionLockKey) => actionLockCounts.value[key] ?? 0;

  const updateActionLock = (key: ActionLockKey, delta: number) => {
    const current = getActionLockCount(key);
    const next = Math.max(0, current + delta);
    const snapshot = { ...actionLockCounts.value };
    if (next <= 0) {
      delete snapshot[key];
    } else {
      snapshot[key] = next;
    }
    actionLockCounts.value = snapshot;
  };

  const lockAction = (key: ActionLockKey) => {
    updateActionLock(key, 1);
  };

  const unlockAction = (key: ActionLockKey) => {
    updateActionLock(key, -1);
  };

  const releaseTaskActionLock = (taskId: string) => {
    const key = taskLockKeyMap.get(taskId);
    if (!key) {
      return;
    }
    taskLockKeyMap.delete(taskId);
    unlockAction(key);
  };

  const pruneStaleActionLocks = () => {
    for (const [taskId, key] of taskLockKeyMap.entries()) {
      const task = taskStore.tasks.find((item) => item.id === taskId);
      if (!task || task.handled) {
        taskLockKeyMap.delete(taskId);
        unlockAction(key);
      }
    }
  };

  const isActionLockBusy = (key: ActionLockKey) => {
    pruneStaleActionLocks();
    return getActionLockCount(key) > 0;
  };

  const reportBusyAction = (label: string, key: ActionLockKey) => {
    const now = Date.now();
    const lastShownAt = duplicateNoticeAt.get(key) ?? 0;
    if (now - lastShownAt < 1200) {
      return;
    }
    duplicateNoticeAt.set(key, now);
    toastStore.info(`${label}正在执行，请勿重复点击`);
  };

  const isActionBusy = (action: WorkbenchAction, chapterNumber?: number) => {
    if (action === "batch" && batchPrepareRunning.value) {
      return true;
    }
    return isActionLockBusy(toActionLockKey(action, chapterNumber));
  };

  const { processTerminalTasks } = createTerminalTaskProcessor({
    taskStore,
    toastStore,
    processingTaskIds,
    taskHandleAttempts,
    terminalProcessInFlight,
    terminalProcessNeedsRerun,
    getTaskActionMeta,
    deleteTaskActionMeta,
    onTaskSettled: releaseTaskActionLock,
    onTaskHandled,
  });

  const resolveLlm = (fallback?: string) =>
    resolveConfigName(form.llmConfigName, fallback);

  const resolveEmbedding = () =>
    resolveConfigName(form.embeddingConfigName, configStore.chooseConfigs.embedding);

  const numericRules: Record<NumericFieldKey, NumberValidationRule> = {
    chapterNumber: {
      integer: true,
      finite: true,
      min: 1,
      label: "章节号",
    },
    wordNumber: {
      integer: true,
      finite: true,
      min: 1,
      label: "目标字数",
    },
    numberOfChapters: {
      integer: true,
      finite: true,
      min: 1,
      label: "章节总数",
    },
  };

  const parseFieldNumber = (field: NumericFieldKey): number =>
    toPayloadNumber(form[field], numericRules[field]);

  const chapterNumber = () => parseFieldNumber("chapterNumber");

  const wordNumber = () => parseFieldNumber("wordNumber");

  const numberOfChapters = () => parseFieldNumber("numberOfChapters");

  const buildChapterSharedInput = (llmConfigName?: string) => ({
    wordNumber: wordNumber(),
    charactersInvolved: form.charactersInvolved,
    keyItems: form.keyItems,
    sceneLocation: form.sceneLocation,
    timeConstraint: form.timeConstraint,
    userGuidance: form.userGuidance,
    llmConfigName,
    embeddingConfigName: resolveEmbedding(),
  });

  const buildDraftChapterPayload = (): BuildPromptPayload =>
    buildChapterPayload({
      chapterNumber: chapterNumber(),
      ...buildChapterSharedInput(resolveLlm(configStore.chooseConfigs.prompt_draft_llm)),
    });

  const buildFinalizePayload = (currentChapter: number): FinalizePayload => ({
    novel_number: currentChapter,
    word_number: wordNumber(),
    llm_config_name: resolveLlm(configStore.chooseConfigs.finalize_llm),
    embedding_config_name: resolveEmbedding(),
  });

  const buildBatchPayload = (payload: BatchRangePayload): ApiBatchPayload => ({
    start_chapter: payload.start,
    end_chapter: payload.end,
    delay_seconds: payload.delaySeconds,
    ...buildChapterSharedPayload(
      buildChapterSharedInput(resolveLlm(configStore.chooseConfigs.prompt_draft_llm))
    ),
  });

  const runTask = async (
    label: string,
    apiCall: () => Promise<TaskResponse>,
    actionMeta?: TaskActionMeta
  ) => {
    const lockKey = actionMeta ? resolveActionLockKey(actionMeta) : null;
    if (lockKey && isActionLockBusy(lockKey)) {
      reportBusyAction(label, lockKey);
      return null;
    }
    if (lockKey) {
      lockAction(lockKey);
    }
    try {
      const payload = await apiCall();
      taskStore.registerTask(payload.task_id, label);
      if (actionMeta) {
        setTaskActionMeta(payload.task_id, actionMeta);
      }
      if (lockKey) {
        taskLockKeyMap.set(payload.task_id, lockKey);
      }
      return payload.task_id;
    } catch (error) {
      projectStore.error = error instanceof Error ? error.message : "任务执行失败";
      if (lockKey) {
        unlockAction(lockKey);
      }
      return null;
    }
  };

  const fieldLabelMap: Record<NumericFieldKey, string> = {
    chapterNumber: "章节号",
    wordNumber: "目标字数",
    numberOfChapters: "章节总数",
  };

  const reportValidationFailure = (failure: ValidationFailure) => {
    toastStore.warning(`${fieldLabelMap[failure.field]}${failure.reason}`);
  };

  const resolveValidationFailure = (error: unknown): ValidationFailure | null => {
    if (!(error instanceof Error)) {
      return null;
    }

    const rawMessage = error.message.trim();
    for (const [field, label] of Object.entries(fieldLabelMap) as Array<[NumericFieldKey, string]>) {
      if (!rawMessage.startsWith(label)) {
        continue;
      }
      const reason = rawMessage.slice(label.length).trim();
      return {
        field,
        reason: reason || "输入不合法",
      };
    }

    return null;
  };

  const withValidNumbers = async <T>(operation: () => Promise<T>): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const failure = resolveValidationFailure(error);
      if (failure) {
        reportValidationFailure(failure);
        return null;
      }
      throw error;
    }
  };

  const getPendingTaskById = (taskId: string) =>
    taskStore.tasks.find((item) => item.id === taskId);

  const isTerminalStatus = (status: string): status is TerminalStatus =>
    status === "success" || status === "failed";

  const getTerminalTaskById = (taskId: string): { status: TerminalStatus } | null => {
    const task = getPendingTaskById(taskId);
    if (!task || !isTerminalStatus(task.status)) {
      return null;
    }
    return { status: task.status };
  };

  const waitForTaskTerminal = (
    taskId: string,
    options: WaitForTaskTerminalOptions = {}
  ) =>
    new Promise<WaitForTaskTerminalStatus>((resolve) => {
      const { timeoutMs = 90_000, signal } = options;
      const initial = getTerminalTaskById(taskId);
      if (initial) {
        resolve(initial.status);
        return;
      }

      let settled = false;
      let checkInterval: number | null = null;
      let timeoutId: number | null = null;

      const cleanup = () => {
        if (checkInterval !== null) {
          window.clearInterval(checkInterval);
          checkInterval = null;
        }
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      };

      const settle = (status: WaitForTaskTerminalStatus) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(status);
      };

      const onAbort = () => settle("aborted");

      if (signal?.aborted) {
        settle("aborted");
        return;
      }

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      checkInterval = window.setInterval(() => {
        const current = getTerminalTaskById(taskId);
        if (current) {
          settle(current.status);
        }
      }, 500);

      timeoutId = window.setTimeout(() => {
        settle("timeout");
      }, timeoutMs);
    });

  const isPreFinalizeSessionValid = (sessionId?: number) =>
    preFinalizeSessionManager.isSessionValid(sessionId);

  const cancelPreFinalizeTask = async (taskId: string, sessionId?: number) => {
    try {
      await cancelTask(taskId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "未知错误";
      toastStore.warning(`自动定稿取消请求失败，已隔离该次结果：${reason}`);
    }
    preFinalizeSessionManager.invalidateSession(sessionId);
  };

  const executeBatchGeneration = async (projectId: string, payload: BatchRangePayload) => {
    batchSummary.value = "";
    batchError.value = "";
    batchRunning.value = true;
    batchCancelRequested.value = false;
    batchConfig.value = payload;
    batchProgress.value = {
      current: 0,
      total: Math.max(0, payload.end - payload.start + 1),
    };
    const batchPayload = await withValidNumbers(async () =>
      buildBatchPayload(payload)
    );
    if (!batchPayload) {
      batchRunning.value = false;
      return;
    }
    const taskId = await runTask(
      "批量生成",
      () =>
        generateBatch(projectId, batchPayload),
      { action: "batch" }
    );
    if (!taskId) {
      batchRunning.value = false;
      return;
    }
    batchTaskId.value = taskId;
    onQueueSaveState();
  };

  const startBatch = async (payload: BatchRangePayload) => {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) {
      return;
    }

    if (workflowStore.hasPendingDraft) {
      toastStore.info("当前章节有未定稿草稿，正在自动定稿...");
      const abortController = new AbortController();
      const finalizeSessionId = preFinalizeSessionManager.createSession();
      const finalizePayload = await withValidNumbers(async () =>
        buildFinalizePayload(workflowStore.currentChapter)
      );
      if (!finalizePayload) {
        return;
      }
      const finalizeTaskId = await runTask(
        "自动定稿",
        () =>
          finalizeChapter(projectId, finalizePayload),
        {
          action: "finalize",
          chapterNumber: workflowStore.currentChapter,
          sessionId: finalizeSessionId,
        }
      );
      if (finalizeTaskId) {
        const status = await waitForTaskTerminal(finalizeTaskId, {
          timeoutMs: 90_000,
          signal: abortController.signal,
        });
        if (status === "success" && preFinalizeSessionManager.isSessionValid(finalizeSessionId)) {
          preFinalizeSessionManager.settleSession(finalizeSessionId);
          await executeBatchGeneration(projectId, payload);
        } else {
          if (status === "timeout") {
            abortController.abort();
            await cancelPreFinalizeTask(finalizeTaskId, finalizeSessionId);
            toastStore.error("自动定稿等待超时，已取消批量生成");
          } else if (status === "aborted") {
            await cancelPreFinalizeTask(finalizeTaskId, finalizeSessionId);
            toastStore.error("自动定稿等待已取消，已取消批量生成");
          } else if (status === "success") {
            preFinalizeSessionManager.invalidateSession(finalizeSessionId);
            toastStore.warning("检测到失效的自动定稿结果，已取消批量生成");
          } else {
            preFinalizeSessionManager.settleSession(finalizeSessionId);
            toastStore.error("自动定稿失败，已取消批量生成");
          }
          batchRunning.value = false;
        }
      } else {
        preFinalizeSessionManager.settleSession(finalizeSessionId);
      }
      return;
    }

    await executeBatchGeneration(projectId, payload);
  };

  const startBatchDirect = async () => {
    const defaults = getBatchDefaults();
    await startBatch({
      start: defaults.start,
      end: defaults.end,
      delaySeconds: batchConfig.value.delaySeconds,
    });
  };

  const runAction = async (action: WorkbenchAction) => {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) {
      return;
    }

    switch (action) {
      case "architecture": {
        const payload = await withValidNumbers(async () => ({
          topic: form.topic,
          genre: form.genre,
          number_of_chapters: numberOfChapters(),
          word_number: wordNumber(),
          user_guidance: form.userGuidance,
          llm_config_name: resolveLlm(configStore.chooseConfigs.architecture_llm),
        }));
        if (!payload) {
          return;
        }
        await runTask(
          "生成架构",
          () => generateArchitecture(projectId, payload),
          { action: "architecture" }
        );
        return;
      }
      case "blueprint": {
        const payload = await withValidNumbers(async () => ({
          number_of_chapters: numberOfChapters(),
          user_guidance: form.userGuidance,
          llm_config_name: resolveLlm(configStore.chooseConfigs.chapter_outline_llm),
        }));
        if (!payload) {
          return;
        }
        await runTask(
          "生成章节蓝图",
          () => generateBlueprint(projectId, payload),
          { action: "blueprint" }
        );
        return;
      }
      case "preview-prompt": {
        const payloadBase = await withValidNumbers(async () => buildDraftChapterPayload());
        if (!payloadBase) {
          return;
        }
        const taskId = await runTask(
          "预览提示词",
          () => buildPrompt(projectId, payloadBase),
          { action: "preview-prompt", chapterNumber: payloadBase.novel_number }
        );
        if (taskId) {
          pendingPromptTask.value = taskId;
        }
        return;
      }
      case "batch": {
        if (isActionBusy("batch")) {
          reportBusyAction("批量生成", toActionLockKey("batch"));
          return;
        }
        batchPrepareRunning.value = true;
        try {
          const isValid = await withValidNumbers(async () => {
            numberOfChapters();
            chapterNumber();
            wordNumber();
            return true;
          });
          if (!isValid) {
            return;
          }
          await startBatchDirect();
        } finally {
          batchPrepareRunning.value = false;
        }
        return;
      }
      case "draft": {
        const payloadBase = await withValidNumbers(async () => buildDraftChapterPayload());
        if (!payloadBase) {
          return;
        }
        await runTask(
          "生成草稿",
          () => generateDraft(projectId, payloadBase),
          { action: "draft", chapterNumber: payloadBase.novel_number }
        );
        return;
      }
      case "finalize": {
        const payload = await withValidNumbers(async () =>
          buildFinalizePayload(chapterNumber())
        );
        if (!payload) {
          return;
        }
        await runTask(
          "章节定稿",
          () => finalizeChapter(projectId, payload),
          { action: "finalize", chapterNumber: payload.novel_number }
        );
        return;
      }
      case "consistency": {
        const payload: ConsistencyCheckPayload = {
          novel_setting: "",
          character_state: "",
          global_summary: "",
          chapter_text: projectStore.editorContent,
          llm_config_name: resolveLlm(configStore.chooseConfigs.consistency_llm),
        };
        await runTask(
          "一致性检查",
          () => consistencyCheck(projectId, payload),
          { action: "consistency", chapterNumber: resolveActionChapterNumber() }
        );
        return;
      }
    }
  };

  const usePrompt = async (value: string) => {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) {
      return;
    }
    const payload = await withValidNumbers(async (): Promise<DraftPayload> => ({
      ...buildDraftChapterPayload(),
      custom_prompt_text: value,
    }));
    if (!payload) {
      return;
    }
    await runTask(
      "生成草稿",
      () => generateDraft(projectId, payload),
      { action: "draft", chapterNumber: payload.novel_number }
    );
  };

  const cancelBatchAction = async () => {
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

  const getPendingPromptTaskId = () => pendingPromptTask.value;

  const clearPendingPromptTask = () => {
    pendingPromptTask.value = null;
  };

  return {
    runTask,
    runAction,
    usePrompt,
    cancelBatch: cancelBatchAction,
    processTerminalTasks,
    setTaskActionMeta,
    getPendingPromptTaskId,
    clearPendingPromptTask,
    isPreFinalizeSessionValid,
    isActionBusy,
  };
}

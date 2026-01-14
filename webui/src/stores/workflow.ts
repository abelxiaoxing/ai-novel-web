import { defineStore } from "pinia";

export type WorkflowStep = "architecture" | "blueprint" | "draft";
export type ChapterStatus = "not-started" | "draft-pending" | "finalized";

export interface StepConfig {
  key: WorkflowStep;
  label: string;
  icon: string;
  prerequisite?: WorkflowStep;
}

export const WORKFLOW_STEPS: StepConfig[] = [
  { key: "architecture", label: "架构生成", icon: "building" },
  { key: "blueprint", label: "蓝图生成", icon: "map", prerequisite: "architecture" },
  { key: "draft", label: "章节生成", icon: "edit", prerequisite: "blueprint" },
];

export interface ChapterState {
  status: ChapterStatus;
  modifiedSinceFinalize?: boolean; // 编辑后标记需要重新定稿
}

export interface WorkflowState {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  hasArchitecture: boolean;
  hasBlueprint: boolean;
  currentChapter: number;
  totalChapters: number;
  chapterStatuses: Record<number, ChapterState>; // 章节号 -> 状态
}

/**
 * Compute which buttons should be disabled based on workflow state
 */
export function computeButtonStates(state: {
  hasArchitecture: boolean;
  hasBlueprint: boolean;
  currentChapter: number;
  chapterStatuses: Record<number, ChapterState>;
  totalChapters: number;
}): {
  architectureDisabled: boolean;
  blueprintDisabled: boolean;
  draftDisabled: boolean;
  draftDisabledReason: string | null;
  finalizeDisabled: boolean;
  finalizeDisabledReason: string | null;
} {
  const { currentChapter, chapterStatuses, totalChapters } = state;
  const currentChapterState = chapterStatuses[currentChapter] || { status: "not-started" as ChapterStatus };

  // 第1章可直接生成，第N章需要第N-1章已定稿
  const prevChapter = currentChapter - 1;
  const prevChapterState = chapterStatuses[prevChapter];
  const needsPrevFinalized = prevChapter >= 1 && (!prevChapterState || prevChapterState.status !== "finalized");

  return {
    architectureDisabled: false,
    blueprintDisabled: !state.hasArchitecture,
    draftDisabled: !state.hasBlueprint || needsPrevFinalized,
    draftDisabledReason: needsPrevFinalized ? `请先定稿第 ${prevChapter} 章` : null,
    finalizeDisabled: currentChapterState.status === "not-started",
    finalizeDisabledReason: currentChapterState.status === "not-started" ? "请先生成草稿" : null,
  };
}

export const useWorkflowStore = defineStore("workflow", {
  state: (): WorkflowState => ({
    currentStep: "architecture",
    completedSteps: [],
    hasArchitecture: false,
    hasBlueprint: false,
    currentChapter: 1,
    totalChapters: 10,
    chapterStatuses: {},
  }),

  getters: {
    /**
     * Check if a specific step is completed
     */
    isStepCompleted:
      (state) =>
      (step: WorkflowStep): boolean => {
        return state.completedSteps.includes(step);
      },

    /**
     * Check if a step's prerequisite is met
     */
    isPrerequisiteMet:
      (state) =>
      (step: WorkflowStep): boolean => {
        const stepConfig = WORKFLOW_STEPS.find((s) => s.key === step);
        if (!stepConfig?.prerequisite) {
          return true; // No prerequisite means it's always available
        }
        return state.completedSteps.includes(stepConfig.prerequisite);
      },

    /**
     * Check if a step is available (prerequisite met and not yet completed)
     */
    isStepAvailable() {
      return (step: WorkflowStep): boolean => {
        return this.isPrerequisiteMet(step);
      };
    },

    /**
     * Get the next recommended step
     */
    nextStep(state): WorkflowStep | null {
      for (const step of WORKFLOW_STEPS) {
        if (!state.completedSteps.includes(step.key)) {
          // Check if prerequisite is met
          if (!step.prerequisite || state.completedSteps.includes(step.prerequisite)) {
            return step.key;
          }
        }
      }
      return null;
    },

    /**
     * Get the status of a specific chapter
     */
    getChapterStatus(state): (chapter: number) => ChapterState {
      return (chapter: number) => {
        return state.chapterStatuses[chapter] || { status: "not-started" };
      };
    },

    /**
     * Get the status label for display
     */
    getChapterStatusLabel(): { label: string; variant: string } {
      const state = this.getChapterStatus(this.currentChapter);
      if (state.status === "finalized") {
        return { label: "✓ 已定稿", variant: "success" };
      } else if (state.status === "draft-pending") {
        return { label: "● 草稿待定稿", variant: "warning" };
      }
      return { label: "○ 未开始", variant: "muted" };
    },

    /**
     * Check if current chapter has a pending draft (needs finalization)
     */
    hasPendingDraft(): boolean {
      const state = this.getChapterStatus(this.currentChapter);
      return state.status === "draft-pending";
    },

    /**
     * Check if current chapter is finalized
     */
    isCurrentChapterFinalized(): boolean {
      const state = this.getChapterStatus(this.currentChapter);
      return state.status === "finalized";
    },

    /**
     * Check if there is any chapter with pending draft status
     */
    hasAnyPendingDraft(): boolean {
      return Object.values(this.chapterStatuses).some(
        (state) => state.status === "draft-pending"
      );
    },

    /**
     * Get the last finalized chapter number
     */
    lastFinalizedChapter(): number {
      const finalizedChapters = Object.entries(this.chapterStatuses)
        .filter(([_, state]) => state.status === "finalized")
        .map(([chapter, _]) => Number(chapter));
      return finalizedChapters.length > 0 ? Math.max(...finalizedChapters) : 0;
    },

    /**
     * Get button disabled states
     */
    buttonStates(state): ReturnType<typeof computeButtonStates> {
      return computeButtonStates({
        hasArchitecture: state.hasArchitecture,
        hasBlueprint: state.hasBlueprint,
        currentChapter: state.currentChapter,
        chapterStatuses: state.chapterStatuses,
        totalChapters: state.totalChapters,
      });
    },

    /**
     * Get tooltip message for a disabled button
     */
    getDisabledTooltip() {
      return (step: WorkflowStep): string | null => {
        const stepConfig = WORKFLOW_STEPS.find((s) => s.key === step);
        if (!stepConfig?.prerequisite) {
          return null;
        }
        if (!this.isPrerequisiteMet(step)) {
          const prereqConfig = WORKFLOW_STEPS.find((s) => s.key === stepConfig.prerequisite);
          return `请先完成「${prereqConfig?.label ?? stepConfig.prerequisite}」`;
        }
        return null;
      };
    },
  },

  actions: {
    /**
     * Set the status of a chapter
     */
    setChapterStatus(chapter: number, status: ChapterStatus): void {
      this.chapterStatuses = {
        ...this.chapterStatuses,
        [chapter]: { status },
      };
    },

    /**
     * Mark current chapter as modified (needs re-finalization)
     */
    markChapterModified(chapter: number): void {
      const current = this.chapterStatuses[chapter];
      if (current && current.status === "finalized") {
        this.chapterStatuses = {
          ...this.chapterStatuses,
          [chapter]: { status: "draft-pending", modifiedSinceFinalize: true },
        };
      }
    },

    /**
     * Mark a step as completed and advance to the next step
     */
    completeStep(step: WorkflowStep): void {
      if (!this.completedSteps.includes(step)) {
        this.completedSteps = [...this.completedSteps, step];
      }

      // Update convenience flags
      if (step === "architecture") {
        this.hasArchitecture = true;
      } else if (step === "blueprint") {
        this.hasBlueprint = true;
      } else if (step === "draft") {
        // 单章草稿生成完成，标记为草稿待定稿
        this.setChapterStatus(this.currentChapter, "draft-pending");
      }

      // Advance current step to the next available step
      const nextStep = this.nextStep;
      if (nextStep) {
        this.currentStep = nextStep;
      }
    },

    /**
     * Mark current chapter as finalized
     */
    finalizeChapter(): void {
      this.setChapterStatus(this.currentChapter, "finalized");
    },

    /**
     * Reset a step (mark as incomplete)
     */
    resetStep(step: WorkflowStep): void {
      this.completedSteps = this.completedSteps.filter((s) => s !== step);

      // Update convenience flags
      if (step === "architecture") {
        this.hasArchitecture = false;
        // Also reset dependent steps
        this.resetStep("blueprint");
      } else if (step === "blueprint") {
        this.hasBlueprint = false;
        // Also reset dependent steps
        this.resetStep("draft");
      } else if (step === "draft") {
        // Clear all chapter statuses when resetting draft
        this.chapterStatuses = {};
      }
    },

    /**
     * Set the current chapter number
     */
    setCurrentChapter(chapter: number): void {
      this.currentChapter = Math.max(1, Math.min(chapter, this.totalChapters));
    },

    /**
     * Set the total number of chapters
     */
    setTotalChapters(total: number): void {
      this.totalChapters = Math.max(1, total);
      // Ensure current chapter doesn't exceed total
      if (this.currentChapter > this.totalChapters) {
        this.currentChapter = this.totalChapters;
      }
    },

    /**
     * Increment chapter number (after draft/finalize completion)
     */
    incrementChapter(): boolean {
      if (this.currentChapter < this.totalChapters) {
        this.currentChapter++;
        // Reset draft step for the new chapter (keep blueprint and architecture)
        this.completedSteps = this.completedSteps.filter(
          (s) => s !== "draft"
        );
        this.currentStep = "draft";
        return true;
      }
      return false; // Already at last chapter
    },

    /**
     * Initialize workflow state from project data
     */
    initializeFromProject(projectData: {
      hasArchitecture?: boolean;
      hasBlueprint?: boolean;
      hasDraft?: boolean;
      hasFinalize?: boolean;
      totalChapters?: number;
      currentChapter?: number;
      chapterStatuses?: Record<number, ChapterState>;
    }): void {
      const hasDraft = projectData.hasDraft ?? false;
      const hasFinalize = projectData.hasFinalize ?? false;
      const hasBlueprint = projectData.hasBlueprint ?? false;
      const hasArchitecture = projectData.hasArchitecture ?? false;

      this.hasBlueprint = hasBlueprint || hasDraft || hasFinalize;
      this.hasArchitecture = hasArchitecture || this.hasBlueprint;
      this.totalChapters = projectData.totalChapters ?? 10;
      this.currentChapter = projectData.currentChapter ?? 1;

      // Restore chapter statuses if provided
      if (projectData.chapterStatuses) {
        this.chapterStatuses = { ...projectData.chapterStatuses };
      }

      // Rebuild completed steps based on flags
      this.completedSteps = [];
      if (this.hasArchitecture) {
        this.completedSteps.push("architecture");
      }
      if (this.hasBlueprint) {
        this.completedSteps.push("blueprint");
      }
      if (hasDraft) {
        this.completedSteps.push("draft");
      }

      // Set current step to the next available
      const nextStep = this.nextStep;
      if (nextStep) {
        this.currentStep = nextStep;
      } else if (this.completedSteps.length) {
        this.currentStep = WORKFLOW_STEPS[WORKFLOW_STEPS.length - 1].key;
      } else {
        this.currentStep = "architecture";
      }
    },

    /**
     * Reset all workflow state
     */
    reset(): void {
      this.currentStep = "architecture";
      this.completedSteps = [];
      this.hasArchitecture = false;
      this.hasBlueprint = false;
      this.currentChapter = 1;
      this.chapterStatuses = {};
    },
  },
});

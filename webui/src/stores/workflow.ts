import { defineStore } from "pinia";

export type WorkflowStep = "architecture" | "blueprint" | "draft" | "finalize";

export interface StepConfig {
  key: WorkflowStep;
  label: string;
  icon: string;
  prerequisite?: WorkflowStep;
}

export const WORKFLOW_STEPS: StepConfig[] = [
  { key: "architecture", label: "架构生成", icon: "building" },
  { key: "blueprint", label: "蓝图生成", icon: "map", prerequisite: "architecture" },
  { key: "draft", label: "草稿生成", icon: "edit", prerequisite: "blueprint" },
  { key: "finalize", label: "定稿", icon: "check", prerequisite: "draft" },
];

export interface WorkflowState {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  hasArchitecture: boolean;
  hasBlueprint: boolean;
  currentChapter: number;
  totalChapters: number;
}

/**
 * Compute which buttons should be disabled based on workflow state
 */
export function computeButtonStates(state: {
  hasArchitecture: boolean;
  hasBlueprint: boolean;
  hasDraft?: boolean;
}): {
  architectureDisabled: boolean;
  blueprintDisabled: boolean;
  draftDisabled: boolean;
  finalizeDisabled: boolean;
} {
  return {
    architectureDisabled: false, // Architecture can always be generated
    blueprintDisabled: !state.hasArchitecture,
    draftDisabled: !state.hasBlueprint,
    finalizeDisabled: !state.hasDraft, // Finalize requires a draft chapter
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
     * Get button disabled states
     */
    buttonStates(state): ReturnType<typeof computeButtonStates> {
      return computeButtonStates({
        hasArchitecture: state.hasArchitecture,
        hasBlueprint: state.hasBlueprint,
        hasDraft: state.completedSteps.includes("draft"),
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
      }

      // Advance current step to the next available step
      const nextStep = this.nextStep;
      if (nextStep) {
        this.currentStep = nextStep;
      }
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
        this.resetStep("finalize");
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
        // Reset draft and finalize for the new chapter
        this.completedSteps = this.completedSteps.filter(
          (s) => s !== "draft" && s !== "finalize"
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
    }): void {
      const hasDraft = projectData.hasDraft ?? false;
      const hasFinalize = projectData.hasFinalize ?? false;
      const hasBlueprint = projectData.hasBlueprint ?? false;
      const hasArchitecture = projectData.hasArchitecture ?? false;

      this.hasBlueprint = hasBlueprint || hasDraft || hasFinalize;
      this.hasArchitecture = hasArchitecture || this.hasBlueprint;
      this.totalChapters = projectData.totalChapters ?? 10;
      this.currentChapter = projectData.currentChapter ?? 1;

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
      if (hasFinalize && hasDraft) {
        this.completedSteps.push("finalize");
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
    },
  },
});

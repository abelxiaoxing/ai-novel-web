<template>
  <div class="step-indicator">
    <div
      v-for="(step, index) in steps"
      :key="step.key"
      class="step"
      :class="{
        'step--completed': isCompleted(step.key),
        'step--current': isCurrent(step.key),
        'step--disabled': !isAvailable(step.key),
      }"
    >
      <div
        class="step-circle"
        :title="getTooltip(step.key)"
        @mouseenter="showTooltip(step.key, $event)"
        @mouseleave="hideTooltip"
      >
        <span v-if="isCompleted(step.key)" class="step-icon">✓</span>
        <span v-else class="step-number">{{ index + 1 }}</span>
      </div>
      <span class="step-label">{{ step.label }}</span>
      <div v-if="index < steps.length - 1" class="step-connector" />
    </div>
    <!-- Tooltip -->
    <div
      v-if="tooltipVisible && tooltipText"
      class="step-tooltip"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    >
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { WORKFLOW_STEPS, type WorkflowStep } from "@/stores/workflow";

const props = defineProps<{
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
}>();

const steps = computed(() => WORKFLOW_STEPS);

// Tooltip state
const tooltipVisible = ref(false);
const tooltipText = ref<string | null>(null);
const tooltipX = ref(0);
const tooltipY = ref(0);

const isCompleted = (step: WorkflowStep): boolean => {
  return props.completedSteps.includes(step);
};

const isCurrent = (step: WorkflowStep): boolean => {
  return props.currentStep === step;
};

const isAvailable = (step: WorkflowStep): boolean => {
  const stepConfig = WORKFLOW_STEPS.find((s) => s.key === step);
  if (!stepConfig?.prerequisite) {
    return true;
  }
  return props.completedSteps.includes(stepConfig.prerequisite);
};

const getTooltip = (step: WorkflowStep): string | undefined => {
  if (!isAvailable(step)) {
    const stepConfig = WORKFLOW_STEPS.find((s) => s.key === step);
    if (stepConfig?.prerequisite) {
      const prereqConfig = WORKFLOW_STEPS.find((s) => s.key === stepConfig.prerequisite);
      return `请先完成「${prereqConfig?.label ?? stepConfig.prerequisite}」`;
    }
  }
  return undefined;
};

const showTooltip = (step: WorkflowStep, event: MouseEvent) => {
  const text = getTooltip(step);
  if (text) {
    tooltipText.value = text;
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const parentRect = target.closest(".step-indicator")?.getBoundingClientRect();
    if (parentRect) {
      tooltipX.value = rect.left - parentRect.left + rect.width / 2;
      tooltipY.value = rect.bottom - parentRect.top + 8;
    }
    tooltipVisible.value = true;
  }
};

const hideTooltip = () => {
  tooltipVisible.value = false;
  tooltipText.value = null;
};
</script>

<style scoped>
.step-indicator {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 12px;
  position: relative;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  flex: 1;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  background: rgba(126, 91, 255, 0.08);
  border: 2px solid rgba(126, 91, 255, 0.25);
  color: var(--text-muted);
  transition: all 0.3s ease;
  cursor: default;
  position: relative;
  z-index: 2;
}

.step-number {
  font-size: 12px;
}

.step-icon {
  font-size: 14px;
}

.step-label {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  white-space: nowrap;
  transition: color 0.3s ease;
}

.step-connector {
  position: absolute;
  top: 16px;
  left: calc(50% + 20px);
  width: calc(100% - 40px);
  height: 2px;
  background: rgba(126, 91, 255, 0.15);
  z-index: 1;
}

/* Completed state */
.step--completed .step-circle {
  background: linear-gradient(135deg, var(--success), #16a34a);
  border-color: var(--success);
  color: white;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.step--completed .step-label {
  color: var(--success);
}

.step--completed .step-connector {
  background: var(--success);
}

/* Current state */
.step--current .step-circle {
  background: linear-gradient(135deg, var(--accent), #5d3bff);
  border-color: var(--accent);
  color: white;
  box-shadow: 0 4px 12px rgba(126, 91, 255, 0.35);
  animation: pulse 2s ease-in-out infinite;
}

.step--current .step-label {
  color: var(--accent-bright);
  font-weight: 600;
}

/* Disabled state */
.step--disabled .step-circle {
  background: rgba(15, 11, 22, 0.45);
  border-color: rgba(229, 225, 245, 0.1);
  color: rgba(185, 176, 214, 0.4);
  cursor: help;
}

.step--disabled .step-label {
  color: rgba(185, 176, 214, 0.4);
}

/* Tooltip */
.step-tooltip {
  position: absolute;
  background: var(--panel-strong);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  transform: translateX(-50%);
  z-index: 100;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.step-tooltip::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid var(--panel-border);
}

.step-tooltip::after {
  content: "";
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid var(--panel-strong);
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 4px 12px rgba(126, 91, 255, 0.35);
  }
  50% {
    box-shadow: 0 4px 20px rgba(126, 91, 255, 0.5);
  }
}
</style>

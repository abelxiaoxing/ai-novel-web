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
        'step--clickable': isAvailable(step.key),
      }"
      @click="handleClick(step.key)"
    >
      <div class="step-circle" :title="getTooltip(step.key)">
        <span v-if="isCompleted(step.key)" class="step-icon">✓</span>
        <span v-else class="step-number">{{ index + 1 }}</span>
      </div>
      <span class="step-label">{{ step.label }}</span>
      <div v-if="index < steps.length - 1" class="step-connector" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { WORKFLOW_STEPS, type WorkflowStep } from "@/stores/workflow";

const props = defineProps<{
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
}>();

const emit = defineEmits<{
  (event: "step-click", step: WorkflowStep): void;
}>();

const steps = computed(() => WORKFLOW_STEPS);

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

const handleClick = (step: WorkflowStep) => {
  if (isAvailable(step)) {
    emit("step-click", step);
  }
};
</script>

<style scoped>
.step-indicator {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  min-height: 36px;
  padding: 7px 9px;
  border-radius: 9px;
  border: 1px solid rgba(125, 186, 233, 0.16);
  background: rgba(7, 18, 30, 0.42);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.step-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: rgba(47, 155, 255, 0.14);
  border: 1px solid rgba(125, 186, 233, 0.32);
  color: var(--text-muted);
  transition: all 0.2s ease;
  cursor: default;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.step-number {
  font-size: 12px;
}

.step-icon {
  font-size: 12px;
}

.step-label {
  font-size: 12px;
  color: var(--text-muted);
  text-align: left;
  line-height: 1.2;
  white-space: normal;
  transition: color 0.3s ease;
  min-width: 0;
}

.step-connector {
  position: absolute;
  left: 19px;
  bottom: -9px;
  width: 2px;
  height: 10px;
  background: rgba(125, 186, 233, 0.2);
  z-index: 0;
}

.step--completed .step-circle {
  background: linear-gradient(135deg, var(--success), #16a34a);
  border-color: var(--success);
  color: white;
  box-shadow: 0 4px 10px rgba(34, 197, 94, 0.25);
}

.step--completed {
  border-color: rgba(34, 197, 94, 0.36);
  background: rgba(34, 197, 94, 0.08);
}

.step--completed .step-label {
  color: var(--success);
}

.step--completed .step-connector {
  background: rgba(34, 197, 94, 0.45);
}

.step--current .step-circle {
  background: linear-gradient(135deg, #2f9bff, #5dc4ff);
  border-color: rgba(125, 186, 233, 0.95);
  color: white;
  box-shadow: 0 2px 10px rgba(47, 155, 255, 0.35);
  animation: pulse 2s ease-in-out infinite;
}

.step--current .step-label {
  color: var(--accent-bright);
  font-weight: 600;
}

.step--current {
  border-color: rgba(125, 186, 233, 0.5);
  background: linear-gradient(180deg, rgba(47, 155, 255, 0.18) 0%, rgba(9, 23, 38, 0.58) 100%);
  box-shadow: 0 8px 16px rgba(4, 14, 24, 0.3);
}

.step--disabled .step-circle {
  background: rgba(7, 18, 30, 0.7);
  border-color: rgba(125, 186, 233, 0.14);
  color: rgba(139, 163, 199, 0.55);
  cursor: not-allowed;
}

.step--disabled .step-label {
  color: rgba(139, 163, 199, 0.5);
}

.step--disabled {
  border-color: rgba(125, 186, 233, 0.1);
  background: rgba(7, 18, 30, 0.28);
}

.step--clickable {
  cursor: pointer;
}

.step--clickable:hover {
  transform: translateY(-1px);
  border-color: rgba(125, 186, 233, 0.4);
  background: rgba(47, 155, 255, 0.12);
}

.step--clickable:hover .step-circle {
  border-color: rgba(125, 186, 233, 0.6);
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 2px 10px rgba(47, 155, 255, 0.35);
  }
  50% {
    box-shadow: 0 2px 16px rgba(47, 155, 255, 0.52);
  }
}
</style>

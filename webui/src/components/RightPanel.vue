<template>
  <aside class="right-panel panel" :class="{ 'right-panel--collapsed': !rightPanelVisible }">
    <button v-if="rightPanelVisible" class="panel-collapse-btn panel-collapse-btn--left" type="button" @click="$emit('toggle')" title="收缩">
      <span>▶</span>
    </button>
    <button v-else class="panel-expand-btn panel-expand-btn--right" type="button" @click="$emit('toggle')" title="展开生成控制">
      <span>◀</span>
    </button>
    <div class="panel-header">
      <div class="panel-title">生成控制</div>
      <span class="muted">第 {{ workflowStore.currentChapter }}/{{ workflowStore.totalChapters }} 章</span>
    </div>
    <div v-show="rightPanelVisible" class="right-panel-body">
      <StepIndicator
      :current-step="currentStepForIndicator"
      :completed-steps="workflowStore.completedSteps"
      @step-click="handleStepClick"
    />

    <!-- Step 1: 架构生成 -->
    <div class="step-section" :class="{ 'step-section--active': activeStep === 'architecture' }">
      <button class="step-header" @click="toggleStep('architecture')">
        <span class="step-header-title">
          <span class="step-num">1</span>
          架构生成
          <span v-if="workflowStore.completedSteps.includes('architecture')" class="step-done">✓</span>
        </span>
        <span class="chevron">{{ activeStep === 'architecture' ? '▾' : '▸' }}</span>
      </button>
      <div v-if="activeStep === 'architecture'" class="step-body">
        <div class="field-row">
          <label class="field">
            <span class="field-label">
              章节数 <span class="required">*</span>
            </span>
            <input class="input-field" type="number" :value="form.numberOfChapters" @input="update('numberOfChapters', $event)" />
          </label>
          <label class="field">
            <span class="field-label">
              每章字数 <span class="required">*</span>
            </span>
            <input class="input-field" type="number" :value="form.wordNumber" @input="update('wordNumber', $event)" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">
            创作指导
            <span class="optional">(可选)</span>
            <HelpTooltip text="对小说风格、情节走向的额外要求" />
          </span>
          <textarea class="textarea-field" rows="2" :value="form.userGuidance" @input="update('userGuidance', $event)" placeholder="例：主角性格要沉稳，不要后宫"></textarea>
        </label>
        <div class="action-row">
          <button class="btn btn-outline" @click="$emit('run', 'architecture')">生成架构</button>
        </div>
      </div>
    </div>

    <!-- Step 2: 蓝图生成 -->
    <div class="step-section" :class="{ 'step-section--active': activeStep === 'blueprint', 'step-section--disabled': !workflowStore.hasArchitecture }">
      <button class="step-header" @click="toggleStep('blueprint')" :disabled="!workflowStore.hasArchitecture">
        <span class="step-header-title">
          <span class="step-num">2</span>
          章节蓝图
          <span v-if="workflowStore.completedSteps.includes('blueprint')" class="step-done">✓</span>
        </span>
        <span class="chevron">{{ activeStep === 'blueprint' ? '▾' : '▸' }}</span>
      </button>
      <div v-if="activeStep === 'blueprint'" class="step-body">
        <p class="step-hint">基于架构自动生成每章的情节大纲</p>
        <label class="field">
          <span class="field-label">
            蓝图指导
            <span class="optional">(可选)</span>
          </span>
          <textarea class="textarea-field" rows="2" :value="form.userGuidance" @input="update('userGuidance', $event)" placeholder="对章节安排的额外要求"></textarea>
        </label>
        <div class="action-row">
          <button class="btn btn-outline" :disabled="buttonStates.blueprintDisabled" @click="$emit('run', 'blueprint')">生成章节蓝图</button>
        </div>
      </div>
    </div>

    <!-- Step 3: 章节生成 -->
    <div class="step-section" :class="{ 'step-section--active': activeStep === 'draft', 'step-section--disabled': !workflowStore.hasBlueprint }">
      <button class="step-header" @click="toggleStep('draft')" :disabled="!workflowStore.hasBlueprint">
        <span class="step-header-title">
          <span class="step-num">3</span>
          章节生成
          <span v-if="workflowStore.completedSteps.includes('draft')" class="step-done">✓</span>
        </span>
        <span class="chevron">{{ activeStep === 'draft' ? '▾' : '▸' }}</span>
      </button>
      <div v-if="activeStep === 'draft'" class="step-body">
        <!-- 章节状态显示 -->
        <div class="chapter-status-row">
          <span class="chapter-status-label">当前：第 {{ form.chapterNumber }} 章 / 共 {{ workflowStore.totalChapters }} 章</span>
          <span class="chapter-status-badge" :class="`status-badge--${workflowStore.getChapterStatusLabel.variant}`">
            {{ workflowStore.getChapterStatusLabel.label }}
          </span>
        </div>

        <div class="field-row">
          <label class="field">
            <span class="field-label">章节号</span>
            <div class="chapter-input-wrapper">
              <button class="chapter-btn" @click="changeChapter(-1)" title="上一章">◀</button>
              <input class="input-field chapter-input" type="number" :value="form.chapterNumber" @input="update('chapterNumber', $event)" />
              <button class="chapter-btn" @click="changeChapter(1)" title="下一章">▶</button>
            </div>
          </label>
        </div>
        <button class="btn btn-ghost btn-preview-prompt" @click="$emit('run', 'preview-prompt')">预览/编辑提示词</button>

        <!-- 主要操作按钮 -->
        <div class="action-row action-row--primary">
          <button
            class="btn btn-outline"
            :disabled="buttonStates.draftDisabled"
            :title="buttonStates.draftDisabledReason || ''"
            @click="$emit('run', 'draft')"
          >生成草稿</button>
          <button
            class="btn btn-outline"
            :disabled="buttonStates.finalizeDisabled"
            :title="buttonStates.finalizeDisabledReason || ''"
            @click="$emit('run', 'finalize')"
          >确认定稿</button>
        </div>

        <!-- 批量生成选项 -->
        <div class="field-row batch-range-row">
          <label class="field batch-range-field">
            <span class="field-label">批量到第</span>
            <input class="input-field batch-end-input" type="number" :value="form.batchEndChapter" @input="update('batchEndChapter', $event)" />
          </label>
          <span class="batch-hint">章</span>
        </div>

        <!-- 批量生成按钮 -->
        <div class="action-row">
          <button
            class="btn btn-ghost"
            :disabled="workflowStore.hasAnyPendingDraft"
            :title="workflowStore.hasAnyPendingDraft ? '请先完成定稿' : ''"
            @click="$emit('run', 'batch')"
          >批量生成</button>
        </div>
      </div>
    </div>

    <!-- 工具区 (折叠) -->
    <div class="section tools-section">
      <button class="section-toggle" type="button" @click="toolsOpen = !toolsOpen">
        <span>工具 / 配置</span>
        <span class="chevron">{{ toolsOpen ? '▾' : '▸' }}</span>
      </button>
      <div v-if="toolsOpen" class="section-body">
        <input ref="fileInput" type="file" class="file-input" @change="handleFile" />
        <div class="action-row">
          <button class="btn btn-ghost" @click="openFilePicker">导入知识库</button>
          <button class="btn btn-ghost" @click="$emit('manage-vectorstore')">管理向量库</button>
        </div>
      </div>
    </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useWorkflowStore, type WorkflowStep } from "@/stores/workflow";
import StepIndicator from "./StepIndicator.vue";
import HelpTooltip from "./HelpTooltip.vue";

export type WorkbenchForm = {
  topic: string;
  genre: string;
  numberOfChapters: string;
  wordNumber: string;
  userGuidance: string;
  chapterNumber: string;
  charactersInvolved: string;
  keyItems: string;
  sceneLocation: string;
  timeConstraint: string;
  llmConfigName: string;
  embeddingConfigName: string;
  batchEndChapter: string;
};

const props = defineProps<{
  form: WorkbenchForm;
  rightPanelVisible?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:form", payload: WorkbenchForm): void;
  (event: "run", action: string): void;
  (event: "next-chapter"): void;
  (event: "import-knowledge", file: File): void;
  (event: "manage-vectorstore"): void;
  (event: "toggle"): void;
}>();

const workflowStore = useWorkflowStore();
const fileInput = ref<HTMLInputElement | null>(null);

// 当前展开的步骤
const activeStep = ref<WorkflowStep | null>(null);

// 初始化为当前步骤
watch(() => workflowStore.currentStep, (newStep) => {
  activeStep.value = newStep;
}, { immediate: true });

const toolsOpen = ref(false);

// 确保 StepIndicator 的 currentStep 不为 null
const currentStepForIndicator = computed(() => activeStep.value ?? workflowStore.currentStep);

const buttonStates = computed(() => workflowStore.buttonStates);

const toggleStep = (step: WorkflowStep) => {
  activeStep.value = activeStep.value === step ? null : step;
};

const handleStepClick = (step: WorkflowStep) => {
  activeStep.value = step;
};

const update = (field: keyof WorkbenchForm, event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const next = { ...props.form, [field]: target.value };
  emit("update:form", next);
};

const changeChapter = (delta: number) => {
  const current = Number(props.form.chapterNumber) || 1;
  const next = { ...props.form, chapterNumber: String(Math.max(1, current + delta)) };
  emit("update:form", next);
};

const openFilePicker = () => {
  fileInput.value?.click();
};

const handleFile = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    emit("import-knowledge", file);
  }
  target.value = "";
};
</script>

<style scoped>
.right-panel {
  grid-column: 3 / 4;
  grid-row: 2 / 4;
  display: flex;
  flex-direction: column;
  overflow: visible;
  position: relative;
}

.right-panel--collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  border: none;
}

.right-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-toggle {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
}

.panel-toggle:hover {
  background: rgba(126, 91, 255, 0.1);
  color: var(--accent-bright);
}

.panel-toggle-icon {
  font-size: 12px;
}

/* 步骤区块 */
.step-section {
  border-bottom: 1px solid rgba(229, 225, 245, 0.08);
}

.step-section--disabled {
  opacity: 0.5;
}

.step-section--disabled .step-header {
  cursor: not-allowed;
}

.step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text);
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: background 0.2s;
}

.step-header:hover:not(:disabled) {
  background: rgba(126, 91, 255, 0.08);
}

.step-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(126, 91, 255, 0.15);
  color: var(--accent-bright);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-section--active .step-num {
  background: var(--accent);
  color: white;
}

.step-done {
  color: var(--success);
  font-size: 14px;
}

.step-body {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  padding: 8px 12px;
  background: rgba(126, 91, 255, 0.06);
  border-radius: 6px;
}

/* 通用区块 */
.section {
  border-bottom: 1px solid rgba(229, 225, 245, 0.08);
}

.section:last-child {
  border-bottom: none;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: rgba(15, 11, 22, 0.4);
  border: 1px solid rgba(229, 225, 245, 0.08);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.chevron {
  color: var(--accent-bright);
  font-size: 12px;
  margin-left: auto;
}

/* 字段样式 */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

.required {
  color: #ef4444;
}

.optional {
  color: var(--text-muted);
  font-size: 11px;
  opacity: 0.7;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: end;
}

.action-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.btn-next-chapter {
  white-space: nowrap;
}

.chapter-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(15, 11, 22, 0.4);
  border: 1px solid rgba(229, 225, 245, 0.08);
  border-radius: 8px;
  margin-bottom: 8px;
}

.chapter-status-label {
  font-size: 13px;
  color: var(--text-muted);
}

.chapter-status-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.status-badge--success {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.status-badge--warning {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}

.status-badge--muted {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}

.action-row--primary {
  gap: 12px;
}

.action-row--primary .btn {
  flex: 1;
}

.chapter-input-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.chapter-input {
  text-align: center;
  width: 60px;
  -moz-appearance: textfield;
}

.chapter-input::-webkit-outer-spin-button,
.chapter-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.chapter-btn {
  padding: 2px 8px;
  font-size: 10px;
  color: var(--text-muted);
  border-radius: 4px;
}

.chapter-btn:hover {
  background: rgba(126, 91, 255, 0.15);
  color: var(--accent-bright);
}

.btn-preview-prompt {
  width: 100%;
  margin-top: 4px;
}

.batch-range-row {
  margin-top: 8px;
  align-items: center;
  gap: 6px;
}

.batch-range-field {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.batch-end-input {
  width: 60px;
  text-align: center;
  -moz-appearance: textfield;
}

.batch-end-input::-webkit-outer-spin-button,
.batch-end-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.batch-hint {
  font-size: 13px;
  color: var(--text-muted);
}

.tools-section {
  margin-top: auto;
  padding: 12px 16px;
}

.file-input {
  display: none;
}

</style>

<template>
  <aside class="right-panel panel" :class="{ 'right-panel--collapsed': !rightPanelVisible }">
    <button v-if="rightPanelVisible" class="panel-collapse-btn panel-collapse-btn--left" type="button" @click="$emit('toggle')" title="收缩">
      <span>▶</span>
    </button>
    <button v-else class="panel-expand-btn panel-expand-btn--right" type="button" @click="$emit('toggle')" title="展开生成控制">
      <span>◀</span>
    </button>
    <!-- 拖拽手柄 -->
    <div
      v-if="rightPanelVisible"
      class="resize-handle resize-handle--horizontal"
      :class="{ 'resize-handle--active': isResizing }"
      @mousedown="startResize"
      title="拖拽调整宽度"
    />
    <div class="panel-header">
      <div class="panel-title-wrap">
        <div class="panel-title">生成控制</div>
      </div>
    </div>
    <div v-show="rightPanelVisible" class="right-panel-body">
      <div class="chapter-focus-card">
        <div class="chapter-focus-orb" aria-label="当前章节">
          <span class="chapter-focus-prefix">第</span>
          <strong class="chapter-focus-number">{{ form.chapterNumber }}</strong>
          <span class="chapter-focus-suffix">章</span>
        </div>
        <div class="chapter-focus-meta">
          <span class="chapter-focus-total">共 {{ workflowStore.totalChapters }} 章</span>
          <span class="chapter-status-badge" :class="`status-badge--${workflowStore.getChapterStatusLabel.variant}`">
            {{ workflowStore.getChapterStatusLabel.label }}
          </span>
        </div>
      </div>

      <div class="step-indicator-shell">
        <StepIndicator
          :current-step="currentStepForIndicator"
          :completed-steps="workflowStore.completedSteps"
          @step-click="handleStepClick"
        />
      </div>

      <div class="step-section-list">
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
            <div class="field-stack">
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
            <div class="action-row action-row--single">
              <button class="btn btn-outline" @click="$emit('run', 'architecture')">生成架构</button>
            </div>
          </div>
        </div>

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
            <div class="action-row action-row--single">
              <button class="btn btn-outline" :disabled="buttonStates.blueprintDisabled" @click="$emit('run', 'blueprint')">生成蓝图</button>
            </div>
          </div>
        </div>

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
            <label class="field">
              <span class="field-label">当前章节</span>
              <div class="chapter-input-wrapper">
                <button class="chapter-btn" @click="changeChapter(-1)" title="上一章">◀</button>
                <input class="input-field chapter-input" type="number" :value="form.chapterNumber" @input="update('chapterNumber', $event)" />
                <button class="chapter-btn" @click="changeChapter(1)" title="下一章">▶</button>
              </div>
            </label>

            <button class="btn btn-ghost btn-preview-prompt" @click="$emit('run', 'preview-prompt')">编辑提示词</button>

            <div class="action-row action-row--split">
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
              >定稿</button>
            </div>

            <div class="batch-range-row">
              <span class="field-label">批量终止章</span>
              <div class="batch-range-inline">
                <input class="input-field batch-end-input" type="number" :value="form.batchEndChapter" @input="update('batchEndChapter', $event)" />
                <span class="batch-hint">章</span>
              </div>
            </div>

            <div class="action-row action-row--single">
              <button
                class="btn btn-ghost"
                :disabled="workflowStore.hasAnyPendingDraft"
                :title="workflowStore.hasAnyPendingDraft ? '请先完成定稿' : ''"
                @click="$emit('run', 'batch')"
              >批量生成</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section tools-section">
        <button class="section-toggle" type="button" @click="toolsOpen = !toolsOpen">
          <span>工具 / 配置</span>
          <span class="chevron">{{ toolsOpen ? '▾' : '▸' }}</span>
        </button>
        <div v-if="toolsOpen" class="section-body">
          <input ref="fileInput" type="file" class="file-input" @change="handleFile" />
          <div class="action-row action-row--single">
            <button class="btn btn-ghost" @click="openFilePicker">导入知识库</button>
            <button class="btn btn-ghost" @click="$emit('manage-vectorstore')">管理向量库</button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch, toRefs } from "vue";
import { useWorkflowStore, type WorkflowStep } from "@/stores/workflow";
import { usePanelStore } from "@/stores/panel";
import { useResizable } from "@/composables/useResizable";
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
const panelStore = usePanelStore();
const { rightPanelWidth } = toRefs(panelStore);
const fileInput = ref<HTMLInputElement | null>(null);

// 使用可拖拽组合式函数
const { isResizing, startResize } = useResizable({
  direction: "horizontal",
  initialSize: rightPanelWidth.value,
  minSize: 80,
  maxSize: 400,
  reverse: true,
  getCurrentSize: () => panelStore.rightPanelWidth,
  onResize: (size) => {
    panelStore.updateSize("rightPanel", size, { persist: false });
  },
  onResizeEnd: (size) => {
    panelStore.updateSize("rightPanel", size);
  },
});

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
  overflow: hidden;
  position: relative;
  background:
    linear-gradient(180deg, rgba(47, 155, 255, 0.16) 0%, rgba(15, 26, 40, 0.96) 92px, rgba(15, 26, 40, 0.98) 100%);
  border-color: rgba(95, 170, 230, 0.35);
}

.right-panel--collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  border: none;
  overflow: visible;
}

/* 收起状态下展开按钮的定位 - 显示在右侧 */
.right-panel--collapsed .panel-expand-btn--right {
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 40px;
  border-right: none;
  border-radius: 8px 0 0 8px;
}

.right-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  gap: 7px;
  padding: 7px;
}

.panel-header {
  justify-content: flex-start;
  align-items: center;
  padding: 11px 9px 9px;
  border-bottom: 1px solid rgba(125, 186, 233, 0.2);
}

.panel-title-wrap {
  display: flex;
  align-items: center;
}

.chapter-focus-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  border: 1px solid rgba(125, 186, 233, 0.24);
  border-radius: 12px;
  padding: 8px;
  background:
    radial-gradient(circle at 22% 18%, rgba(93, 196, 255, 0.22), transparent 52%),
    linear-gradient(175deg, rgba(10, 28, 45, 0.88), rgba(7, 17, 30, 0.72));
  box-shadow: inset 0 1px 0 rgba(125, 186, 233, 0.2);
}

.chapter-focus-orb {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(125, 186, 233, 0.46);
  background:
    radial-gradient(circle at 24% 20%, rgba(132, 220, 255, 0.4), rgba(47, 155, 255, 0.18) 38%, rgba(7, 18, 30, 0.92) 100%);
  box-shadow:
    0 4px 14px rgba(5, 18, 30, 0.4),
    inset 0 0 0 1px rgba(132, 220, 255, 0.14);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.chapter-focus-prefix,
.chapter-focus-suffix {
  font-size: 10px;
  line-height: 1;
  color: var(--text-muted);
}

.chapter-focus-number {
  font-size: 19px;
  line-height: 1;
  color: #ecf5ff;
  font-variant-numeric: tabular-nums;
}

.chapter-focus-meta {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.chapter-focus-total {
  font-size: 12px;
  color: var(--text-muted);
}

.step-indicator-shell {
  border: 1px solid rgba(125, 186, 233, 0.22);
  border-radius: 11px;
  background: rgba(7, 18, 30, 0.5);
}

.step-indicator-shell :deep(.step-indicator) {
  padding: 7px 8px;
}

.step-section-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-section {
  border: 1px solid rgba(125, 186, 233, 0.21);
  border-radius: 11px;
  background: linear-gradient(180deg, rgba(8, 22, 36, 0.8) 0%, rgba(7, 17, 30, 0.56) 100%);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.step-section--active {
  border-color: rgba(125, 186, 233, 0.45);
  box-shadow: 0 8px 20px rgba(5, 15, 26, 0.35);
}

.step-section--disabled {
  opacity: 0.6;
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
  padding: 9px;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: background 0.2s;
}

.step-header:hover:not(:disabled) {
  background: rgba(67, 156, 255, 0.2);
}

.step-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(47, 155, 255, 0.16);
  color: var(--accent-bright);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-section--active .step-num {
  background: linear-gradient(135deg, #2f9bff, #5dc4ff);
  color: white;
}

.step-done {
  color: var(--success);
  font-size: 14px;
  margin-left: auto;
}

.step-body {
  padding: 0 9px 10px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.step-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  padding: 8px 9px;
  background: rgba(47, 155, 255, 0.08);
  border: 1px solid rgba(125, 186, 233, 0.18);
  border-radius: 8px;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: rgba(49, 129, 227, 0.22);
  border: 1px solid rgba(135, 199, 252, 0.48);
  color: #edf7ff;
  padding: 8px;
  border-radius: 9px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.section-toggle:hover {
  background: rgba(63, 150, 255, 0.32);
  border-color: rgba(170, 220, 255, 0.72);
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  gap: 5px;
}

.field-label {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.field-stack {
  display: grid;
  gap: 7px;
}

.action-row {
  display: grid;
  gap: 8px;
  margin-top: 2px;
}

.action-row--single {
  grid-template-columns: 1fr;
}

.action-row--split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.action-row .btn {
  width: 100%;
  line-height: 1.3;
  white-space: normal;
}

.input-field,
.textarea-field {
  padding: 8px 9px;
  border-color: rgba(125, 186, 233, 0.22);
  background: rgba(7, 18, 30, 0.55);
}

.input-field:focus,
.textarea-field:focus {
  border-color: rgba(125, 186, 233, 0.62);
}

.textarea-field {
  min-height: 70px;
}

.chapter-status-badge {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 600;
  justify-self: start;
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

.chapter-input-wrapper {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 6px;
}

.chapter-input {
  text-align: center;
  width: 100%;
  -moz-appearance: textfield;
}

.chapter-input::-webkit-outer-spin-button,
.chapter-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.chapter-btn {
  padding: 0;
  height: 36px;
  border: 1px solid rgba(139, 202, 252, 0.52);
  background: rgba(43, 123, 212, 0.3);
  font-size: 12px;
  color: #eaf6ff;
  border-radius: 8px;
  width: 100%;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.chapter-btn:hover {
  background: rgba(71, 156, 250, 0.42);
  border-color: rgba(178, 224, 255, 0.76);
  color: #ffffff;
}

.btn-preview-prompt {
  width: 100%;
  margin-top: 0;
}

.batch-range-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.batch-range-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.batch-end-input {
  width: 72px;
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

.section {
  border: 1px solid rgba(125, 186, 233, 0.2);
  border-radius: 11px;
  background: rgba(7, 18, 30, 0.5);
  padding: 7px;
}

.tools-section {
  margin-top: auto;
}

.file-input {
  display: none;
}

</style>

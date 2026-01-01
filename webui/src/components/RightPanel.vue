<template>
  <aside class="right-panel panel">
    <div class="panel-header">
      <div class="panel-title">生成控制</div>
      <span class="muted">步骤 1-4</span>
    </div>
    <div class="section">
      <div class="section-title">项目基础</div>
      <label class="field">
        <span class="field-label">主题</span>
        <input class="input-field" :value="form.topic" @input="update('topic', $event)" />
      </label>
      <label class="field">
        <span class="field-label">题材类型</span>
        <input class="input-field" :value="form.genre" @input="update('genre', $event)" />
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">章节数</span>
          <input
            class="input-field"
            type="number"
            :value="form.numberOfChapters"
            @input="update('numberOfChapters', $event)"
          />
        </label>
        <label class="field">
          <span class="field-label">目标字数</span>
          <input class="input-field" type="number" :value="form.wordNumber" @input="update('wordNumber', $event)" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">用户指导</span>
        <textarea class="textarea-field" rows="3" :value="form.userGuidance" @input="update('userGuidance', $event)"></textarea>
      </label>
      <div class="action-row">
        <button class="btn btn-primary" @click="$emit('run', 'architecture')">生成架构</button>
        <button class="btn btn-ghost" @click="$emit('run', 'blueprint')">生成目录</button>
      </div>
    </div>
    <div class="section">
      <div class="section-title">章节草稿</div>
      <label class="field">
        <span class="field-label">章节号</span>
        <input class="input-field" type="number" :value="form.chapterNumber" @input="update('chapterNumber', $event)" />
      </label>
      <label class="field">
        <span class="field-label">核心人物</span>
        <input class="input-field" :value="form.charactersInvolved" @input="update('charactersInvolved', $event)" />
      </label>
      <label class="field">
        <span class="field-label">关键道具</span>
        <input class="input-field" :value="form.keyItems" @input="update('keyItems', $event)" />
      </label>
      <label class="field">
        <span class="field-label">场景</span>
        <input class="input-field" :value="form.sceneLocation" @input="update('sceneLocation', $event)" />
      </label>
      <label class="field">
        <span class="field-label">时间约束</span>
        <input class="input-field" :value="form.timeConstraint" @input="update('timeConstraint', $event)" />
      </label>
      <div class="action-row">
        <button class="btn btn-ghost" @click="$emit('run', 'build-prompt')">构建提示词</button>
        <button class="btn btn-primary" @click="$emit('run', 'draft')">生成草稿</button>
      </div>
    </div>
    <div class="section">
      <div class="section-title">定稿与模型</div>
      <label class="field">
        <span class="field-label">大模型配置</span>
        <select class="select-field" :value="form.llmConfigName" @change="update('llmConfigName', $event)">
          <option v-for="name in llmOptions" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">向量配置</span>
        <select
          class="select-field"
          :value="form.embeddingConfigName"
          @change="update('embeddingConfigName', $event)"
        >
          <option v-for="name in embeddingOptions" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <div class="action-row">
        <button class="btn btn-ghost" @click="$emit('run', 'finalize')">章节定稿</button>
        <button class="btn btn-outline" @click="$emit('run', 'consistency')">一致性检查</button>
      </div>
    </div>
    <div class="section">
      <div class="section-title">工具</div>
      <input ref="fileInput" type="file" class="file-input" @change="handleFile" />
      <div class="action-row">
        <button class="btn btn-ghost" @click="openFilePicker">导入知识库</button>
        <button class="btn btn-outline" @click="$emit('clear-vectorstore')">清空向量库</button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from "vue";

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
};

const props = defineProps<{
  form: WorkbenchForm;
  llmOptions: string[];
  embeddingOptions: string[];
}>();

const emit = defineEmits<{
  (event: "update:form", payload: WorkbenchForm): void;
  (event: "run", action: string): void;
  (event: "import-knowledge", file: File): void;
  (event: "clear-vectorstore"): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const update = (field: keyof WorkbenchForm, event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const next = { ...props.form, [field]: target.value };
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
  grid-column: 4 / 5;
  grid-row: 2 / 4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section {
  border-bottom: 1px solid rgba(229, 225, 245, 0.08);
}

.section:last-child {
  border-bottom: none;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.action-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.file-input {
  display: none;
}
</style>

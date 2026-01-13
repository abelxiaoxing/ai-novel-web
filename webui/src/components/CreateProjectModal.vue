<template>
  <ModalShell @close="$emit('close')">
    <div class="modal-header">
      <h2>新建项目</h2>
      <p class="muted">填写核心参数，创建新的世界。</p>
    </div>
    <div class="modal-form">
      <label class="field">
        <span class="field-label">主题</span>
        <input class="input-field" v-model="form.topic" placeholder="例：废柴逆袭成为最强" />
      </label>
      <label class="field">
        <span class="field-label">题材类型</span>
        <input class="input-field" v-model="form.genre" />
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">章节数</span>
          <input class="input-field" type="number" v-model="form.num_chapters" />
        </label>
        <label class="field">
          <span class="field-label">目标字数</span>
          <input class="input-field" type="number" v-model="form.word_number" />
        </label>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" @click="$emit('close')">取消</button>
      <button class="btn btn-primary" @click="submit">创建</button>
    </div>
  </ModalShell>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import ModalShell from "@/components/ModalShell.vue";

const form = reactive({
  topic: "",
  genre: "",
  num_chapters: "",
  word_number: "",
});

const emit = defineEmits<{
  (event: "submit", payload: Record<string, string>): void;
  (event: "close"): void;
}>();

const submit = () => {
  emit("submit", { ...form, name: form.topic });
};
</script>

<style scoped>
.modal-header h2 {
  margin: 0 0 6px 0;
}

.modal-form {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
</style>

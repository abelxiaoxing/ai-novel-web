<template>
  <ModalShell @close="$emit('close')">
    <div class="modal-header">
      <h2>编辑提示词</h2>
      <p class="muted">生成草稿前，请确认提示词内容。</p>
    </div>
    <textarea class="prompt-editor" v-model="localValue"></textarea>
    <div class="modal-actions">
      <button class="btn btn-outline" @click="$emit('close')">取消</button>
      <button class="btn btn-primary" @click="confirm">使用提示词</button>
    </div>
  </ModalShell>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import ModalShell from "@/components/ModalShell.vue";

const props = defineProps<{ content: string }>();
const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm", value: string): void;
}>();

const localValue = ref(props.content);

watch(
  () => props.content,
  (value) => {
    localValue.value = value;
  }
);

const confirm = () => {
  emit("confirm", localValue.value);
};
</script>

<style scoped>
:deep(.modal-panel) {
  width: 94vw;
  height: 92vh;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.prompt-editor {
  margin-top: 16px;
  width: 100%;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  border: 1px solid rgba(229, 225, 245, 0.12);
  background: rgba(12, 10, 18, 0.75);
  color: var(--text);
  padding: 14px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.modal-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

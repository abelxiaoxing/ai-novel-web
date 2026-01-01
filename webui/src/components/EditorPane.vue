<template>
  <section class="editor panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">{{ title }}</div>
        <div class="muted">{{ subtitle }}</div>
      </div>
      <div class="editor-meta">
        <span class="muted">{{ charCount }} 字</span>
        <button class="btn btn-outline" @click="$emit('save')">保存</button>
      </div>
    </div>
    <div class="editor-body">
      <textarea
        class="editor-textarea"
        :value="content"
        @input="$emit('update:content', ($event.target as HTMLTextAreaElement).value)"
        spellcheck="false"
      ></textarea>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  title: string;
  subtitle?: string;
  content: string;
}>();

defineEmits(["update:content", "save"]);

const charCount = computed(() => props.content.length);
</script>

<style scoped>
.editor {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-body {
  flex: 1;
  padding: 12px;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(229, 225, 245, 0.12);
  border-radius: 12px;
  background: rgba(12, 10, 18, 0.65);
  color: var(--text);
  padding: 14px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  outline: none;
}
</style>

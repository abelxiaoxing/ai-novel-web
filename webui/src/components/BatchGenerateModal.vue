<template>
  <ModalShell @close="$emit('close')">
    <div class="modal-header">
      <h2>批量生成</h2>
      <p class="muted">设置起止章节与生成间隔，系统会依次完成草稿。</p>
    </div>
    <div class="modal-body">
      <div v-if="!running" class="form-grid">
        <label class="field">
          <span class="field-label">起始章节</span>
          <input class="input-field" type="number" v-model="form.start" min="1" />
        </label>
        <label class="field">
          <span class="field-label">结束章节</span>
          <input class="input-field" type="number" v-model="form.end" min="1" />
        </label>
        <label class="field">
          <span class="field-label">章节间隔（秒）</span>
          <input class="input-field" type="number" v-model="form.delay" min="0" step="0.5" />
        </label>
        <p v-if="formError" class="form-error">{{ formError }}</p>
      </div>
      <div v-else class="running-hint">
        <p class="muted">批量生成进行中，进度显示在页面顶部。您可以关闭此窗口继续操作界面。</p>
      </div>
      <div v-if="summary" class="summary-box">{{ summary }}</div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" @click="submit" :disabled="running">开始生成</button>
      <button class="btn btn-outline" @click="$emit('close')">{{ running ? '最小化' : '关闭' }}</button>
    </div>
  </ModalShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import ModalShell from "@/components/ModalShell.vue";

const props = defineProps<{
  startChapter?: number;
  endChapter?: number;
  delaySeconds?: number;
  running?: boolean;
  progressText?: string;
  progressPercent?: number;
  summary?: string;
  error?: string;
  cancelRequested?: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", payload: { start: number; end: number; delaySeconds: number }): void;
  (event: "cancel"): void;
  (event: "close"): void;
}>();

const form = reactive({
  start: String(props.startChapter ?? 1),
  end: String(props.endChapter ?? 1),
  delay: String(props.delaySeconds ?? 0),
});

const formError = ref("");

watch(
  () => [props.startChapter, props.endChapter, props.delaySeconds],
  ([start, end, delay]) => {
    if (props.running) {
      return;
    }
    if (typeof start === "number") {
      form.start = String(start);
    }
    if (typeof end === "number") {
      form.end = String(end);
    }
    if (typeof delay === "number") {
      form.delay = String(delay);
    }
  }
);

const submit = () => {
  formError.value = "";
  const start = Number(form.start);
  const end = Number(form.end);
  const delaySeconds = Number(form.delay);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
    formError.value = "请输入有效的章节范围。";
    return;
  }
  if (start > end) {
    formError.value = "起始章节不能大于结束章节。";
    return;
  }
  if (!Number.isFinite(delaySeconds) || delaySeconds < 0) {
    formError.value = "章节间隔必须是非负数字。";
    return;
  }
  emit("submit", { start, end, delaySeconds });
  emit("close");
};

const progressText = computed(() => props.progressText ?? "准备生成...");
const progressPercent = computed(() => props.progressPercent ?? 0);
const running = computed(() => props.running ?? false);
const cancelRequested = computed(() => props.cancelRequested ?? false);

watch(
  () => running.value,
  (next, prev) => {
    if (next && !prev) {
      emit("close");
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.modal-header h2 {
  margin: 0 0 6px 0;
}

.modal-body {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
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

.progress-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-text {
  font-size: 14px;
  color: var(--text);
}

.progress-bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(229, 225, 245, 0.1);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #5d3bff);
  transition: width 0.3s ease;
}

.summary-box {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #d7f7e3;
  font-size: 13px;
}

.form-error {
  color: var(--danger);
  font-size: 12px;
}

.action-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
</style>

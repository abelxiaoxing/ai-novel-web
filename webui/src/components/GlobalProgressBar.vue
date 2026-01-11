<template>
  <div v-if="visible" class="global-progress">
    <div class="progress-content">
      <span class="progress-label">{{ label }}</span>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${percent}%` }"></div>
      </div>
      <button v-if="showCancel" class="btn-cancel" :disabled="cancelDisabled" @click="$emit('cancel')">
        {{ cancelDisabled ? '取消中...' : '取消' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  label: string;
  percent: number;
  showCancel?: boolean;
  cancelDisabled?: boolean;
}>();

defineEmits<{
  (e: "cancel"): void;
}>();
</script>

<style scoped>
.global-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--panel-bg, #1a1a2e);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  padding: 8px 16px;
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.progress-label {
  font-size: 13px;
  color: var(--text, #e5e1f5);
  white-space: nowrap;
}

.progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: rgba(229, 225, 245, 0.1);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent, #7c5cff), #5d3bff);
  transition: width 0.3s ease;
}

.btn-cancel {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--text-muted, #a0a0b0);
  cursor: pointer;
}

.btn-cancel:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

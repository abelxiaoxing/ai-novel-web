<template>
  <span class="help-tooltip" @mouseenter="show = true" @mouseleave="show = false">
    <span class="help-icon">?</span>
    <span v-if="show" class="help-text">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  text: string;
}>();

const show = ref(false);
</script>

<style scoped>
.help-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
}

.help-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(126, 91, 255, 0.2);
  color: var(--accent-bright);
  font-size: 10px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
}

.help-text {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--panel-strong);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  max-width: 240px;
  white-space: normal;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.help-text::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--panel-border);
}
</style>

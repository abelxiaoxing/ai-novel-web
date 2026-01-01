<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-panel">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits(["close"]);
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 6, 18, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.modal-panel {
  width: min(520px, 92vw);
  background: linear-gradient(160deg, rgba(28, 21, 48, 0.98), rgba(16, 12, 26, 0.98));
  border-radius: var(--radius-lg);
  border: 1px solid rgba(126, 91, 255, 0.3);
  padding: 24px;
  box-shadow: var(--shadow-soft);
}
</style>

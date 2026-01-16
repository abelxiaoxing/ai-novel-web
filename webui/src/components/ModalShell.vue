<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-panel">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineEmits(["close"]);
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 16, 0.75);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  z-index: 100;
  opacity: 0;
  animation: backdropFadeIn 0.2s ease forwards;
  will-change: opacity;
}

@keyframes backdropFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-panel {
  width: min(540px, 90vw);
  max-height: 85vh;
  overflow-y: auto;
  background: linear-gradient(145deg, rgba(20, 30, 45, 0.98), rgba(12, 20, 32, 0.98));
  border-radius: 20px;
  border: 1px solid rgba(95, 170, 230, 0.35);
  padding: 28px;
  box-shadow:
    0 25px 60px rgba(5, 10, 20, 0.7),
    0 0 0 1px rgba(47, 155, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
  animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  position: relative;
  will-change: transform, opacity;
}

.modal-panel::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 20px;
  background: linear-gradient(
    135deg,
    rgba(125, 211, 255, 0.15) 0%,
    rgba(47, 155, 255, 0.08) 50%,
    rgba(125, 211, 255, 0.15) 100%
  );
  z-index: -1;
  opacity: 0.6;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-panel:hover {
  border-color: rgba(125, 211, 255, 0.45);
  box-shadow:
    0 30px 70px rgba(5, 10, 20, 0.8),
    0 0 40px rgba(47, 155, 255, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* 滚动条样式优化 */
.modal-panel::-webkit-scrollbar {
  width: 6px;
}

.modal-panel::-webkit-scrollbar-track {
  background: rgba(10, 15, 25, 0.5);
  border-radius: 3px;
}

.modal-panel::-webkit-scrollbar-thumb {
  background: rgba(95, 170, 230, 0.3);
  border-radius: 3px;
}

.modal-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(95, 170, 230, 0.5);
}
</style>

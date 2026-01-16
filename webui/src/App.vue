<template>
  <div class="app-shell">
    <div class="ambient-grid" aria-hidden="true"></div>
    <div class="ambient-glow" aria-hidden="true"></div>
    <router-view />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import ToastContainer from "@/components/ToastContainer.vue";
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.ambient-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(90deg, rgba(90, 170, 240, 0.06) 1px, transparent 1px),
    linear-gradient(0deg, rgba(90, 170, 240, 0.04) 1px, transparent 1px);
  background-size: 120px 120px, 80px 80px;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

.ambient-glow {
  position: fixed;
  inset: -20% -10% auto -10%;
  height: 60vh;
  background: radial-gradient(
    circle at top,
    rgba(47, 155, 255, 0.2),
    rgba(10, 15, 21, 0.1) 60%,
    transparent 85%
  );
  filter: blur(8px);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
}
</style>

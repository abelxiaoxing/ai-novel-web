<template>
  <div class="app-shell">
    <div class="ambient-glow" aria-hidden="true"></div>
    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.ambient-glow {
  position: fixed;
  inset: -20% -10% auto -10%;
  height: 60vh;
  background: radial-gradient(
    circle at top,
    rgba(126, 91, 255, 0.25),
    rgba(15, 11, 22, 0.1) 60%,
    transparent 85%
  );
  filter: blur(8px);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
}
</style>

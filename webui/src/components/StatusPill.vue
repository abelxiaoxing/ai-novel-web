<template>
  <span class="pill" :class="`pill-${variant}`">{{ label }}</span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    variant?: "default" | "success" | "warn" | "danger";
  }>(),
  { variant: "default" }
);
</script>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(126, 91, 255, 0.18);
  color: var(--accent-bright);
}

.pill-success {
  background: rgba(34, 197, 94, 0.2);
  color: #7ef1a4;
}

.pill-warn {
  background: rgba(245, 158, 11, 0.2);
  color: #ffd08a;
}

.pill-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #ff9b9b;
}
</style>

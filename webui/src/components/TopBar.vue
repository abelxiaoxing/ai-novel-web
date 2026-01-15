<template>
  <header class="top-bar panel">
    <div class="top-left">
      <div class="project-title">{{ projectName || "未选择项目" }}</div>
      <span v-if="genre" class="genre-tag">{{ genre }}</span>
      <StatusPill :label="statusLabel" :variant="statusVariant" />
    </div>
    <div class="top-actions">
      <button class="btn btn-ghost" @click="$emit('projects')">项目列表</button>
      <button class="btn btn-primary" @click="$emit('settings')">设置</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import StatusPill from "@/components/StatusPill.vue";

defineProps<{
  projectName?: string;
  genre?: string;
  statusLabel: string;
  statusVariant?: "default" | "success" | "warn" | "danger";
}>();

defineEmits(["projects", "save", "settings"]);
</script>

<style scoped>
.top-bar {
  grid-column: 1 / -1;
  grid-row: 1 / 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.project-title {
  font-weight: 700;
  font-size: 16px;
}

.genre-tag {
  background: rgba(126, 91, 255, 0.15);
  color: var(--accent-bright);
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>

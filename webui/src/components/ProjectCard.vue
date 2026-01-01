<template>
  <article class="project-card" @click="$emit('open')">
    <div class="project-header">
      <h3>{{ project.name }}</h3>
      <span class="pill">{{ project.genre || "类型" }}</span>
    </div>
    <div class="project-meta">
      <span>章节数：{{ project.num_chapters ?? "暂无" }}</span>
      <span>目标字数：{{ project.word_number ?? "暂无" }}</span>
    </div>
    <div class="project-footer">
      <span class="muted">更新时间：{{ project.updated_at ?? "暂无" }}</span>
      <div class="project-actions">
        <button class="btn btn-outline" @click.stop="$emit('open')">打开</button>
        <button class="btn btn-outline btn-danger" @click.stop="$emit('delete')">删除</button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Project } from "@/api/types";

defineProps<{ project: Project }>();

defineEmits(["open", "delete"]);
</script>

<style scoped>
.project-card {
  padding: 20px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(229, 225, 245, 0.12);
  background: linear-gradient(160deg, rgba(28, 21, 48, 0.95), rgba(16, 12, 26, 0.95));
  display: flex;
  flex-direction: column;
  gap: 16px;
  cursor: pointer;
  transition: transform 0.2s ease, border 0.2s ease;
}

.project-card:hover {
  transform: translateY(-4px);
  border-color: rgba(126, 91, 255, 0.4);
}

.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.project-header h3 {
  margin: 0;
  font-size: 18px;
}

.project-meta {
  display: flex;
  gap: 18px;
  color: var(--text-muted);
  font-size: 13px;
}

.project-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-actions {
  display: flex;
  gap: 8px;
}

.btn-danger {
  border-color: rgba(239, 68, 68, 0.45);
  color: rgba(239, 68, 68, 0.9);
}
</style>

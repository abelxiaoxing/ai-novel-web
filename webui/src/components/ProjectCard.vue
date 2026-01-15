<template>
  <article class="project-card" @click="$emit('open')">
    <!-- 装饰性元素 -->
    <div class="card-decoration">
      <div class="decoration-orb"></div>
    </div>

    <div class="card-header">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      </div>
    </div>

    <div class="card-body">
      <h3 class="project-name">{{ project.name }}</h3>
      <p class="project-topic" v-if="project.topic">{{ project.topic }}</p>
    </div>

    <!-- 进度条 -->
    <div class="progress-section" v-if="project.num_chapters">
      <div class="progress-header">
        <span class="progress-label">创作进度</span>
        <span class="progress-count">{{ progressPercentage }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
      </div>
      <div class="progress-stats">
        <span class="stat-item">
          <span class="stat-value">{{ finalizedChapters }}</span>
          <span class="stat-label">已完成</span>
        </span>
        <span class="stat-divider"></span>
        <span class="stat-item">
          <span class="stat-value">{{ project.num_chapters }}</span>
          <span class="stat-label">总章节</span>
        </span>
        <span class="stat-divider"></span>
        <span class="stat-item">
          <span class="stat-value">{{ wordCount }}</span>
          <span class="stat-label">万字</span>
        </span>
      </div>
    </div>

    <!-- 卡片底部 -->
    <div class="card-footer">
      <div class="time-info">
        <div class="time-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>{{ formattedUpdatedAt }}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="action-btn danger" @click.stop="$emit('delete')" title="删除项目">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 装饰性元素 -->
    <div class="card-decoration">
      <div class="decoration-orb"></div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Project } from "@/api/types";

const props = defineProps<{ project: Project }>();
defineEmits(["open", "delete"]);

// 模拟已定稿章节数（实际项目中可能从其他地方获取）
function getFinalizedChapters(): number {
  // 这里可以根据项目状态计算，目前返回0作为占位
  return 0;
}

const finalizedChapters = computed(() => getFinalizedChapters());

// 计算进度百分比
const progressPercentage = computed(() => {
  if (!props.project.num_chapters) return 0;
  return Math.round((finalizedChapters.value / props.project.num_chapters) * 100);
});

// 计算万字数
const wordCount = computed(() => {
  if (!props.project.word_number) return "0";
  return (props.project.word_number / 10000).toFixed(1);
});

// 格式化更新时间
const formattedUpdatedAt = computed(() => {
  if (!props.project.updated_at) return "暂无记录";
  const date = new Date(props.project.updated_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
});
</script>

<style scoped>
.project-card {
  position: relative;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: linear-gradient(
    145deg,
    var(--card-surface-start, rgba(28, 21, 48, 0.95)) 0%,
    var(--card-surface-end, rgba(16, 12, 26, 0.98)) 100%
  );
  border: 1px solid var(--card-border, rgba(126, 91, 255, 0.15));
  display: flex;
  flex-direction: column;
  gap: 20px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* 卡片发光效果 */
.card-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle at 30% 20%,
    var(--card-glow, rgba(126, 91, 255, 0.08)) 0%,
    transparent 50%
  );
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.project-card:hover {
  transform: translateY(-6px);
  border-color: var(--card-border-strong, rgba(126, 91, 255, 0.4));
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 0 30px var(--card-glow-strong, rgba(126, 91, 255, 0.15)),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--card-icon-bg, rgba(126, 91, 255, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-bright);
  transition: all 0.3s ease;
}

.project-card:hover .card-icon {
  background: var(--card-icon-bg-strong, rgba(126, 91, 255, 0.2));
  transform: scale(1.05);
}

/* 卡片内容 */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
  transition: color 0.3s ease;
}

.project-card:hover .project-name {
  color: var(--accent-bright);
}

.project-topic {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 进度部分 */
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--card-panel, rgba(15, 11, 22, 0.5));
  border-radius: var(--radius-md);
  border: 1px solid var(--card-border-soft, rgba(126, 91, 255, 0.08));
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.progress-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-bright);
}

.progress-bar {
  height: 6px;
  background: var(--card-progress-bg, rgba(126, 91, 255, 0.15));
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--accent) 0%,
    var(--accent-bright) 100%
  );
  border-radius: 999px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 100%
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

.progress-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--card-border-soft, rgba(126, 91, 255, 0.08));
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.stat-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: var(--card-progress-bg, rgba(126, 91, 255, 0.15));
}

/* 卡片底部 */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid var(--card-border-soft, rgba(126, 91, 255, 0.08));
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.time-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.card-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--card-border, rgba(126, 91, 255, 0.2));
  background: var(--card-action-bg, rgba(126, 91, 255, 0.08));
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: var(--card-action-bg-strong, rgba(126, 91, 255, 0.2));
  color: var(--accent-bright);
  border-color: var(--card-border-strong, rgba(126, 91, 255, 0.4));
  transform: scale(1.05);
}

.action-btn.danger {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
  color: var(--text-muted);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

/* 装饰性元素 */
.card-decoration {
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  pointer-events: none;
}

.decoration-orb {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    var(--card-glow, rgba(126, 91, 255, 0.15)) 0%,
    transparent 70%
  );
  filter: blur(20px);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.1); }
}

/* 动画入场效果 */
@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.project-card {
  animation: cardEnter 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
</style>

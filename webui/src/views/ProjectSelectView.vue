<template>
  <div class="project-view">
    <SpaceBackground />
    <div class="hud-overlay" aria-hidden="true">
      <div class="hud-corner hud-top-left">
        <span class="hud-label">DIR/INDEX</span>
        <span class="hud-value">ALPHA-07</span>
      </div>
      <div class="hud-corner hud-top-right">
        <span class="hud-label">SYNC</span>
        <span class="hud-value">98.4%</span>
      </div>
      <div class="hud-corner hud-bottom-left">
        <span class="hud-label">NODE</span>
        <span class="hud-value">QX-19</span>
      </div>
      <div class="hud-corner hud-bottom-right">
        <span class="hud-label">LAT</span>
        <span class="hud-value">0.32ms</span>
      </div>
      <div class="hud-scanline"></div>
    </div>

    <!-- 顶部标题区域 -->
    <header class="hero-section fade-in-up">
      <div class="hero-content">
        <div class="hero-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span>智能小说生成器</span>
        </div>
        <h1 class="hero-title">
          <span class="title-gradient">选择你的故事宇宙</span>
        </h1>
        <p class="hero-subtitle">
          在一个工作台中管理项目、打磨章节草稿、保持创作节奏
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-primary btn-large" @click="showCreate = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>新建项目</span>
        </button>
        <button class="btn btn-ghost btn-icon" @click="refresh" title="刷新项目列表">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 控制栏 -->
    <section class="controls-section fade-in-up" style="--delay: 0.1s">
      <div class="search-wrapper">
        <div class="search-field">
          <div class="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <input
            class="search-input"
            v-model="searchQuery"
            placeholder="搜索项目名称..."
            autocomplete="off"
          />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="sort-wrapper">
        <div class="sort-field">
          <label class="sort-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="9" x2="20" y2="9"/>
              <line x1="4" y1="15" x2="20" y2="15"/>
              <line x1="10" y1="3" x2="8" y2="21"/>
              <line x1="16" y1="3" x2="14" y2="21"/>
            </svg>
            <span>排序</span>
          </label>
          <select class="sort-select" v-model="sortKey">
            <option value="name">名称</option>
            <option value="created_at">创建时间</option>
            <option value="updated_at">更新时间</option>
          </select>
        </div>
      </div>

      <div class="results-count" v-if="visibleProjects.length">
        <span class="count-number">{{ visibleProjects.length }}</span>
        <span class="count-label">个项目</span>
      </div>
    </section>

    <!-- 加载状态 -->
    <transition name="fade">
      <div v-if="projectStore.loading" class="loading-wrapper">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
        <p class="loading-text">正在加载你的故事宇宙...</p>
      </div>
    </transition>

    <!-- 项目网格 -->
    <transition-group name="list" tag="section" class="project-grid">
      <ProjectCard
        v-for="(project, index) in visibleProjects"
        :key="project.id"
        :project="project"
        :style="{ '--delay': `${index * 60}ms` }"
        @open="openProject(project.id)"
        @delete="confirmDelete(project.id, project.name)"
      />
    </transition-group>

    <!-- 空状态 -->
    <transition name="fade">
      <div v-if="!projectStore.loading && !visibleProjects.length" class="empty-state">
        <div class="empty-illustration">
          <div class="illustration-orbs">
            <div class="orb orb-1"></div>
            <div class="orb orb-2"></div>
            <div class="orb orb-3"></div>
          </div>
          <div class="illustration-book">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              <line x1="12" y1="6" x2="12" y2="18"/>
              <path d="M8 9l4-3 4 3"/>
            </svg>
          </div>
        </div>
        <h3 class="empty-title">还没有故事在等待被发现</h3>
        <p class="empty-description">
          {{ searchQuery ? '没有找到匹配的项目，试试其他关键词' : '创建一个新项目，开始你的创作之旅' }}
        </p>
        <button v-if="!searchQuery" class="btn btn-primary btn-large" @click="showCreate = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>创建第一个项目</span>
        </button>
        <button v-else class="btn btn-ghost" @click="searchQuery = ''">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span>清除搜索</span>
        </button>
      </div>
    </transition>

    <!-- 创建项目弹窗 -->
    <CreateProjectModal
      v-if="showCreate"
      @close="showCreate = false"
      @submit="createProject"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useProjectStore } from "@/stores/project";
import { useToastStore } from "@/stores/toast";
import SpaceBackground from "@/components/SpaceBackground.vue";
import ProjectCard from "@/components/ProjectCard.vue";
import CreateProjectModal from "@/components/CreateProjectModal.vue";

const router = useRouter();
const projectStore = useProjectStore();
const toastStore = useToastStore();
const showCreate = ref(false);
const searchQuery = ref("");
const sortKey = ref("name");
const sortStorageKey = "ainovel:project-sort";

const refresh = () => {
  projectStore.fetchProjects();
};

const openProject = (projectId: string) => {
  router.push(`/projects/${projectId}`);
};

const confirmDelete = async (projectId: string, name: string) => {
  const ok = window.confirm(`确定要删除项目「${name}」吗？该操作会移除所有生成文件。`);
  if (!ok) {
    return;
  }
  try {
    await projectStore.deleteProject(projectId);
  } catch {
    // errors are handled by the store and shown on the page
  }
};

const createProject = async (payload: Record<string, string>) => {
  try {
    const project = await projectStore.createProject({
      ...payload,
      num_chapters: payload.num_chapters ? Number(payload.num_chapters) : undefined,
      word_number: payload.word_number ? Number(payload.word_number) : undefined,
    });
    showCreate.value = false;
    router.push(`/projects/${project.id}`);
  } catch {
    showCreate.value = true;
  }
};

onMounted(() => {
  projectStore.fetchProjects();
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(sortStorageKey);
    if (saved) {
      sortKey.value = saved;
    }
  }
});

const normalizeSortValue = (value?: string) => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const visibleProjects = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  const filtered = projectStore.projects.filter((project) => {
    if (!keyword) {
      return true;
    }
    return project.name.toLowerCase().includes(keyword);
  });
  return [...filtered].sort((a, b) => {
    switch (sortKey.value) {
      case "created_at":
        return normalizeSortValue(b.created_at) - normalizeSortValue(a.created_at);
      case "updated_at":
        return normalizeSortValue(b.updated_at) - normalizeSortValue(a.updated_at);
      case "name":
      default:
        return a.name.localeCompare(b.name, "zh-CN");
    }
  });
});

watch(
  () => sortKey.value,
  (value) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(sortStorageKey, value);
    }
  }
);

watch(
  () => projectStore.error,
  (error) => {
    if (error) {
      toastStore.error(error);
      projectStore.error = null;
    }
  }
);
</script>

<style scoped>
.project-view {
  --accent: #2f9bff;
  --accent-bright: #7dd3ff;
  --accent-muted: rgba(47, 155, 255, 0.18);
  --hud-line: rgba(125, 205, 255, 0.45);
  --hud-line-soft: rgba(125, 205, 255, 0.2);
  --panel-veil: rgba(8, 12, 18, 0.72);
  --panel-veil-strong: rgba(8, 12, 18, 0.84);
  --panel-border: rgba(95, 170, 230, 0.28);
  --panel-border-strong: rgba(95, 170, 230, 0.5);
  --card-surface-start: rgba(9, 14, 22, 0.96);
  --card-surface-end: rgba(6, 10, 16, 0.98);
  --card-border: rgba(95, 170, 230, 0.28);
  --card-border-strong: rgba(95, 170, 230, 0.5);
  --card-border-soft: rgba(95, 170, 230, 0.12);
  --card-glow: rgba(90, 170, 240, 0.12);
  --card-glow-strong: rgba(90, 170, 240, 0.24);
  --card-icon-bg: rgba(47, 155, 255, 0.12);
  --card-icon-bg-strong: rgba(47, 155, 255, 0.22);
  --card-panel: rgba(8, 12, 18, 0.55);
  --card-progress-bg: rgba(90, 170, 240, 0.18);
  --card-action-bg: rgba(47, 155, 255, 0.08);
  --card-action-bg-strong: rgba(47, 155, 255, 0.2);
  padding: 48px clamp(24px, 6vw, 80px);
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: relative;
  min-height: 100vh;
  z-index: 1;
}

/* HUD 覆盖层 */
.hud-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.hud-overlay::before,
.hud-overlay::after {
  content: "";
  position: absolute;
  left: 32px;
  right: 32px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--hud-line), transparent);
  opacity: 0.6;
}

.hud-overlay::before {
  top: 28px;
}

.hud-overlay::after {
  bottom: 28px;
}

.hud-corner {
  position: absolute;
  width: 180px;
  height: 90px;
  padding: 14px 16px;
  color: var(--accent-bright);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hud-corner::after {
  content: "";
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--hud-line);
  border-radius: 50%;
}

.hud-top-left {
  top: 24px;
  left: 24px;
  border-top: 1px solid var(--hud-line);
  border-left: 1px solid var(--hud-line);
}

.hud-top-left::after {
  top: -4px;
  left: -4px;
}

.hud-top-right {
  top: 24px;
  right: 24px;
  border-top: 1px solid var(--hud-line);
  border-right: 1px solid var(--hud-line);
  align-items: flex-end;
  text-align: right;
}

.hud-top-right::after {
  top: -4px;
  right: -4px;
}

.hud-bottom-left {
  bottom: 24px;
  left: 24px;
  border-bottom: 1px solid var(--hud-line);
  border-left: 1px solid var(--hud-line);
}

.hud-bottom-left::after {
  bottom: -4px;
  left: -4px;
}

.hud-bottom-right {
  bottom: 24px;
  right: 24px;
  border-bottom: 1px solid var(--hud-line);
  border-right: 1px solid var(--hud-line);
  align-items: flex-end;
  text-align: right;
}

.hud-bottom-right::after {
  bottom: -4px;
  right: -4px;
}

.hud-label {
  color: var(--text-muted);
  opacity: 0.8;
}

.hud-value {
  font-size: 13px;
  letter-spacing: 0.2em;
}

.hud-scanline {
  position: absolute;
  left: 12%;
  right: 12%;
  top: 45%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--hud-line-soft), transparent);
  opacity: 0.2;
  animation: scanline 8s linear infinite;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.05); }
  50% { transform: translate(-10px, 20px) scale(0.95); }
  75% { transform: translate(30px, 10px) scale(1.02); }
}

@keyframes scanline {
  0% {
    transform: translateY(-20vh);
    opacity: 0;
  }
  25% {
    opacity: 0.35;
  }
  55% {
    opacity: 0.18;
  }
  100% {
    transform: translateY(30vh);
    opacity: 0;
  }
}

/* 英雄区域 */
.hero-section {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  flex-wrap: wrap;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--accent-muted);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-bright);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 16px;
}

.hero-title {
  margin: 0;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 800;
  line-height: 1.1;
}

.title-gradient {
  background: linear-gradient(
    135deg,
    var(--text) 0%,
    var(--accent-bright) 50%,
    var(--accent) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  margin: 16px 0 0 0;
  font-size: 16px;
  color: var(--text-muted);
  max-width: 500px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 控制栏 */
.controls-section {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  padding: 24px;
  background: var(--panel-veil);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
  position: relative;
  box-shadow: 0 18px 40px rgba(5, 9, 15, 0.55);
}

.controls-section::before {
  content: "";
  position: absolute;
  top: 8px;
  left: 24px;
  right: 24px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--hud-line-soft), transparent);
  opacity: 0.8;
}

.search-wrapper {
  flex: 1;
  min-width: 280px;
  max-width: 400px;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 16px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-input {
  width: 100%;
  padding: 14px 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--panel-border);
  background: rgba(8, 12, 18, 0.65);
  color: var(--text);
  font-size: 15px;
  transition: all 0.3s ease;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  outline: none;
  border-color: var(--panel-border-strong);
  background: rgba(6, 10, 16, 0.85);
  box-shadow: 0 0 0 4px rgba(47, 155, 255, 0.15);
}

.search-clear {
  position: absolute;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: var(--accent-muted);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.search-clear:hover {
  background: rgba(47, 155, 255, 0.28);
  color: var(--accent-bright);
}

.sort-wrapper {
  min-width: 160px;
}

.sort-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sort-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sort-select {
  padding: 12px 36px 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--panel-border);
  background: rgba(8, 12, 18, 0.65) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23b7c7e6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  appearance: none;
  transition: all 0.3s ease;
}

.sort-select:focus {
  outline: none;
  border-color: var(--panel-border-strong);
  background-color: rgba(6, 10, 16, 0.85);
}

.results-count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-left: 16px;
  border-left: 1px solid rgba(95, 170, 230, 0.2);
  margin-left: auto;
}

.count-number {
  font-size: 24px;
  font-weight: 800;
  color: var(--accent-bright);
}

.count-label {
  font-size: 13px;
  color: var(--text-muted);
}

/* 项目网格 */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

/* 加载状态 */
.loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 24px;
}

.loading-spinner {
  position: relative;
  width: 60px;
  height: 60px;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: var(--accent);
  animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.spinner-ring:nth-child(2) {
  width: 80%;
  height: 80%;
  top: 10%;
  left: 10%;
  border-top-color: var(--accent-bright);
  animation-duration: 1s;
  animation-direction: reverse;
}

.spinner-ring:nth-child(3) {
  width: 60%;
  height: 60%;
  top: 20%;
  left: 20%;
  border-top-color: rgba(90, 170, 240, 0.4);
  animation-duration: 0.8s;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 15px;
  color: var(--text-muted);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  gap: 20px;
}

.empty-illustration {
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.illustration-orbs {
  position: absolute;
  width: 100%;
  height: 100%;
}

.illustration-orbs .orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.5;
}

.illustration-orbs .orb-1 {
  width: 80px;
  height: 80px;
  background: rgba(75, 170, 255, 0.32);
  top: 0;
  left: 20px;
  animation: float 4s ease-in-out infinite;
}

.illustration-orbs .orb-2 {
  width: 60px;
  height: 60px;
  background: rgba(120, 210, 255, 0.28);
  bottom: 10px;
  right: 10px;
  animation: float 4s ease-in-out infinite 1s;
}

.illustration-orbs .orb-3 {
  width: 40px;
  height: 40px;
  background: rgba(60, 150, 220, 0.24);
  bottom: 30px;
  left: 10px;
  animation: float 4s ease-in-out infinite 2s;
}

.illustration-book {
  position: relative;
  z-index: 1;
  padding: 24px;
  background: var(--panel-veil-strong);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
}

.empty-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
}

.empty-description {
  margin: 0;
  font-size: 15px;
  color: var(--text-muted);
  max-width: 400px;
}

/* 按钮样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 14px;
  border: 1px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent), #2f6bff);
  color: #f2edff;
  box-shadow: 0 8px 20px rgba(47, 155, 255, 0.28);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(47, 155, 255, 0.4);
}

.btn-large {
  padding: 16px 28px;
  font-size: 15px;
}

.btn-ghost {
  background: rgba(47, 155, 255, 0.08);
  border: 1px solid rgba(47, 155, 255, 0.25);
  color: var(--text);
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(47, 155, 255, 0.18);
  border-color: rgba(47, 155, 255, 0.45);
}

.btn-icon {
  padding: 12px;
}

/* 动画 */
.fade-in-up {
  animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  animation-delay: var(--delay, 0s);
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-move {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .hud-scanline {
    animation: none;
    opacity: 0.12;
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .hero-section {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-actions {
    justify-content: flex-start;
  }

  .controls-section {
    flex-direction: column;
    align-items: stretch;
  }

  .hud-overlay {
    opacity: 0.55;
  }

  .hud-corner {
    width: 140px;
    height: 70px;
    font-size: 10px;
  }

  .hud-scanline {
    display: none;
  }

  .search-wrapper {
    max-width: none;
  }

  .results-count {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
    padding-top: 16px;
    border-top: 1px solid rgba(95, 170, 230, 0.18);
    width: 100%;
    justify-content: center;
  }

  .project-grid {
    grid-template-columns: 1fr;
  }
}
</style>

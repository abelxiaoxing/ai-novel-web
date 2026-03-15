<template>
  <div class="project-view" :style="pageStyleVars">

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

      <div class="theme-wrapper">
        <div class="sort-field">
          <label class="sort-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3"/>
              <path d="M12 19v3"/>
              <path d="M4.93 4.93l2.12 2.12"/>
              <path d="M16.95 16.95l2.12 2.12"/>
              <path d="M2 12h3"/>
              <path d="M19 12h3"/>
              <path d="M4.93 19.07l2.12-2.12"/>
              <path d="M16.95 7.05l2.12-2.12"/>
            </svg>
            <span>色调</span>
          </label>
          <div class="theme-options" role="radiogroup" aria-label="主页色调选择">
            <button
              v-for="theme in projectThemes"
              :key="theme.key"
              type="button"
              class="theme-option"
              :class="{ active: selectedTheme === theme.key }"
              @click="chooseTheme(theme.key)"
            >
              <span class="theme-dot" :style="{ background: theme.preview }"></span>
              <span class="theme-name">{{ theme.label }}</span>
            </button>
          </div>
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
import ProjectCard from "@/components/ProjectCard.vue";
import CreateProjectModal from "@/components/CreateProjectModal.vue";

type ProjectTheme = {
  key: string;
  label: string;
  preview: string;
  vars: Record<string, string>;
};

const projectThemes: ProjectTheme[] = [
  {
    key: "snow",
    label: "雪白",
    preview: "linear-gradient(135deg, #ffffff, #edf6ff)",
    vars: {
      "--page-bg-start": "#ffffff",
      "--page-bg-end": "#f8fbff",
      "--page-spot-1": "rgba(124, 181, 255, 0.18)",
      "--page-spot-2": "rgba(127, 225, 255, 0.16)",
      "--text": "#10223d",
      "--text-muted": "#5f7088",
      "--accent": "#2f7eed",
      "--accent-bright": "#1b65d0",
      "--accent-muted": "rgba(47, 126, 237, 0.14)",
      "--panel-veil": "rgba(255, 255, 255, 0.88)",
      "--panel-veil-strong": "rgba(255, 255, 255, 0.96)",
      "--panel-border": "rgba(95, 148, 214, 0.26)",
      "--panel-border-strong": "rgba(54, 116, 197, 0.55)",
      "--hud-line-soft": "rgba(83, 146, 224, 0.45)",
      "--card-surface-start": "#ffffff",
      "--card-surface-end": "#f6faff",
      "--card-border": "rgba(96, 149, 215, 0.24)",
      "--card-border-strong": "rgba(62, 125, 201, 0.52)",
      "--card-border-soft": "rgba(96, 149, 215, 0.14)",
      "--card-glow": "rgba(120, 183, 255, 0.18)",
      "--card-glow-strong": "rgba(120, 183, 255, 0.32)",
      "--card-icon-bg": "rgba(47, 126, 237, 0.12)",
      "--card-icon-bg-strong": "rgba(47, 126, 237, 0.2)",
      "--card-panel": "rgba(246, 250, 255, 0.9)",
      "--card-progress-bg": "rgba(96, 149, 215, 0.22)",
      "--card-action-bg": "rgba(47, 126, 237, 0.08)",
      "--card-action-bg-strong": "rgba(47, 126, 237, 0.18)",
      "--surface-shadow": "0 14px 32px rgba(66, 121, 189, 0.14)",
      "--card-hover-shadow":
        "0 18px 34px rgba(52, 104, 179, 0.18), 0 0 22px rgba(126, 191, 255, 0.28)",
      "--field-bg": "rgba(255, 255, 255, 0.92)",
      "--field-bg-focus": "#ffffff",
      "--field-ring": "rgba(47, 126, 237, 0.18)",
      "--btn-primary-end": "#2d6ae7",
      "--btn-primary-text": "#f8fbff",
      "--btn-primary-shadow": "rgba(47, 126, 237, 0.28)",
      "--btn-primary-shadow-hover": "rgba(47, 126, 237, 0.4)",
      "--btn-ghost-bg": "rgba(47, 126, 237, 0.08)",
      "--btn-ghost-border": "rgba(47, 126, 237, 0.24)",
      "--btn-ghost-hover-bg": "rgba(47, 126, 237, 0.16)",
      "--btn-ghost-hover-border": "rgba(47, 126, 237, 0.42)",
    },
  },
  {
    key: "mint",
    label: "薄荷",
    preview: "linear-gradient(135deg, #ffffff, #e7fff5)",
    vars: {
      "--page-bg-start": "#fcfffd",
      "--page-bg-end": "#f2fdf7",
      "--page-spot-1": "rgba(91, 201, 171, 0.2)",
      "--page-spot-2": "rgba(124, 225, 198, 0.18)",
      "--text": "#0f2f2a",
      "--text-muted": "#5a7a74",
      "--accent": "#1f9a7f",
      "--accent-bright": "#137663",
      "--accent-muted": "rgba(31, 154, 127, 0.14)",
      "--panel-veil": "rgba(255, 255, 255, 0.88)",
      "--panel-veil-strong": "rgba(255, 255, 255, 0.96)",
      "--panel-border": "rgba(80, 168, 145, 0.28)",
      "--panel-border-strong": "rgba(31, 134, 109, 0.55)",
      "--hud-line-soft": "rgba(68, 165, 141, 0.45)",
      "--card-surface-start": "#ffffff",
      "--card-surface-end": "#f1fcf7",
      "--card-border": "rgba(80, 168, 145, 0.24)",
      "--card-border-strong": "rgba(31, 134, 109, 0.52)",
      "--card-border-soft": "rgba(80, 168, 145, 0.14)",
      "--card-glow": "rgba(123, 226, 198, 0.16)",
      "--card-glow-strong": "rgba(96, 207, 177, 0.28)",
      "--card-icon-bg": "rgba(31, 154, 127, 0.12)",
      "--card-icon-bg-strong": "rgba(31, 154, 127, 0.22)",
      "--card-panel": "rgba(245, 253, 249, 0.92)",
      "--card-progress-bg": "rgba(80, 168, 145, 0.2)",
      "--card-action-bg": "rgba(31, 154, 127, 0.08)",
      "--card-action-bg-strong": "rgba(31, 154, 127, 0.18)",
      "--surface-shadow": "0 14px 32px rgba(46, 132, 109, 0.14)",
      "--card-hover-shadow":
        "0 18px 34px rgba(37, 121, 99, 0.18), 0 0 22px rgba(132, 230, 205, 0.24)",
      "--field-bg": "rgba(255, 255, 255, 0.92)",
      "--field-bg-focus": "#ffffff",
      "--field-ring": "rgba(31, 154, 127, 0.18)",
      "--btn-primary-end": "#167a65",
      "--btn-primary-text": "#f3fffb",
      "--btn-primary-shadow": "rgba(31, 154, 127, 0.28)",
      "--btn-primary-shadow-hover": "rgba(31, 154, 127, 0.4)",
      "--btn-ghost-bg": "rgba(31, 154, 127, 0.08)",
      "--btn-ghost-border": "rgba(31, 154, 127, 0.24)",
      "--btn-ghost-hover-bg": "rgba(31, 154, 127, 0.16)",
      "--btn-ghost-hover-border": "rgba(31, 154, 127, 0.42)",
    },
  },
  {
    key: "sunset",
    label: "暖杏",
    preview: "linear-gradient(135deg, #fffaf5, #ffe9d5)",
    vars: {
      "--page-bg-start": "#fffdfb",
      "--page-bg-end": "#fff5ea",
      "--page-spot-1": "rgba(255, 176, 108, 0.2)",
      "--page-spot-2": "rgba(255, 206, 127, 0.18)",
      "--text": "#42230f",
      "--text-muted": "#8d6b57",
      "--accent": "#ea7f38",
      "--accent-bright": "#c15d1e",
      "--accent-muted": "rgba(234, 127, 56, 0.15)",
      "--panel-veil": "rgba(255, 250, 244, 0.9)",
      "--panel-veil-strong": "rgba(255, 252, 248, 0.97)",
      "--panel-border": "rgba(221, 149, 101, 0.3)",
      "--panel-border-strong": "rgba(193, 101, 48, 0.54)",
      "--hud-line-soft": "rgba(226, 142, 91, 0.46)",
      "--card-surface-start": "#ffffff",
      "--card-surface-end": "#fff4ea",
      "--card-border": "rgba(221, 149, 101, 0.24)",
      "--card-border-strong": "rgba(193, 101, 48, 0.5)",
      "--card-border-soft": "rgba(221, 149, 101, 0.14)",
      "--card-glow": "rgba(255, 191, 136, 0.18)",
      "--card-glow-strong": "rgba(243, 165, 101, 0.3)",
      "--card-icon-bg": "rgba(234, 127, 56, 0.12)",
      "--card-icon-bg-strong": "rgba(234, 127, 56, 0.22)",
      "--card-panel": "rgba(255, 248, 240, 0.9)",
      "--card-progress-bg": "rgba(221, 149, 101, 0.2)",
      "--card-action-bg": "rgba(234, 127, 56, 0.08)",
      "--card-action-bg-strong": "rgba(234, 127, 56, 0.18)",
      "--surface-shadow": "0 14px 32px rgba(178, 116, 71, 0.15)",
      "--card-hover-shadow":
        "0 18px 34px rgba(167, 101, 54, 0.18), 0 0 22px rgba(255, 199, 143, 0.28)",
      "--field-bg": "rgba(255, 255, 255, 0.92)",
      "--field-bg-focus": "#ffffff",
      "--field-ring": "rgba(234, 127, 56, 0.18)",
      "--btn-primary-end": "#c05a1f",
      "--btn-primary-text": "#fff7f1",
      "--btn-primary-shadow": "rgba(234, 127, 56, 0.28)",
      "--btn-primary-shadow-hover": "rgba(234, 127, 56, 0.4)",
      "--btn-ghost-bg": "rgba(234, 127, 56, 0.08)",
      "--btn-ghost-border": "rgba(234, 127, 56, 0.24)",
      "--btn-ghost-hover-bg": "rgba(234, 127, 56, 0.16)",
      "--btn-ghost-hover-border": "rgba(234, 127, 56, 0.42)",
    },
  },
  {
    key: "ocean",
    label: "晴海",
    preview: "linear-gradient(135deg, #f7fcff, #def6ff)",
    vars: {
      "--page-bg-start": "#fbfeff",
      "--page-bg-end": "#eef9ff",
      "--page-spot-1": "rgba(106, 185, 229, 0.2)",
      "--page-spot-2": "rgba(120, 211, 240, 0.18)",
      "--text": "#0f2c40",
      "--text-muted": "#5f7d90",
      "--accent": "#237fb7",
      "--accent-bright": "#186492",
      "--accent-muted": "rgba(35, 127, 183, 0.14)",
      "--panel-veil": "rgba(255, 255, 255, 0.88)",
      "--panel-veil-strong": "rgba(255, 255, 255, 0.96)",
      "--panel-border": "rgba(89, 160, 203, 0.28)",
      "--panel-border-strong": "rgba(35, 119, 167, 0.55)",
      "--hud-line-soft": "rgba(88, 160, 205, 0.45)",
      "--card-surface-start": "#ffffff",
      "--card-surface-end": "#f1f9ff",
      "--card-border": "rgba(89, 160, 203, 0.24)",
      "--card-border-strong": "rgba(35, 119, 167, 0.52)",
      "--card-border-soft": "rgba(89, 160, 203, 0.14)",
      "--card-glow": "rgba(135, 212, 240, 0.17)",
      "--card-glow-strong": "rgba(102, 187, 221, 0.28)",
      "--card-icon-bg": "rgba(35, 127, 183, 0.12)",
      "--card-icon-bg-strong": "rgba(35, 127, 183, 0.22)",
      "--card-panel": "rgba(244, 251, 255, 0.92)",
      "--card-progress-bg": "rgba(89, 160, 203, 0.2)",
      "--card-action-bg": "rgba(35, 127, 183, 0.08)",
      "--card-action-bg-strong": "rgba(35, 127, 183, 0.18)",
      "--surface-shadow": "0 14px 32px rgba(55, 123, 162, 0.14)",
      "--card-hover-shadow":
        "0 18px 34px rgba(44, 108, 145, 0.18), 0 0 22px rgba(144, 220, 247, 0.26)",
      "--field-bg": "rgba(255, 255, 255, 0.92)",
      "--field-bg-focus": "#ffffff",
      "--field-ring": "rgba(35, 127, 183, 0.18)",
      "--btn-primary-end": "#1a6797",
      "--btn-primary-text": "#f2fbff",
      "--btn-primary-shadow": "rgba(35, 127, 183, 0.28)",
      "--btn-primary-shadow-hover": "rgba(35, 127, 183, 0.4)",
      "--btn-ghost-bg": "rgba(35, 127, 183, 0.08)",
      "--btn-ghost-border": "rgba(35, 127, 183, 0.24)",
      "--btn-ghost-hover-bg": "rgba(35, 127, 183, 0.16)",
      "--btn-ghost-hover-border": "rgba(35, 127, 183, 0.42)",
    },
  },
];

const router = useRouter();
const projectStore = useProjectStore();
const toastStore = useToastStore();
const showCreate = ref(false);
const searchQuery = ref("");
const sortKey = ref("name");
const selectedTheme = ref(projectThemes[0].key);
const sortStorageKey = "ainovel:project-sort";
const themeStorageKey = "ainovel:project-theme";

const getSafeStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    return null;
  }
  return storage;
};

const readStorageItem = (key: string) => {
  const storage = getSafeStorage();
  if (!storage) {
    return null;
  }
  return storage.getItem(key);
};

const writeStorageItem = (key: string, value: string) => {
  const storage = getSafeStorage();
  if (!storage) {
    return;
  }
  storage.setItem(key, value);
};

const currentTheme = computed(
  () => projectThemes.find((theme) => theme.key === selectedTheme.value) ?? projectThemes[0]
);
const pageStyleVars = computed(() => currentTheme.value.vars);

const refresh = () => {
  projectStore.fetchProjects();
};

const chooseTheme = (themeKey: string) => {
  selectedTheme.value = themeKey;
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
  const saved = readStorageItem(sortStorageKey);
  if (saved) {
    sortKey.value = saved;
  }
  const savedTheme = readStorageItem(themeStorageKey);
  if (savedTheme && projectThemes.some((theme) => theme.key === savedTheme)) {
    selectedTheme.value = savedTheme;
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
    writeStorageItem(sortStorageKey, value);
  }
);

watch(
  () => selectedTheme.value,
  (value) => {
    writeStorageItem(themeStorageKey, value);
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
  --page-bg-start: #ffffff;
  --page-bg-end: #f8fbff;
  --page-spot-1: rgba(124, 181, 255, 0.18);
  --page-spot-2: rgba(127, 225, 255, 0.16);
  --text: #10223d;
  --text-muted: #5f7088;
  --accent: #2f7eed;
  --accent-bright: #1b65d0;
  --accent-muted: rgba(47, 126, 237, 0.14);
  --panel-veil: rgba(255, 255, 255, 0.88);
  --panel-veil-strong: rgba(255, 255, 255, 0.96);
  --panel-border: rgba(95, 148, 214, 0.26);
  --panel-border-strong: rgba(54, 116, 197, 0.55);
  --hud-line-soft: rgba(83, 146, 224, 0.45);
  --card-surface-start: #ffffff;
  --card-surface-end: #f6faff;
  --card-border: rgba(96, 149, 215, 0.24);
  --card-border-strong: rgba(62, 125, 201, 0.52);
  --card-border-soft: rgba(96, 149, 215, 0.14);
  --card-glow: rgba(120, 183, 255, 0.18);
  --card-glow-strong: rgba(120, 183, 255, 0.32);
  --card-icon-bg: rgba(47, 126, 237, 0.12);
  --card-icon-bg-strong: rgba(47, 126, 237, 0.2);
  --card-panel: rgba(246, 250, 255, 0.9);
  --card-progress-bg: rgba(96, 149, 215, 0.22);
  --card-action-bg: rgba(47, 126, 237, 0.08);
  --card-action-bg-strong: rgba(47, 126, 237, 0.18);
  --surface-shadow: 0 14px 32px rgba(66, 121, 189, 0.14);
  --field-bg: rgba(255, 255, 255, 0.92);
  --field-bg-focus: #ffffff;
  --field-ring: rgba(47, 126, 237, 0.18);
  --btn-primary-end: #2d6ae7;
  --btn-primary-text: #f8fbff;
  --btn-primary-shadow: rgba(47, 126, 237, 0.28);
  --btn-primary-shadow-hover: rgba(47, 126, 237, 0.4);
  --btn-ghost-bg: rgba(47, 126, 237, 0.08);
  --btn-ghost-border: rgba(47, 126, 237, 0.24);
  --btn-ghost-hover-bg: rgba(47, 126, 237, 0.16);
  --btn-ghost-hover-border: rgba(47, 126, 237, 0.42);
  padding: 48px clamp(24px, 6vw, 80px);
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: relative;
  min-height: 100vh;
  z-index: 1;
  color: var(--text);
  background:
    radial-gradient(circle at 12% 5%, var(--page-spot-1), transparent 44%),
    radial-gradient(circle at 92% 90%, var(--page-spot-2), transparent 46%),
    linear-gradient(180deg, var(--page-bg-start) 0%, var(--page-bg-end) 100%);
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.05); }
  50% { transform: translate(-10px, 20px) scale(0.95); }
  75% { transform: translate(30px, 10px) scale(1.02); }
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
  box-shadow: var(--surface-shadow);
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
  background: var(--field-bg);
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
  background: var(--field-bg-focus);
  box-shadow: 0 0 0 4px var(--field-ring);
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

.theme-wrapper {
  min-width: 260px;
  flex: 1 1 260px;
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
  background: var(--field-bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7f98' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  appearance: none;
  transition: all 0.3s ease;
}

.sort-select:focus {
  outline: none;
  border-color: var(--panel-border-strong);
  background-color: var(--field-bg-focus);
}

.theme-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--field-bg);
  color: var(--text-muted);
  transition: all 0.2s ease;
}

.theme-option:hover {
  color: var(--text);
  border-color: var(--panel-border-strong);
}

.theme-option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--field-ring);
}

.theme-option.active {
  color: var(--accent-bright);
  border-color: var(--panel-border-strong);
  background: var(--accent-muted);
}

.theme-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 0 1px rgba(10, 20, 35, 0.1);
}

.theme-name {
  font-size: 12px;
  font-weight: 600;
}

.results-count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-left: 16px;
  border-left: 1px solid var(--panel-border);
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
  background: linear-gradient(135deg, var(--accent), var(--btn-primary-end));
  color: var(--btn-primary-text);
  box-shadow: 0 8px 20px var(--btn-primary-shadow);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px var(--btn-primary-shadow-hover);
}

.btn-large {
  padding: 16px 28px;
  font-size: 15px;
}

.btn-ghost {
  background: var(--btn-ghost-bg);
  border: 1px solid var(--btn-ghost-border);
  color: var(--text);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--btn-ghost-hover-bg);
  border-color: var(--btn-ghost-hover-border);
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
  /* 运动减少偏好设置 */
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

  .search-wrapper {
    max-width: none;
  }

  .sort-wrapper,
  .theme-wrapper {
    min-width: 0;
  }

  .results-count {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
    padding-top: 16px;
    border-top: 1px solid var(--panel-border);
    width: 100%;
    justify-content: center;
  }

  .project-grid {
    grid-template-columns: 1fr;
  }
}
</style>

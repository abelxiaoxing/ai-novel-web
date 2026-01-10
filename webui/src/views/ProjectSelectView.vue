<template>
  <div class="project-view fade-in">
    <header class="hero">
      <div>
        <p class="eyebrow">智能小说生成器</p>
        <h1>选择你的故事宇宙</h1>
        <p class="muted">
          在一个工作台中管理项目、打磨章节草稿、保持创作节奏。
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-primary" @click="showCreate = true">新建项目</button>
        <button class="btn btn-ghost" @click="refresh">刷新</button>
      </div>
    </header>

    <section class="project-controls">
      <label class="search-field">
        <span class="field-label">搜索项目</span>
        <input class="input-field" v-model="searchQuery" placeholder="输入项目名称" />
      </label>
      <label class="sort-field">
        <span class="field-label">排序</span>
        <select class="select-field" v-model="sortKey">
          <option value="name">名称</option>
          <option value="created_at">创建时间</option>
          <option value="updated_at">更新时间</option>
        </select>
      </label>
    </section>

    <section class="project-grid">
      <ProjectCard
        v-for="(project, index) in visibleProjects"
        :key="project.id"
        :project="project"
        class="stagger-item"
        :style="{ '--delay': `${index * 80}ms` }"
        @open="openProject(project.id)"
        @delete="confirmDelete(project.id, project.name)"
      />
      <div v-if="!projectStore.projects.length" class="empty-state">
        还没有项目，先创建一个开始吧。
      </div>
    </section>

    <div v-if="projectStore.loading" class="loading-banner">
      正在加载项目...
    </div>

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
  padding: 48px clamp(24px, 6vw, 80px);
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.hero h1 {
  margin: 6px 0 12px 0;
  font-size: clamp(28px, 4vw, 44px);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.28em;
  font-size: 12px;
  color: var(--accent-bright);
  margin: 0;
}

.hero-actions {
  display: flex;
  gap: 12px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

.project-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.search-field,
.sort-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
}

.field-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.empty-state {
  border: 1px dashed rgba(229, 225, 245, 0.2);
  border-radius: var(--radius-lg);
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
}

.loading-banner {
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(126, 91, 255, 0.16);
  border: 1px solid rgba(126, 91, 255, 0.35);
  color: var(--text-muted);
}

@media (max-width: 720px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<template>
  <ModalShell @close="$emit('close')">
    <div class="modal-header">
      <h2>向量库管理</h2>
      <p class="muted">查看和管理向量库中的内容</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <span class="loading-spinner"></span>
      <span>加载中...</span>
    </div>

    <!-- 内容区域 -->
    <div v-else-if="summary" class="vectorstore-content">
      <!-- 统计摘要 -->
      <div class="summary-section">
        <div class="summary-card">
          <span class="summary-label">总记录数</span>
          <span class="summary-value">{{ summary.total_count }}</span>
        </div>
      </div>

      <!-- 分组列表 -->
      <div class="groups-section">
        <h3 class="section-title">内容分组</h3>

        <div v-if="summary.groups.length === 0" class="empty-state">
          <span class="empty-icon">📭</span>
          <span class="empty-text">向量库为空</span>
        </div>

        <div v-else class="groups-list">
          <div
            v-for="group in sortedGroups"
            :key="groupKey(group)"
            class="group-item"
            :class="`group-item--${group.type}`"
          >
            <div class="group-info">
              <span class="group-icon">{{ groupIcon(group) }}</span>
              <div class="group-details">
                <span class="group-name">{{ groupName(group) }}</span>
                <span class="group-meta">{{ groupTypeLabel(group) }} · {{ group.count }} 条记录</span>
              </div>
            </div>
            <button
              v-if="group.type === 'chapter'"
              class="btn btn-danger btn-sm"
              @click="handleDeleteChapter(group.chapter)"
              title="删除此章节的向量"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ error }}</span>
    </div>

    <!-- 底部操作 -->
    <div class="modal-actions">
      <button class="btn btn-outline" @click="$emit('close')">关闭</button>
      <button v-if="summary && summary.total_count > 0" class="btn btn-ghost" @click="handleRefresh">
        刷新
      </button>
      <button v-if="summary && summary.total_count > 0" class="btn btn-danger" @click="handleClearAll">
        清空向量库
      </button>
    </div>
  </ModalShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ModalShell from "@/components/ModalShell.vue";
import {
  clearVectorStore,
  deleteVectorstoreChapter,
  getVectorstoreSummary,
} from "@/api/vectorstore";
import { getTaskStatus } from "@/api/tasks";
import type { VectorstoreSummaryResponse, VectorstoreGroup } from "@/api/types";

const props = defineProps<{
  projectId: string;
  embeddingConfigName?: string;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "deleted-chapter", chapter: number): void;
  (event: "cleared"): void;
}>();

const summary = ref<VectorstoreSummaryResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const taskTimeoutMs = 60000;

// 按章节号排序，知识库放在最后
const sortedGroups = computed(() => {
  if (!summary.value) return [];
  const groups = [...summary.value.groups];
  return groups.sort((a, b) => {
    // 知识库类型放在最后
    if (a.type === "knowledge") return 1;
    if (b.type === "knowledge") return -1;
    // 章节按编号排序
    return (a.chapter || 0) - (b.chapter || 0);
  });
});

const loadSummary = async () => {
  loading.value = true;
  error.value = null;
  try {
    const result = await getVectorstoreSummary(props.projectId, props.embeddingConfigName);
    summary.value = result;
  } catch (e) {
    console.error("Failed to load vectorstore summary:", e);
    error.value = "加载向量库信息失败";
  } finally {
    loading.value = false;
  }
};

const waitForTaskCompletion = async (taskId: string) => {
  const startedAt = Date.now();
  while (true) {
    const statusPayload = await getTaskStatus(taskId);
    if (statusPayload.status === "success") {
      return statusPayload;
    }
    if (statusPayload.status === "failed") {
      throw new Error(statusPayload.error || "任务执行失败");
    }
    if (statusPayload.status === "cancelled") {
      throw new Error(statusPayload.error || "任务已取消");
    }
    if (Date.now() - startedAt > taskTimeoutMs) {
      throw new Error("任务执行超时");
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
};

const handleRefresh = () => {
  loadSummary();
};

const handleDeleteChapter = async (chapter: number | undefined) => {
  if (chapter === undefined) return;
  if (!confirm(`确定要删除第 ${chapter} 章的所有向量记录吗？`)) return;

  loading.value = true;
  try {
    const payload = await deleteVectorstoreChapter(props.projectId, chapter, props.embeddingConfigName);
    await waitForTaskCompletion(payload.task_id);
    emit("deleted-chapter", chapter);
    // 刷新摘要
    await loadSummary();
  } catch (e) {
    console.error("Failed to delete chapter:", e);
    error.value = e instanceof Error ? e.message : "删除失败";
  } finally {
    loading.value = false;
  }
};

const handleClearAll = async () => {
  if (!confirm("确定要清空向量库吗？\n\n这将删除所有章节内容和知识库的向量记录，此操作不可恢复！")) return;

  loading.value = true;
  try {
    const payload = await clearVectorStore(props.projectId);
    await waitForTaskCompletion(payload.task_id);
    emit("cleared");
    emit("close");
  } catch (e) {
    console.error("Failed to clear vectorstore:", e);
    error.value = e instanceof Error ? e.message : "清空失败";
  } finally {
    loading.value = false;
  }
};

const groupKey = (group: VectorstoreGroup): string => {
  return group.type === "chapter" ? `chapter-${group.chapter}` : "knowledge";
};

const groupIcon = (group: VectorstoreGroup): string => {
  return group.type === "chapter" ? "📖" : "📚";
};

const groupName = (group: VectorstoreGroup): string => {
  if (group.type === "chapter") {
    return `第 ${group.chapter} 章`;
  }
  return "知识库";
};

const groupTypeLabel = (group: VectorstoreGroup): string => {
  return group.type === "chapter" ? "章节内容" : "知识库导入";
};

onMounted(() => {
  loadSummary();
});
</script>

<style scoped>
:deep(.modal-panel) {
  width: min(500px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.modal-header {
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 0 0 6px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}

.modal-header .muted {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  color: var(--text-muted);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(126, 91, 255, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon,
.empty-icon {
  font-size: 32px;
}

.error-text,
.empty-text {
  font-size: 14px;
}

.vectorstore-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  min-height: 0;
}

.summary-section {
  display: flex;
  gap: 12px;
}

.summary-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: rgba(126, 91, 255, 0.08);
  border: 1px solid rgba(126, 91, 255, 0.2);
  border-radius: 12px;
}

.summary-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--accent-bright);
}

.groups-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: rgba(15, 11, 22, 0.6);
  border: 1px solid rgba(229, 225, 245, 0.08);
  border-radius: 10px;
  transition: all 0.2s;
}

.group-item:hover {
  background: rgba(15, 11, 22, 0.8);
  border-color: rgba(126, 91, 255, 0.2);
}

.group-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-icon {
  font-size: 20px;
}

.group-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.group-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

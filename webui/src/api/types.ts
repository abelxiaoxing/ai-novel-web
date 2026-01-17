import type { ChapterState } from "@/stores/workflow";

export interface Project {
  id: string;
  name: string;
  topic?: string;
  genre?: string;
  num_chapters?: number;
  word_number?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectListResponse {
  projects?: Project[];
}

export interface FileEntry {
  path: string;
  name: string;
  type?: "file" | "folder";
  children?: FileEntry[];
}

export interface ProjectFilesResponse {
  files?: string[];
  entries?: FileEntry[];
}

export interface ChapterListResponse {
  chapters?: number[];
}

export interface FileContentResponse {
  content?: string;
}

export interface WorkbenchFormState {
  topic?: string;
  genre?: string;
  numberOfChapters?: string;
  wordNumber?: string;
  userGuidance?: string;
  chapterNumber?: string;
  charactersInvolved?: string;
  keyItems?: string;
  sceneLocation?: string;
  timeConstraint?: string;
  llmConfigName?: string;
  embeddingConfigName?: string;
  batchEndChapter?: string;
}

export interface WorkflowSnapshot {
  // 新格式：章节状态映射
  chapterStatuses?: Record<number, ChapterState>;
  // 旧格式：已定稿的章节列表（兼容）
  finalizedChapters?: number[];
}

export interface BatchTaskState {
  taskId: string;
  start: number;
  end: number;
  delaySeconds: number;
}

export interface ProjectState {
  form?: WorkbenchFormState;
  activeFile?: {
    path: string;
    kind: "file" | "chapter";
    chapterNumber?: number;
  };
  workflow?: WorkflowSnapshot;
  batchTask?: BatchTaskState;
}

export type TaskStatus = "pending" | "running" | "success" | "failed";

export interface TaskResponse {
  task_id: string;
}

export interface TaskStatusResponse {
  status: TaskStatus;
  result?: Record<string, unknown>;
  error?: string;
  output_files?: string[];
}

// 向量库相关类型
export interface VectorstoreGroup {
  type: "chapter" | "knowledge";
  chapter?: number;
  count: number;
}

export interface VectorstoreSummaryResponse {
  total_count: number;
  groups: VectorstoreGroup[];
}

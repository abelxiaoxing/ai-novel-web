export interface Project {
  id: string;
  name: string;
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
}

export interface ProjectState {
  form?: WorkbenchFormState;
  activeFile?: {
    path: string;
    kind: "file" | "chapter";
    chapterNumber?: number;
  };
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

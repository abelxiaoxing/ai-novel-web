import { apiFetch, encodePath } from "@/api/client";
import type {
  ChapterListResponse,
  FileContentResponse,
  Project,
  ProjectFilesResponse,
  ProjectListResponse,
  ProjectState,
} from "@/api/types";

export async function listProjects(): Promise<Project[]> {
  const data = await apiFetch<ProjectListResponse | Project[]>("/api/projects");
  if (Array.isArray(data)) {
    return data;
  }
  return data.projects ?? [];
}

export async function createProject(payload: Partial<Project>) {
  return apiFetch<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProject(projectId: string) {
  return apiFetch<Project>(`/api/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  return apiFetch<void>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function listProjectFiles(projectId: string) {
  return apiFetch<ProjectFilesResponse | string[]>(
    `/api/projects/${projectId}/files`
  );
}

export async function getProjectFile(projectId: string, path: string) {
  return apiFetch<FileContentResponse | string>(
    `/api/projects/${projectId}/files/${encodePath(path)}`
  );
}

export async function updateProjectFile(
  projectId: string,
  path: string,
  content: string
) {
  return apiFetch<void>(`/api/projects/${projectId}/files/${encodePath(path)}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function listChapters(projectId: string) {
  return apiFetch<ChapterListResponse | number[]>(
    `/api/projects/${projectId}/chapters`
  );
}

export async function getChapter(projectId: string, number: number) {
  return apiFetch<FileContentResponse | string>(
    `/api/projects/${projectId}/chapters/${number}`
  );
}

export async function updateChapter(
  projectId: string,
  number: number,
  content: string
) {
  return apiFetch<void>(`/api/projects/${projectId}/chapters/${number}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function getProjectState(projectId: string) {
  return apiFetch<ProjectState>(`/api/projects/${projectId}/state`);
}

export async function updateProjectState(
  projectId: string,
  payload: Partial<ProjectState>
) {
  return apiFetch<void>(`/api/projects/${projectId}/state`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

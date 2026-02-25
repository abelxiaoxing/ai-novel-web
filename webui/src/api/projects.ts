import { ApiError, apiFetch, buildUrl, encodePath } from "@/api/client";
import type {
  ChapterListResponse,
  FileContentResponse,
  Project,
  ProjectFilesResponse,
  ProjectListResponse,
  ProjectState,
} from "@/api/types";

export type ProjectExportFormat = "txt" | "epub";

function parseFilenameFromDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
  return plainMatch?.[1] ?? null;
}

function projectPath(projectId: string, suffix = ""): string {
  return `/api/projects/${projectId}${suffix}`;
}

function chapterPath(projectId: string, number: number, suffix = ""): string {
  return projectPath(projectId, `/chapters/${number}${suffix}`);
}

function jsonBody(payload: unknown): string {
  return JSON.stringify(payload);
}

export async function listProjects(): Promise<Project[]> {
  const data = await apiFetch<ProjectListResponse | Project[]>("/api/projects");
  return Array.isArray(data) ? data : data.projects ?? [];
}

export async function createProject(payload: Partial<Project>) {
  return apiFetch<Project>("/api/projects", {
    method: "POST",
    body: jsonBody(payload),
  });
}

export async function getProject(projectId: string) {
  return apiFetch<Project>(projectPath(projectId));
}

export async function deleteProject(projectId: string) {
  return apiFetch<void>(projectPath(projectId), {
    method: "DELETE",
  });
}

export async function listProjectFiles(projectId: string) {
  return apiFetch<ProjectFilesResponse | string[]>(projectPath(projectId, "/files"));
}

export async function getProjectFile(projectId: string, path: string) {
  return apiFetch<FileContentResponse | string>(
    projectPath(projectId, `/files/${encodePath(path)}`)
  );
}

export async function updateProjectFile(
  projectId: string,
  path: string,
  content: string
) {
  return apiFetch<void>(projectPath(projectId, `/files/${encodePath(path)}`), {
    method: "PUT",
    body: jsonBody({ content }),
  });
}

export async function listChapters(projectId: string) {
  return apiFetch<ChapterListResponse | number[]>(projectPath(projectId, "/chapters"));
}

export async function getChapter(projectId: string, number: number) {
  return apiFetch<FileContentResponse | string>(chapterPath(projectId, number));
}

export async function updateChapter(
  projectId: string,
  number: number,
  content: string
) {
  return apiFetch<void>(chapterPath(projectId, number), {
    method: "PUT",
    body: jsonBody({ content }),
  });
}

export async function deleteChapter(projectId: string, number: number) {
  return apiFetch<void>(chapterPath(projectId, number), {
    method: "DELETE",
  });
}

export async function renameChapter(
  projectId: string,
  number: number,
  newNumber: number
) {
  return apiFetch<void>(chapterPath(projectId, number, "/rename"), {
    method: "POST",
    body: jsonBody({ new_number: newNumber }),
  });
}

export async function getProjectState(projectId: string) {
  return apiFetch<ProjectState>(projectPath(projectId, "/state"));
}

export async function updateProjectState(
  projectId: string,
  payload: Partial<ProjectState>
) {
  return apiFetch<void>(projectPath(projectId, "/state"), {
    method: "PUT",
    body: jsonBody(payload),
  });
}

export async function downloadProjectExport(
  projectId: string,
  format: ProjectExportFormat
): Promise<{ filename: string; blob: Blob }> {
  const response = await fetch(buildUrl(projectPath(projectId, `/export/${format}`)));
  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || "导出失败", response.status);
  }
  const filename =
    parseFilenameFromDisposition(response.headers.get("content-disposition")) ??
    `novel.${format}`;
  const blob = await response.blob();
  return { filename, blob };
}

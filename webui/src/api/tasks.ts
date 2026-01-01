import { apiFetch, buildUrl } from "@/api/client";
import type { TaskResponse, TaskStatusResponse } from "@/api/types";

export async function getTaskStatus(taskId: string) {
  return apiFetch<TaskStatusResponse>(`/api/tasks/${taskId}`);
}

export function getTaskStreamUrl(taskId: string) {
  return buildUrl(`/api/tasks/${taskId}/stream`);
}

export async function generateArchitecture(projectId: string, payload: Record<string, unknown>) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/architecture`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateBlueprint(projectId: string, payload: Record<string, unknown>) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/blueprint`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function buildPrompt(projectId: string, payload: Record<string, unknown>) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/build-prompt`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateDraft(projectId: string, payload: Record<string, unknown>) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function finalizeChapter(projectId: string, payload: Record<string, unknown>) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/finalize`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateBatch(projectId: string, payload: Record<string, unknown>) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/batch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function consistencyCheck(projectId: string, payload: Record<string, unknown>) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/consistency-check`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function importKnowledge(projectId: string, formData: FormData) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/knowledge/import`, {
    method: "POST",
    body: formData,
    headers: {},
  });
}

export async function clearVectorStore(projectId: string) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/vectorstore/clear`, {
    method: "POST",
  });
}

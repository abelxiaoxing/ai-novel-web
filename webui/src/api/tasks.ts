import { apiFetch, buildUrl } from "@/api/client";
import type { TaskResponse, TaskStatusResponse } from "@/api/types";

export async function getTaskStatus(taskId: string) {
  return apiFetch<TaskStatusResponse>(`/api/tasks/${taskId}`);
}

export async function cancelTask(taskId: string) {
  return apiFetch<void>(`/api/tasks/${taskId}/cancel`, {
    method: "POST",
  });
}

export function getTaskStreamUrl(taskId: string) {
  return buildUrl(`/api/tasks/${taskId}/stream`);
}

export function getDraftStreamUrl(projectId: string, params: {
  novel_number: number;
  word_number: number;
  characters_involved?: string;
  key_items?: string;
  scene_location?: string;
  time_constraint?: string;
  user_guidance?: string;
  llm_config_name?: string;
  embedding_config_name?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("novel_number", String(params.novel_number));
  searchParams.set("word_number", String(params.word_number));
  if (params.characters_involved) searchParams.set("characters_involved", params.characters_involved);
  if (params.key_items) searchParams.set("key_items", params.key_items);
  if (params.scene_location) searchParams.set("scene_location", params.scene_location);
  if (params.time_constraint) searchParams.set("time_constraint", params.time_constraint);
  if (params.user_guidance) searchParams.set("user_guidance", params.user_guidance);
  if (params.llm_config_name) searchParams.set("llm_config_name", params.llm_config_name);
  if (params.embedding_config_name) searchParams.set("embedding_config_name", params.embedding_config_name);
  return buildUrl(`/api/projects/${projectId}/generate/draft/stream?${searchParams.toString()}`);
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

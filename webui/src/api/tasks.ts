import { apiFetch, buildUrl } from "@/api/client";
import { appendAccessKeyQuery } from "@/auth/accessKey";
import type { TaskResponse, TaskStatusResponse } from "@/api/types";

export type ChapterSharedPayload = {
  word_number: number;
  characters_involved?: string;
  key_items?: string;
  scene_location?: string;
  time_constraint?: string;
  user_guidance?: string;
  llm_config_name?: string;
  embedding_config_name?: string;
};

export type ChapterPayload = ChapterSharedPayload & {
  novel_number: number;
};

export type ArchitecturePayload = {
  topic: string;
  genre: string;
  number_of_chapters: number;
  word_number: number;
  user_guidance?: string;
  llm_config_name?: string;
};

export type BlueprintPayload = {
  number_of_chapters: number;
  user_guidance?: string;
  llm_config_name?: string;
};

export type DraftPayload = ChapterPayload;

export type FinalizePayload = {
  novel_number: number;
  word_number: number;
  llm_config_name?: string;
  embedding_config_name?: string;
};

export type BatchPayload = ChapterSharedPayload & {
  start_chapter: number;
  end_chapter: number;
  delay_seconds: number;
};

export type ConsistencyCheckPayload = {
  novel_setting: string;
  character_state: string;
  global_summary: string;
  chapter_text: string;
  llm_config_name?: string;
};

export type ChapterSharedPayloadInput = {
  wordNumber: number;
  charactersInvolved?: string;
  keyItems?: string;
  sceneLocation?: string;
  timeConstraint?: string;
  userGuidance?: string;
  llmConfigName?: string;
  embeddingConfigName?: string;
};

export type ChapterPayloadInput = ChapterSharedPayloadInput & {
  chapterNumber: number;
};

export function buildChapterSharedPayload(input: ChapterSharedPayloadInput): ChapterSharedPayload {
  return {
    word_number: input.wordNumber,
    characters_involved: input.charactersInvolved,
    key_items: input.keyItems,
    scene_location: input.sceneLocation,
    time_constraint: input.timeConstraint,
    user_guidance: input.userGuidance,
    llm_config_name: input.llmConfigName,
    embedding_config_name: input.embeddingConfigName,
  };
}

export function buildChapterPayload(input: ChapterPayloadInput): ChapterPayload {
  return {
    novel_number: input.chapterNumber,
    ...buildChapterSharedPayload(input),
  };
}

export async function getTaskStatus(taskId: string) {
  return apiFetch<TaskStatusResponse>(`/api/tasks/${taskId}`);
}

export async function cancelTask(taskId: string) {
  return apiFetch<void>(`/api/tasks/${taskId}/cancel`, {
    method: "POST",
  });
}

export function getTaskStreamUrl(taskId: string) {
  return buildUrl(appendAccessKeyQuery(`/api/tasks/${taskId}/stream`));
}

export function getDraftStreamUrl(projectId: string, params: ChapterPayload) {
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
  return buildUrl(
    appendAccessKeyQuery(`/api/projects/${projectId}/generate/draft/stream?${searchParams.toString()}`)
  );
}

export async function generateArchitecture(projectId: string, payload: ArchitecturePayload) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/architecture`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateBlueprint(projectId: string, payload: BlueprintPayload) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/blueprint`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateDraft(projectId: string, payload: DraftPayload) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function finalizeChapter(projectId: string, payload: FinalizePayload) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/finalize`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateBatch(projectId: string, payload: BatchPayload) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/generate/batch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function consistencyCheck(projectId: string, payload: ConsistencyCheckPayload) {
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

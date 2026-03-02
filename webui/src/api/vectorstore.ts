import { apiFetch } from "@/api/client";
import type { TaskResponse, VectorstoreSummaryResponse } from "@/api/types";

export async function getVectorstoreSummary(projectId: string, embeddingConfigName?: string) {
  const searchParams = new URLSearchParams();
  if (embeddingConfigName) {
    searchParams.set("embedding_config_name", embeddingConfigName);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return apiFetch<VectorstoreSummaryResponse>(`/api/projects/${projectId}/vectorstore${suffix}`);
}

export async function deleteVectorstoreChapter(projectId: string, chapterNumber: number, embeddingConfigName?: string) {
  const searchParams = new URLSearchParams();
  if (embeddingConfigName) {
    searchParams.set("embedding_config_name", embeddingConfigName);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/vectorstore/chapters/${chapterNumber}${suffix}`, {
    method: "DELETE",
  });
}

export async function clearVectorStore(projectId: string) {
  return apiFetch<TaskResponse>(`/api/projects/${projectId}/vectorstore/clear`, {
    method: "POST",
  });
}

import { apiFetch } from "@/api/client";

export type ConfigMap = Record<string, Record<string, unknown>>;
export type ConfigTestResponse = {
  ok: boolean;
  message?: string;
  sample?: string;
};

export async function getLlmConfigs() {
  return apiFetch<Record<string, unknown> | ConfigMap>("/api/config/llm");
}

export async function createLlmConfig(name: string, entry: Record<string, unknown>) {
  const payload = { name, ...entry };
  return apiFetch<void>("/api/config/llm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLlmConfig(name: string, entry: Record<string, unknown>) {
  return apiFetch<void>(`/api/config/llm/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(entry),
  });
}

export async function deleteLlmConfig(name: string) {
  return apiFetch<void>(`/api/config/llm/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function getEmbeddingConfigs() {
  return apiFetch<Record<string, unknown> | ConfigMap>("/api/config/embedding");
}

export async function createEmbeddingConfig(name: string, entry: Record<string, unknown>) {
  const payload = { name, ...entry };
  return apiFetch<void>("/api/config/embedding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEmbeddingConfig(name: string, entry: Record<string, unknown>) {
  return apiFetch<void>(`/api/config/embedding/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(entry),
  });
}

export async function deleteEmbeddingConfig(name: string) {
  return apiFetch<void>(`/api/config/embedding/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function getChooseConfigs() {
  return apiFetch<Record<string, unknown> | { choose_configs?: Record<string, string> }>(
    "/api/config/choose"
  );
}

export async function getProxyConfig() {
  return apiFetch<Record<string, unknown>>("/api/config/proxy");
}

export async function updateProxyConfig(payload: Record<string, unknown>) {
  return apiFetch<void>("/api/config/proxy", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getWebdavConfig() {
  return apiFetch<Record<string, unknown>>("/api/config/webdav");
}

export async function updateWebdavConfig(payload: Record<string, unknown>) {
  return apiFetch<void>("/api/config/webdav", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function testLlmConfig(entry: Record<string, unknown>) {
  return apiFetch<ConfigTestResponse>("/api/config/test/llm", {
    method: "POST",
    body: JSON.stringify({ entry }),
  });
}

export async function testEmbeddingConfig(entry: Record<string, unknown>) {
  return apiFetch<ConfigTestResponse>("/api/config/test/embedding", {
    method: "POST",
    body: JSON.stringify({ entry }),
  });
}

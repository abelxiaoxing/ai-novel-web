import {
  ACCESS_KEY_HEADER_NAME,
  clearAccessKey,
  getAccessKey,
} from "@/auth/accessKey";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function buildUrl(path: string) {
  if (!API_BASE) {
    return path;
  }
  return `${API_BASE}${path}`;
}

export function getAuthHeaders(): Record<string, string> {
  const key = getAccessKey();
  if (!key) {
    return {};
  }
  return {
    [ACCESS_KEY_HEADER_NAME]: key,
  };
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const defaultHeaders: Record<string, string> = {};
  if (!isFormData) {
    defaultHeaders["Content-Type"] = "application/json";
  }
  Object.assign(defaultHeaders, getAuthHeaders());

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessKey();
      if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
    }
    const message = await response.text();
    throw new ApiError(message || "请求失败", response.status);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export function encodePath(path: string) {
  return encodeURIComponent(path).replace(/%2F/g, "/");
}

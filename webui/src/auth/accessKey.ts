export const ACCESS_KEY_STORAGE_KEY = "ainovel:access-key";
export const ACCESS_KEY_HEADER_NAME = "X-Access-Key";
export const ACCESS_KEY_QUERY_NAME = "access_key";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAccessKey() {
  if (!canUseStorage()) {
    return "";
  }
  return window.localStorage.getItem(ACCESS_KEY_STORAGE_KEY)?.trim() ?? "";
}

export function setAccessKey(key: string) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(ACCESS_KEY_STORAGE_KEY, key.trim());
}

export function clearAccessKey() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(ACCESS_KEY_STORAGE_KEY);
}

export function hasAccessKey() {
  return getAccessKey().length > 0;
}

export function appendAccessKeyQuery(path: string) {
  const key = getAccessKey();
  if (!key) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${ACCESS_KEY_QUERY_NAME}=${encodeURIComponent(key)}`;
}

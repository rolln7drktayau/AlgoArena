const RAW_API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const DEV_BACKEND_FALLBACK = "http://127.0.0.1:8000";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const stripApiSuffix = (value: string): string => value.replace(/\/api$/i, "");

const normalizePath = (path: string): string => {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
};

export const buildApiUrl = (path: string): string => {
  const normalizedPath = normalizePath(path);
  let base = trimTrailingSlash(RAW_API_BASE);
  if (base.startsWith("/")) {
    base = `${trimTrailingSlash(DEV_BACKEND_FALLBACK)}${base}`;
  }
  const baseHasApi = /\/api$/i.test(base);

  if (baseHasApi && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.slice(4)}`;
  }
  if (!baseHasApi && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath}`;
  }
  if (baseHasApi && !normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath}`;
  }
  return `${base}${normalizedPath}`;
};

export const buildWsUrl = (path: string): string => {
  let httpBase = trimTrailingSlash(stripApiSuffix(RAW_API_BASE));
  if (httpBase.startsWith("/")) {
    httpBase = trimTrailingSlash(stripApiSuffix(DEV_BACKEND_FALLBACK));
  }
  const wsBase = httpBase.replace(/^http/i, "ws");
  return `${wsBase}${normalizePath(path)}`;
};

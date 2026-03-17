const DEFAULT_API_BASE_URL = "http://localhost:3000/api";

function normalizeApiBaseUrl(value) {
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const normalizedUrl = new URL(value);
    const pathname = normalizedUrl.pathname.replace(/\/+$/, "");
    normalizedUrl.pathname = pathname.endsWith("/api") ? pathname : `${pathname}/api`;
    return normalizedUrl.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

export function buildBackendAssetUrl(assetPath) {
  if (!assetPath) {
    return "";
  }

  try {
    const absoluteUrl = new URL(assetPath);
    return new URL(`${absoluteUrl.pathname}${absoluteUrl.search}`, `${API_ORIGIN}/`).toString();
  } catch {
    const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
    return new URL(normalizedPath, `${API_ORIGIN}/`).toString();
  }
}
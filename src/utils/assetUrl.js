// Build version timestamp for cache-busting CMS static assets
export const BUILD_VERSION = "1.0.1";

/**
 * Appends a version query parameter (?v=...) to static image and media URLs.
 * This guarantees instant cache-invalidation on browser when assets change,
 * while allowing long-term immutable caching on Cloudflare CDN.
 */
export function assetUrl(path) {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("/video/")
  ) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${BUILD_VERSION}`;
}

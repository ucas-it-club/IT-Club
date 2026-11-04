import type { Content } from "./model";

const driveFileIdPattern = /^[A-Za-z0-9_-]{10,}$/;

function safeHttpsUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Convert a public Google Drive share link into an image URL suitable for <img>. */
export function googleDriveImageUrl(value: string | undefined) {
  if (!value?.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      !["drive.google.com", "www.drive.google.com"].includes(url.hostname)
    )
      return undefined;

    const pathId = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
    const id = pathId || url.searchParams.get("id") || "";
    if (!driveFileIdPattern.test(id)) return undefined;

    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w2000`;
  } catch {
    return undefined;
  }
}

/** Prefer Drive-hosted article images while retaining existing legacy images. */
export function contentImageUrls(item: Pick<Content, "driveImageUrls" | "images">) {
  const urls = [
    ...(item.driveImageUrls
      ?.map(googleDriveImageUrl)
      .filter((url): url is string => Boolean(url)) ?? []),
    ...(item.images?.map(safeHttpsUrl).filter((url): url is string => Boolean(url)) ?? []),
  ];

  return [...new Set(urls)];
}

import "server-only";

/**
 * File storage on Supabase Storage, reached over its REST API.
 *
 * Two buckets:
 *   studio-photos      public  — set and option photography, served by CDN
 *   booking-documents  private — client uploads such as teleprompter scripts,
 *                                reached only via short-lived signed URLs
 *
 * All calls run server-side with the service role key, because this app has
 * its own session system rather than Supabase Auth, so there is no end-user
 * JWT for storage policies to check. The key must never reach the browser.
 */

export const PHOTO_BUCKET = "studio-photos";
export const DOCUMENT_BUCKET = "booking-documents";

export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export const DOCUMENT_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/rtf",
  "application/rtf",
];
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

function projectUrl(): string | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

export function isStorageConfigured(): boolean {
  return Boolean(projectUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function missingStorageEnv(): string[] {
  const missing: string[] = [];
  if (!projectUrl()) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

/** Keeps the original name recognisable while guaranteeing a unique path. */
export function safeObjectName(fileName: string): string {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-80);
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${random}-${cleaned || "file"}`;
}

export type UploadResult =
  | { ok: true; path: string; publicUrl: string | null }
  | { ok: false; error: string };

export async function uploadObject(
  bucket: string,
  path: string,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<UploadResult> {
  const base = projectUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return { ok: false, error: "File storage is not configured." };
  }

  const response = await fetch(
    `${base}/storage/v1/object/${bucket}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "public, max-age=31536000, immutable",
      },
      body: body instanceof Buffer ? new Uint8Array(body) : new Uint8Array(body),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, error: `Upload failed (${response.status}). ${detail}`.trim() };
  }

  return {
    ok: true,
    path,
    publicUrl: bucket === PHOTO_BUCKET ? `${base}/storage/v1/object/public/${bucket}/${path}` : null,
  };
}

export async function deleteObject(bucket: string, path: string): Promise<void> {
  const base = projectUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return;

  await fetch(`${base}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => undefined);
}

/**
 * A temporary link to a private object. Scripts are only ever handed out this
 * way, so a leaked URL stops working within the hour.
 */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const base = projectUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;

  const response = await fetch(`${base}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { signedURL?: string };
  return data.signedURL ? `${base}/storage/v1${data.signedURL}` : null;
}

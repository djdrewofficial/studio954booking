import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  PHOTO_MIME,
  isStorageConfigured,
  safeObjectName,
  uploadObject,
} from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Single upload endpoint for both photography and client documents.
 *
 * Photos are admin-only and land in the public bucket. Documents are the
 * teleprompter scripts, which land in the private bucket — a signed URL is
 * minted later, on demand, for whoever needs to read one.
 */
export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "File storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local." },
      { status: 503 },
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was included." }, { status: 400 });
  }

  const isPhoto = kind === "photo";
  if (isPhoto && user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can change studio photos." }, { status: 403 });
  }

  const allowed = isPhoto ? PHOTO_MIME : DOCUMENT_MIME;
  const maxBytes = isPhoto ? PHOTO_MAX_BYTES : DOCUMENT_MAX_BYTES;

  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      {
        error: isPhoto
          ? "Please choose a JPG, PNG, WebP or AVIF image."
          : "Please choose a PDF, Word document or plain text file.",
      },
      { status: 415 },
    );
  }

  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `That file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  const bucket = isPhoto ? PHOTO_BUCKET : DOCUMENT_BUCKET;
  const folder = isPhoto ? "sets" : "scripts";
  const path = `${folder}/${safeObjectName(file.name)}`;

  const result = await uploadObject(bucket, path, await file.arrayBuffer(), file.type);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({
    path: result.path,
    url: result.publicUrl,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
}

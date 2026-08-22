import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { bookingFiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DOCUMENT_BUCKET, isStorageConfigured, signedUrl } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Hands out a teleprompter script.
 *
 * The bucket is private, so nothing is ever reachable by guessing a URL. This
 * route checks the session, then redirects to a signed link that expires in
 * five minutes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
  }

  const { id } = await params;
  const [file] = await db
    .select({ storagePath: bookingFiles.storagePath })
    .from(bookingFiles)
    .where(eq(bookingFiles.id, id))
    .limit(1);

  if (!file) return NextResponse.json({ error: "That file no longer exists." }, { status: 404 });

  const url = await signedUrl(DOCUMENT_BUCKET, file.storagePath, 300);
  if (!url) {
    return NextResponse.json({ error: "That file could not be opened." }, { status: 502 });
  }

  return NextResponse.redirect(url);
}

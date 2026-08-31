import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

const MAX_BYTES = 8 * 1024 * 1024;

// Deliberately NOT under /api/admin/ or /api/artist/ — proxy.ts gates those
// path prefixes wholesale (admin-only, artist-only), and this needs to work
// for any authenticated user (admin, artist, or cause) uploading their own
// image or document. Auth is checked here instead: some logged-in user,
// not a specific role — this route performs no role-specific action, it
// just stores a file and returns its URL.
//
// Stored directly in Postgres (bytea) — a deliberate choice, not the
// default recommendation: serving artwork images out of the relational DB
// instead of a CDN-backed object store is slower for visitors and inflates
// Neon's storage-based billing for exactly the content that gets browsed
// most. Chosen anyway to avoid standing up a third-party storage account.
// Works identically on every host (no filesystem dependency at all, unlike
// the local-disk approach this replaced, which broke outright on
// serverless hosts like Vercel with a read-only filesystem outside /tmp) —
// reconsider real object storage if upload volume/size ever makes this a
// real cost or performance problem.
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type — use PNG, JPEG, WEBP, GIF, SVG, or PDF" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (8MB max)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await prisma.uploadedFile.create({
    data: { data: buffer, contentType: file.type },
  });

  return NextResponse.json({ url: `/api/uploads/${uploaded.id}` }, { status: 201 });
}

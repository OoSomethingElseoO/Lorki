import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

const MAX_BYTES = 8 * 1024 * 1024;

// Deliberately NOT under /api/admin/ or /api/seller/ — proxy.ts gates those
// path prefixes wholesale (admin-only, seller-only), and this needs to work
// for any authenticated user (admin, seller, or cause) uploading their own
// image or document. Auth is checked here instead: some logged-in user,
// not a specific role — this route performs no role-specific action, it
// just stores a file and returns its URL.
//
// Vercel Blob when BLOB_READ_WRITE_TOKEN is set (added automatically once a
// Blob store is created and linked to the project in the Vercel dashboard),
// local disk otherwise. This isn't a Vercel-only path — the token works
// from any host, so Render (or anywhere else) can opt in the same way by
// just setting the env var. Local disk remains the zero-setup default for
// a single self-hosted server with a persistent volume; it's NOT viable on
// Vercel specifically, since serverless functions there have a read-only
// filesystem outside /tmp — an upload would fail outright, not just vanish
// on redeploy.
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

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Unsupported file type — use PNG, JPEG, WEBP, GIF, SVG, or PDF" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (8MB max)" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${filename}`, file, { access: "public" });
    return NextResponse.json({ url: blob.url }, { status: 201 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
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
// just writes a file to disk and returns its URL.
//
// Local-disk storage: files land in public/uploads and are served directly
// by Next.js as static assets. This is an MVP choice — on a platform with an
// ephemeral filesystem (most serverless hosts) these files won't survive a
// redeploy, so swap this for object storage (S3/R2/similar) before deploying
// there. Fine for a self-hosted single server.
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

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}

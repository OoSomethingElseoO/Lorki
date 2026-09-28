import { apiContractError, apiJson } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isResizableImageType, resizeImage } from "@/lib/resize-image";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { isCloudinaryConfigured, uploadBuffer } from "@/lib/cloudinary";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const MAX_BYTES = 8 * 1024 * 1024;

function hasExpectedSignature(buffer: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (contentType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (contentType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  return false;
}

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
  if (await isRateLimited(`upload:${getRequestIp(request)}`, 20, 60 * 60 * 1000)) {
    return apiContractError("RATE_LIMITED", "Too many uploads. Please try again later.", 429);
  }
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return apiContractError("UNAUTHENTICATED", "Not signed in", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return apiContractError("INVALID_INPUT", "No file provided", 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return apiContractError("UNSUPPORTED_MEDIA_TYPE", "Unsupported file type — use PNG, JPEG, WEBP, GIF, or PDF", 400);
  }

  if (file.size > MAX_BYTES) {
    return apiContractError("FILE_TOO_LARGE", "File is too large (8MB max)", 413);
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(buffer, file.type)) {
    return apiContractError("INVALID_FILE", "The file contents do not match its declared type", 400);
  }

  // Resize/re-encode raster photos before they ever reach Postgres — an
  // artist's original camera export can be 6MB+ at 3000px+ per side, which
  // is a 15-20+ second download per image on a real connection with no CDN
  // in front of it (see /api/uploads/[id]). Not applied to GIF (would
  // flatten animation) or SVG (already tiny, vector).
  if (isResizableImageType(file.type)) {
    try {
      buffer = await resizeImage(buffer, file.type);
    } catch {
      return apiContractError("INVALID_FILE", "Could not process this image — the file may be corrupted", 400);
    }
  }

  if (isCloudinaryConfigured()) {
    try {
      const uploaded = await uploadBuffer(buffer, file.type);
      return apiJson({ url: uploaded.secure_url }, { status: 201 });
    } catch (error) {
      console.error("[uploads] Cloudinary upload failed", error);
      return apiContractError("UPLOAD_FAILED", "Could not store the file", 502);
    }
  }

  const uploaded = await prisma.uploadedFile.create({ data: { data: buffer, contentType: file.type } });
  return apiJson({ url: `/api/uploads/${uploaded.id}` }, { status: 201 });
}

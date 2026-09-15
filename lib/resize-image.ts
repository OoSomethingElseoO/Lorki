import sharp from "sharp";

// Artists upload straight off their camera/phone — original files have shown
// up as large as 6MB at 2900px+ per side, with full EXIF intact. Served
// as-is (the old behavior), that's a 15-20+ second download per image on a
// real connection, and /originals alone can render 8 of them at once. This
// resizes to something a browser actually needs and re-encodes at a much
// smaller size before it ever reaches Postgres.
const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 82;
const PNG_COMPRESSION_LEVEL = 9;
const WEBP_QUALITY = 82;

const RESIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isResizableImageType(contentType: string): boolean {
  return RESIZABLE_TYPES.has(contentType);
}

// Not applied to image/gif (would flatten animation) or image/svg+xml
// (already tiny, vector) — callers should only invoke this for types where
// isResizableImageType() is true.
export async function resizeImage(buffer: Buffer, contentType: string): Promise<Buffer<ArrayBuffer>> {
  // .rotate() with no args auto-orients from the EXIF orientation tag
  // before that metadata gets stripped (sharp strips metadata by default
  // unless .withMetadata() is called) — without this, a photo shot in
  // portrait on a phone can end up sideways once its orientation flag is
  // gone.
  let pipeline = sharp(buffer)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

  if (contentType === "image/png") {
    pipeline = pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL });
  } else if (contentType === "image/webp") {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY });
  }

  // toBuffer() types its result as Buffer<ArrayBufferLike> — Prisma's Bytes
  // field wants the narrower Buffer<ArrayBuffer>. sharp/Buffer never
  // actually back this with a SharedArrayBuffer; the cast just corrects a
  // type that's wider than what can occur at runtime.
  const resized = await pipeline.toBuffer();
  return resized as Buffer<ArrayBuffer>;
}

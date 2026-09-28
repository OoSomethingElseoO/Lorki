import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
const configured = Boolean(cloudinaryUrl);

if (cloudinaryUrl) {
  cloudinary.config({ cloudinary_url: cloudinaryUrl, secure: true });
}

export function isCloudinaryConfigured() {
  return configured;
}

export function uploadBuffer(buffer: Buffer, contentType: string, folder = "lorki/uploads"): Promise<UploadApiResponse> {
  if (!configured) return Promise.reject(new Error("CLOUDINARY_URL is not configured"));

  const resourceType = contentType === "application/pdf" ? "raw" : "image";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, use_filename: false, unique_filename: true, overwrite: false },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary upload returned no result"));
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
}

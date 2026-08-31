"use client";

import { useId, useState } from "react";
import { FileDropzone } from "@/components/ui/file-dropzone";

type ImageUploadFieldProps = {
  name: string;
  label: string;
  defaultValue?: string;
};

// Hybrid text-or-upload field: the underlying <input name=...> stays a plain
// URL string so it works with the surrounding form's existing FormData-based
// submit handlers unchanged — this component just offers a second way to
// fill it in, either typed or via /api/uploads (shared by admin, artist,
// and cause forms alike — see that route's own comment for why it isn't
// under /api/admin/).
export function ImageUploadField({ name, label, defaultValue }: ImageUploadFieldProps) {
  const id = useId();
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));

    setUploading(false);

    if (!response.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }

    setUrl(data.url);
  }

  return (
    <div className="admin-image-field">
      <label htmlFor={`${id}-text`}>{label}</label>
      <input
        id={`${id}-text`}
        name={name}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="/uploads/... or paste any image URL"
        required
      />
      <p className="admin-image-field__upload-label">{uploading ? "Uploading…" : "Or drag and drop a file below"}</p>
      <FileDropzone accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" maxSizeMB={10} onUpload={handleFile} />
      {error ? <p className="admin-form__error">{error}</p> : null}
      {url ? (
        <img src={url} alt="" className="admin-image-field__preview" />
      ) : null}
    </div>
  );
}

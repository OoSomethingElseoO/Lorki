"use client";

import { useId, useState } from "react";

type DocumentUploadFieldProps = {
  name: string;
  label: string;
  defaultValue?: string;
};

// Same hybrid text-or-upload pattern as ImageUploadField, but for a
// document (PDF or image scan of a certificate) rather than artwork —
// shows a filename/link instead of an <img> preview, since a PDF can't
// render as one. Posts to the same shared /api/uploads route.
export function DocumentUploadField({ name, label, defaultValue }: DocumentUploadFieldProps) {
  const id = useId();
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));

    setUploading(false);
    event.target.value = "";

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
        placeholder="/uploads/... or paste any document URL"
      />
      <label htmlFor={`${id}-file`} className="admin-image-field__upload-label">
        {uploading ? "Uploading…" : "Or upload a file (PDF or image)"}
      </label>
      <input id={`${id}-file`} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleFileChange} />
      {error ? <p className="admin-form__error">{error}</p> : null}
      {url ? (
        <p className="admin-form__hint">
          <a href={url} target="_blank" rel="noreferrer">
            View uploaded document
          </a>
        </p>
      ) : null}
    </div>
  );
}

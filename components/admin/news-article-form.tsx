"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";

type NewsArticleFormProps = {
  id?: string;
  initial?: {
    title: string;
    summary: string;
    body: string;
    imageUrl: string;
  };
};

export function NewsArticleForm({ id, initial }: NewsArticleFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(isEditing ? `/api/admin/news/${id}` : "/api/admin/news", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        summary: form.get("summary"),
        body: form.get("body"),
        imageUrl: form.get("imageUrl"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? `Failed to ${isEditing ? "save" : "create"} article`);
      return;
    }

    if (isEditing) {
      router.push("/admin/news");
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="title">Title</label>
      <input id="title" name="title" required defaultValue={initial?.title} />

      <label htmlFor="summary">Summary</label>
      <textarea id="summary" name="summary" required rows={2} defaultValue={initial?.summary} />

      <label htmlFor="body">Body</label>
      <textarea id="body" name="body" required rows={8} defaultValue={initial?.body} />

      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial?.imageUrl} />

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add article"}
      </button>
    </form>
  );
}

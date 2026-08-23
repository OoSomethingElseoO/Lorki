"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";

type SocialLinkInput = { platform: string; url: string };

type ArtistFormProps = {
  coOps: { id: string; name: string }[];
  id?: string;
  initial?: {
    name: string;
    country: string;
    bio: string;
    imageUrl: string;
    coOpId: string | null;
    socialLinks: SocialLinkInput[];
  };
};

export function ArtistForm({ coOps, id, initial }: ArtistFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinkInput[]>(
    initial?.socialLinks.length ? initial.socialLinks : [{ platform: "", url: "" }],
  );
  const isEditing = Boolean(id);

  function updateSocialLink(index: number, field: keyof SocialLinkInput, value: string) {
    setSocialLinks((current) =>
      current.map((link, linkIndex) => (linkIndex === index ? { ...link, [field]: value } : link)),
    );
  }

  function addSocialLink() {
    setSocialLinks((current) => [...current, { platform: "", url: "" }]);
  }

  function removeSocialLink(index: number) {
    setSocialLinks((current) => current.filter((_, linkIndex) => linkIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form element now — React nulls event.currentTarget once
    // the event finishes dispatching, so using it after the `await fetch`
    // below throws "Cannot read properties of null (reading 'reset')" and
    // silently aborts before router.refresh() ever runs.
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const form = new FormData(formElement);
    const coOpId = form.get("coOpId");

    const response = await fetch(isEditing ? `/api/admin/artists/${id}` : "/api/admin/artists", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        country: form.get("country"),
        bio: form.get("bio"),
        imageUrl: form.get("imageUrl"),
        coOpId: coOpId || undefined,
        socialLinks: socialLinks.filter((link) => link.platform && link.url),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? `Failed to ${isEditing ? "save" : "create"} artist`);
      return;
    }

    if (isEditing) {
      router.push("/admin/artists");
      return;
    }

    formElement.reset();
    setSocialLinks([{ platform: "", url: "" }]);
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required defaultValue={initial?.name} />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" required placeholder="Kenya" defaultValue={initial?.country} />

      <label htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" required rows={4} defaultValue={initial?.bio} />

      <ImageUploadField name="imageUrl" label="Image" defaultValue={initial?.imageUrl} />

      <label htmlFor="coOpId">Co-op (optional)</label>
      <select id="coOpId" name="coOpId" defaultValue={initial?.coOpId ?? ""}>
        <option value="">No co-op</option>
        {coOps.map((coOp) => (
          <option key={coOp.id} value={coOp.id}>
            {coOp.name}
          </option>
        ))}
      </select>

      <fieldset className="admin-form__social-links">
        <legend>Social links</legend>
        {socialLinks.map((link, index) => (
          <div className="admin-form__social-link-row" key={index}>
            <input
              placeholder="Instagram"
              value={link.platform}
              onChange={(event) => updateSocialLink(index, "platform", event.target.value)}
            />
            <input
              placeholder="https://instagram.com/..."
              value={link.url}
              onChange={(event) => updateSocialLink(index, "url", event.target.value)}
            />
            <Button type="button" variant="form" size="sm" onClick={() => removeSocialLink(index)} aria-label="Remove social link">
              &times;
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addSocialLink}>
          + Add another link
        </Button>
      </fieldset>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add artist"}
      </Button>
    </form>
  );
}

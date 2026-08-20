"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ArtistFormProps = {
  coOps: { id: string; name: string }[];
};

type SocialLinkInput = { platform: string; url: string };

export function ArtistForm({ coOps }: ArtistFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinkInput[]>([{ platform: "", url: "" }]);

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
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const coOpId = form.get("coOpId");

    const response = await fetch("/api/admin/artists", {
      method: "POST",
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
      setError(data.error ?? "Failed to create artist");
      return;
    }

    event.currentTarget.reset();
    setSocialLinks([{ platform: "", url: "" }]);
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" required placeholder="Kenya" />

      <label htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" required rows={4} />

      <label htmlFor="imageUrl">Image URL</label>
      <input id="imageUrl" name="imageUrl" required placeholder="/artists/name.jpg" />

      <label htmlFor="coOpId">Co-op (optional)</label>
      <select id="coOpId" name="coOpId" defaultValue="">
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
            <button type="button" onClick={() => removeSocialLink(index)} aria-label="Remove social link">
              &times;
            </button>
          </div>
        ))}
        <button type="button" onClick={addSocialLink} className="admin-form__add-link">
          + Add another link
        </button>
      </fieldset>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Add artist"}
      </button>
    </form>
  );
}

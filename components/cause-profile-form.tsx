"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { DocumentUploadField } from "@/components/document-upload-field";
import { FormFieldError } from "@/components/ui/form-field-error";
import { useFormErrors } from "@/hooks/useFormErrors";

export type SaveFormHandle = { submit: () => Promise<boolean> };

type CauseProfileFormProps = {
  initial: {
    name: string;
    region: string;
    mission: string;
    website: string;
    contactEmail: string;
    registrationNumber: string | null;
    registrationDocumentUrl: string | null;
    verifiedAt: Date | null;
  };
};

// Driven by a single combined "Save changes" button one level up (see
// app/cause/(dashboard)/profile/page.tsx) rather than its own submit
// button — this form's job is just to hold its own fields/validation and
// expose an imperative submit() the page can call alongside the payout
// form's, so one click saves both instead of two separate fragments.
export const CauseProfileForm = forwardRef<SaveFormHandle, CauseProfileFormProps>(function CauseProfileForm(
  { initial },
  ref,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const { error, clearErrors, setError, getFieldError } = useFormErrors();
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function doSubmit(): Promise<boolean> {
    if (!formRef.current) return false;
    setSubmitting(true);
    clearErrors();
    setSuccess(false);

    const form = new FormData(formRef.current);
    const response = await fetch("/api/cause/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        region: form.get("region"),
        mission: form.get("mission"),
        website: form.get("website"),
        contactEmail: form.get("contactEmail"),
        registrationNumber: form.get("registrationNumber"),
        registrationDocumentUrl: form.get("registrationDocumentUrl"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data);
      return false;
    }

    setSuccess(true);
    return true;
  }

  useImperativeHandle(ref, () => ({ submit: doSubmit }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Enter-in-a-field still dispatches a native submit even though the
    // page's combined button is the intended entry point — route it
    // through the same path instead of letting the browser do its own
    // full-page form submission.
    event.preventDefault();
    void doSubmit();
  }

  return (
    <form ref={formRef} className="admin-form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Organization name</label>
        <input
          id="name"
          name="name"
          required
          defaultValue={initial.name}
          disabled={submitting}
          className={getFieldError("name") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("name")}
          aria-describedby={getFieldError("name") ? "name-error" : undefined}
        />
        {getFieldError("name") && <FormFieldError id="name-error" message={getFieldError("name")} />}
      </div>

      <div>
        <label htmlFor="region">Region</label>
        <input
          id="region"
          name="region"
          required
          defaultValue={initial.region}
          disabled={submitting}
          className={getFieldError("region") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("region")}
          aria-describedby={getFieldError("region") ? "region-error" : undefined}
        />
        {getFieldError("region") && <FormFieldError id="region-error" message={getFieldError("region")} />}
      </div>

      <div>
        <label htmlFor="mission">Mission</label>
        <textarea
          id="mission"
          name="mission"
          required
          rows={4}
          defaultValue={initial.mission}
          disabled={submitting}
          className={getFieldError("mission") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("mission")}
          aria-describedby={getFieldError("mission") ? "mission-error" : undefined}
        />
        {getFieldError("mission") && <FormFieldError id="mission-error" message={getFieldError("mission")} />}
      </div>

      <div>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="url"
          required
          defaultValue={initial.website}
          disabled={submitting}
          className={getFieldError("website") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("website")}
          aria-describedby={getFieldError("website") ? "website-error" : undefined}
        />
        {getFieldError("website") && <FormFieldError id="website-error" message={getFieldError("website")} />}
      </div>

      <div>
        <label htmlFor="contactEmail">Contact email</label>
        <input
          id="contactEmail"
          name="contactEmail"
          type="email"
          required
          defaultValue={initial.contactEmail}
          disabled={submitting}
          className={getFieldError("contactEmail") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("contactEmail")}
          aria-describedby={getFieldError("contactEmail") ? "contactEmail-error" : undefined}
        />
        {getFieldError("contactEmail") && (
          <FormFieldError id="contactEmail-error" message={getFieldError("contactEmail")} />
        )}
      </div>

      <div>
        <label htmlFor="registrationNumber">Registration number</label>
        <input
          id="registrationNumber"
          name="registrationNumber"
          required
          defaultValue={initial.registrationNumber ?? ""}
          disabled={submitting}
          className={getFieldError("registrationNumber") ? "form-input--error" : ""}
          aria-invalid={!!getFieldError("registrationNumber")}
          aria-describedby={getFieldError("registrationNumber") ? "registrationNumber-error" : undefined}
        />
        {getFieldError("registrationNumber") && (
          <FormFieldError id="registrationNumber-error" message={getFieldError("registrationNumber")} />
        )}
      </div>

      <DocumentUploadField
        name="registrationDocumentUrl"
        label="Registration certificate"
        defaultValue={initial.registrationDocumentUrl ?? undefined}
      />

      {initial.verifiedAt ? (
        <p className="admin-form__hint">
          Changing your name or registration number will require an admin to re-verify your cause before
          it can be used in new campaigns again.
        </p>
      ) : null}

      {error ? <p className="admin-form__error">Organization details: {error}</p> : null}
      {success ? <p className="admin-form__hint">Organization details saved.</p> : null}
    </form>
  );
});

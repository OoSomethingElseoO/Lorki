"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useOptionalTabs } from "@/components/ui/tabs";

export function AdminUserForm() {
  const router = useRouter();
  const tabs = useOptionalTabs();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create admin");
      return;
    }

    formElement.reset();
    // Switch back to the list tab so the new row is actually visible —
    // Tabs is uncontrolled local state, unaffected by router.refresh().
    tabs?.setValue("users");
    router.refresh();
  }

  return (
    <form className="admin-form admin-form--field-grid" onSubmit={handleSubmit}>
      <div className="admin-form__field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
      </div>

      <div className="admin-form__field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
      </div>

      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8} />
      </div>

      {error ? <p className="admin-form__error">{error}</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : "Add admin"}
      </Button>
    </form>
  );
}

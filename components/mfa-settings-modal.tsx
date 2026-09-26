"use client";

import { useState } from "react";
import { AccessibleModal } from "@/components/accessible-modal";
import { Button } from "@/components/ui/button";

type Props = { open: boolean; onClose: () => void; enabled: boolean };

export function MfaSettingsModal({ open, onClose, enabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<{ setupToken: string; secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true); setError("");
    const response = await fetch("/api/account/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setup" }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error?.message ?? "Could not start MFA setup"); return; }
    setSetup(data); setCode("");
  }

  async function confirmSetup() {
    if (!setup) return;
    setBusy(true); setError("");
    const response = await fetch("/api/account/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", setupToken: setup.setupToken, code }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error?.message ?? "That code is not valid"); return; }
    setEnabled(true); setSetup(null); setRecoveryCodes(data.recoveryCodes ?? []); setCode("");
  }

  async function disableMfa() {
    setBusy(true); setError("");
    const response = await fetch("/api/account/mfa", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error?.message ?? "Could not disable MFA"); return; }
    setEnabled(false); setCode("");
  }

  return <AccessibleModal title="Two-step verification" isOpen={open} onClose={onClose}>
    {recoveryCodes ? <div>
      <p><strong>Save these recovery codes now.</strong> Each code works once if you lose your authenticator. They will not be shown again.</p>
      <pre className="mfa-recovery-codes">{recoveryCodes.join("\n")}</pre>
      <Button type="button" onClick={() => setRecoveryCodes(null)}>I saved them</Button>
    </div> : setup ? <div>
      <p>Scan this setup URI in your authenticator app, or enter the secret manually.</p>
      <label htmlFor="mfa-secret">Secret</label>
      <input id="mfa-secret" readOnly value={setup.secret} className="form-input" />
      <label htmlFor="mfa-uri">Setup URI</label>
      <textarea id="mfa-uri" readOnly value={setup.otpauthUri} className="form-input" rows={3} />
      <label htmlFor="mfa-code">Authenticator code</label>
      <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="form-input" />
      {error ? <p className="buy-form__error">{error}</p> : null}
      <Button type="button" disabled={busy || code.length !== 6} onClick={confirmSetup}>{busy ? "Verifying…" : "Enable MFA"}</Button>
    </div> : <div>
      <p>{enabled ? "Two-step verification is protecting this account." : "Add an authenticator code after your password. This is required before a session is created when enabled."}</p>
      {enabled ? <>
        <label htmlFor="mfa-disable-code">Current authenticator code</label>
        <input id="mfa-disable-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="form-input" />
        {error ? <p className="buy-form__error">{error}</p> : null}
        <Button type="button" variant="outline" disabled={busy || code.length !== 6} onClick={disableMfa}>{busy ? "Disabling…" : "Disable MFA"}</Button>
      </> : <>
        {error ? <p className="buy-form__error">{error}</p> : null}
        <Button type="button" disabled={busy} onClick={startSetup}>{busy ? "Preparing…" : "Set up authenticator"}</Button>
      </>}
    </div>}
  </AccessibleModal>;
}

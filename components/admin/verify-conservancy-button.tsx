"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getRegistryLookup } from "@/lib/registry-lookups";

type VerifyConservancyChecklistProps = {
  conservancyId: string;
  name: string;
  region: string;
  registrationNumber: string | null;
  registrationDocumentUrl: string | null;
  payoutAccountHolderName: string | null;
};

// Not real KYC/KYB — this is a manual checklist for an admin to actually
// look at three things before a self-registered cause can be used in a
// campaign, not an automated compliance check. See the schema comment on
// Conservancy and the verify route for the full reasoning.
export function VerifyConservancyChecklist({
  conservancyId,
  name,
  region,
  registrationNumber,
  registrationDocumentUrl,
  payoutAccountHolderName,
}: VerifyConservancyChecklistProps) {
  const router = useRouter();
  const [registrationChecked, setRegistrationChecked] = useState(false);
  const [registrationVerificationMethod, setRegistrationVerificationMethod] = useState("");
  const [sanctionsChecked, setSanctionsChecked] = useState(false);
  const [payoutNameChecked, setPayoutNameChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allChecked =
    registrationChecked && registrationVerificationMethod.trim().length > 0 && sanctionsChecked && payoutNameChecked;
  const registry = getRegistryLookup(region);

  async function handleVerify() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/conservancies/${conservancyId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationChecked,
        registrationVerificationMethod,
        sanctionsChecked,
        payoutNameChecked,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to verify");
      return;
    }

    router.refresh();
  }

  return (
    <div className="admin-form">
      <label>
        <input type="checkbox" checked={registrationChecked} onChange={(e) => setRegistrationChecked(e.target.checked)} />{" "}
        Registration number <strong>{registrationNumber ?? "(none given)"}</strong> checks out
        {registry ? (
          <>
            {" "}
            in the{" "}
            <a href={registry.url} target="_blank" rel="noreferrer">
              {registry.authority}
            </a>
            {registry.hasFreeOnlineSearch
              ? " (free online search)"
              : " — no free instant search here; you may need to contact them directly or request a records search"}
          </>
        ) : (
          ` — no registry reference on file for "${region}"; search that country's official nonprofit/business registry directly`
        )}
        . A matching number alone doesn't prove this org is who they say — a real number can be reused by
        someone else, so also compare the registry's own listed name/contact against what was submitted.
      </label>
      <label htmlFor={`${conservancyId}-method`}>
        How was it actually checked? (a paid records search, an independently-found phone call, a
        sector-specific directory, etc. — required)
      </label>
      <input
        id={`${conservancyId}-method`}
        value={registrationVerificationMethod}
        onChange={(e) => setRegistrationVerificationMethod(e.target.value)}
        placeholder={registry?.hasFreeOnlineSearch ? `e.g. "Confirmed via ${registry.authority}"` : 'e.g. "PBORA paid records search, receipt #..."'}
      />
      <label>
        <input type="checkbox" checked={sanctionsChecked} onChange={(e) => setSanctionsChecked(e.target.checked)} />{" "}
        {name} and its contact aren't on a sanctions list (e.g.{" "}
        <a href="https://sanctionssearch.ofac.treas.gov/" target="_blank" rel="noreferrer">
          OFAC's SDN list
        </a>
        )
      </label>
      <label>
        <input type="checkbox" checked={payoutNameChecked} onChange={(e) => setPayoutNameChecked(e.target.checked)} />{" "}
        Payout account holder name{" "}
        <strong>{payoutAccountHolderName ?? "(not set yet)"}</strong> matches the organization's name
        {registrationDocumentUrl ? (
          <>
            {" "}
            —{" "}
            <a href={registrationDocumentUrl} target="_blank" rel="noreferrer">
              view registration document
            </a>
          </>
        ) : null}
      </label>
      <button type="button" onClick={handleVerify} disabled={!allChecked || submitting}>
        {submitting ? "Verifying…" : "Verify"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </div>
  );
}

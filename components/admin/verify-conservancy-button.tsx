"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getRegistryLookup } from "@/lib/registry-lookups";
import { AccessibleModal } from "@/components/accessible-modal";
import { useToast } from "@/components/admin/toast-provider";
import { CheckIcon } from "@/components/admin/icons";

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
//
// Lives in a modal rather than inline in the conservancies table: the
// checklist is several sentences plus 3 checkboxes plus a text field, and
// cramming that into one table column left it squeezed narrow with a lot
// of dead space beside it. The table row just gets a compact trigger
// button; the actual review happens with real width to work with.
export function VerifyConservancyChecklist({
  conservancyId,
  name,
  region,
  registrationNumber,
  registrationDocumentUrl,
  payoutAccountHolderName,
}: VerifyConservancyChecklistProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
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
      const message = data.error ?? "Failed to verify";
      setError(message);
      showToast(message, "error");
      return;
    }

    setIsOpen(false);
    showToast(`Verified ${name}`);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="admin-table__link-button" onClick={() => setIsOpen(true)}>
        <CheckIcon />
        Review &amp; verify
      </button>

      <AccessibleModal
        title={`Verify ${name}`}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        closeLabel="Close verification checklist"
      >
        <div className="admin-form admin-form--modal">
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
            <CheckIcon />
            {submitting ? "Verifying…" : "Verify"}
          </button>
          {error ? <p className="admin-form__error">{error}</p> : null}
        </div>
      </AccessibleModal>
    </>
  );
}

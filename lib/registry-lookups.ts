// Points an admin at the actual place to check a registration number —
// there is no universal API for this, every country runs its own registry
// and most aren't API-accessible at all. Deliberately only covers
// countries actually verified (each URL below was checked, not guessed)
// rather than fabricating a link for every country — a wrong link here is
// worse than none, since it'd send an admin somewhere that isn't
// authoritative. Keyed on a normalized (lowercased, trimmed) region name,
// same approach as lib/payout-recommendations.ts, since Conservancy.region
// is free text an org typed in, not an ISO code.
export type RegistryLookup = {
  authority: string;
  url: string;
  // Not every registry has a free, instant online search — say so rather
  // than implying one click always settles it.
  hasFreeOnlineSearch: boolean;
};

const REGISTRY_LOOKUPS: Record<string, RegistryLookup> = {
  kenya: {
    authority: "Public Benefit Organizations Regulatory Authority (formerly NGO Coordination Board)",
    url: "https://registration.pbora.go.ke/",
    hasFreeOnlineSearch: false,
  },
  ethiopia: {
    authority: "Authority for Civil Society Organizations (ACSO)",
    url: "https://acso.gov.et/en",
    hasFreeOnlineSearch: false,
  },
  "south africa": {
    authority: "Department of Social Development — NPO Register",
    url: "https://www.dsd.gov.za/index.php/npo",
    hasFreeOnlineSearch: true,
  },
  nigeria: {
    authority: "Corporate Affairs Commission (CAC) public search",
    url: "https://search.cac.gov.ng",
    hasFreeOnlineSearch: true,
  },
  "united states": {
    authority: "IRS Tax Exempt Organization Search",
    url: "https://apps.irs.gov/app/eos/",
    hasFreeOnlineSearch: true,
  },
  usa: {
    authority: "IRS Tax Exempt Organization Search",
    url: "https://apps.irs.gov/app/eos/",
    hasFreeOnlineSearch: true,
  },
  us: {
    authority: "IRS Tax Exempt Organization Search",
    url: "https://apps.irs.gov/app/eos/",
    hasFreeOnlineSearch: true,
  },
  "united kingdom": {
    authority: "Charity Commission for England and Wales — Register of Charities",
    url: "https://register-of-charities.charitycommission.gov.uk/",
    hasFreeOnlineSearch: true,
  },
  uk: {
    authority: "Charity Commission for England and Wales — Register of Charities",
    url: "https://register-of-charities.charitycommission.gov.uk/",
    hasFreeOnlineSearch: true,
  },
  canada: {
    authority: "Canada Revenue Agency — List of Charities",
    url: "https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyAdvncdSrch",
    hasFreeOnlineSearch: true,
  },
};

export function getRegistryLookup(region: string | null | undefined): RegistryLookup | null {
  if (!region) {
    return null;
  }
  return REGISTRY_LOOKUPS[region.trim().toLowerCase()] ?? null;
}

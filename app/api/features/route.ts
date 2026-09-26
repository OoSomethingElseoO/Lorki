import { featureFlags } from "@/lib/feature-flags";
import { apiJson } from "@/lib/api-contract";

/** Safe public capability snapshot: flags contain no credentials or secrets. */
export function GET() {
  return apiJson({ features: featureFlags() });
}

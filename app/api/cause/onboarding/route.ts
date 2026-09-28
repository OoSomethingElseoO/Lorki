import { apiContractError } from "@/lib/api-contract";

// Conservancies are curated by administrators. There is no public self-service
// onboarding endpoint; an admin creates the record and assigns it to a user
// when appropriate.
export async function POST() {
  return apiContractError("FORBIDDEN", "Conservancies are created and managed by administrators", 403);
}

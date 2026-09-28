import { redirect } from "next/navigation";

/**
 * Compatibility URL for old bookmarks. Conservancy records are created by
 * administrators, not through public signup.
 */
export default async function CauseSignupPage() {
  redirect("/signup");
}

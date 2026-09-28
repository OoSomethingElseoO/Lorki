import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CauseOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (user.conservancy) redirect("/cause/profile");
  redirect("/account");
}

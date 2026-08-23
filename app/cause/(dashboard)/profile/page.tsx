import { redirect } from "next/navigation";
import { CauseSettingsPanel } from "@/components/cause-settings-panel";
import { getCurrentUser } from "@/lib/auth";
import { recommendPayoutChannel } from "@/lib/payout-recommendations";

export const dynamic = "force-dynamic";

export default async function CauseProfilePage() {
  const currentUser = await getCurrentUser();
  const cause = currentUser?.conservancy;
  if (!cause) {
    redirect("/login");
  }

  return (
    <>
      <h1>Your Cause</h1>
      <p className="admin-form__hint">
        {cause.verifiedAt
          ? `Verified on ${new Date(cause.verifiedAt).toLocaleDateString()} — artists can select your cause for new campaigns.`
          : "Not verified yet — an admin needs to review your registration details before artists can select your cause for new campaigns."}
      </p>
      <CauseSettingsPanel cause={cause} recommendation={recommendPayoutChannel(cause.region)} />
    </>
  );
}

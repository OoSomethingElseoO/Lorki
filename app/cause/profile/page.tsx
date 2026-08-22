import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { CauseProfileForm } from "@/components/cause-profile-form";
import { PayoutSettingsForm } from "@/components/payout-settings-form";
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
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Your Cause</PageTitle>
        <p className="admin-form__hint">
          {cause.verifiedAt
            ? `Verified on ${new Date(cause.verifiedAt).toLocaleDateString()} — artists can select your cause for new campaigns.`
            : "Not verified yet — an admin needs to review your registration details before artists can select your cause for new campaigns."}
        </p>
        <CauseProfileForm
          initial={{
            name: cause.name,
            region: cause.region,
            mission: cause.mission,
            website: cause.website,
            contactEmail: cause.contactEmail,
            registrationNumber: cause.registrationNumber,
            registrationDocumentUrl: cause.registrationDocumentUrl,
            verifiedAt: cause.verifiedAt,
          }}
        />
        <h2>Payouts</h2>
        <PayoutSettingsForm
          initial={{
            payoutChannel: cause.payoutChannel,
            payoutCountry: cause.payoutCountry,
            payoutCurrency: cause.payoutCurrency,
            payoutMobileNetwork: cause.payoutMobileNetwork,
            payoutAccountNumber: cause.payoutAccountNumber,
            payoutBankCode: cause.payoutBankCode,
            stripeConnectOnboarded: cause.stripeConnectOnboarded,
            cryptoNetwork: cause.cryptoNetwork,
            cryptoAddress: cause.cryptoAddress,
            payoutAccountHolderName: cause.payoutAccountHolderName,
          }}
          recommendation={recommendPayoutChannel(cause.region)}
          endpoint="/api/cause/payout-settings"
          connectOnboardEndpoint="/api/cause/connect/onboard"
          requireAccountHolderName
        />
      </main>
    </>
  );
}

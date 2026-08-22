import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerProfileForm } from "@/components/seller-profile-form";
import { PayoutSettingsForm } from "@/components/payout-settings-form";
import { getCurrentUser } from "@/lib/auth";
import { recommendPayoutChannel } from "@/lib/payout-recommendations";

export const dynamic = "force-dynamic";

export default async function SellerProfilePage() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    redirect("/login");
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Your Profile</PageTitle>
        <SellerProfileForm
          initial={{ name: seller.name, country: seller.country, bio: seller.bio, imageUrl: seller.imageUrl }}
        />
        <h2>Payouts</h2>
        <PayoutSettingsForm
          initial={{
            payoutChannel: seller.payoutChannel,
            payoutCountry: seller.payoutCountry,
            payoutCurrency: seller.payoutCurrency,
            payoutMobileNetwork: seller.payoutMobileNetwork,
            payoutAccountNumber: seller.payoutAccountNumber,
            payoutBankCode: seller.payoutBankCode,
            stripeConnectOnboarded: seller.stripeConnectOnboarded,
            cryptoNetwork: seller.cryptoNetwork,
            cryptoAddress: seller.cryptoAddress,
          }}
          recommendation={recommendPayoutChannel(seller.country)}
          endpoint="/api/seller/payout-settings"
          connectOnboardEndpoint="/api/seller/connect/onboard"
        />
      </main>
    </>
  );
}

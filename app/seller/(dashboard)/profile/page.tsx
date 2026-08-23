import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerProfileForm } from "@/components/seller-profile-form";
import { PayoutSettingsForm } from "@/components/payout-settings-form";
import { getCurrentUser } from "@/lib/auth";
import { recommendPayoutChannel } from "@/lib/payout-recommendations";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SellerProfilePage() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    redirect("/login");
  }

  return (
    <>
      <h1>Your Profile</h1>
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

      <p style={{ marginTop: "2rem" }}>
        <Link href="/seller" className={buttonVariants({ variant: "outline" })}>
          Back to Dashboard
        </Link>
      </p>
    </>
  );
}

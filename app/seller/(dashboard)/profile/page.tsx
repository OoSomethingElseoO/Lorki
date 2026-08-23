import { redirect } from "next/navigation";
import { SellerSettingsPanel } from "@/components/seller-settings-panel";
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
      <h1>Your Profile</h1>
      <SellerSettingsPanel seller={seller} recommendation={recommendPayoutChannel(seller.country)} />
    </>
  );
}

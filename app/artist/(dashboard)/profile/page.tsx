import { redirect } from "next/navigation";
import { ArtistSettingsPanel } from "@/components/artist-settings-panel";
import { getCurrentUser } from "@/lib/auth";
import { recommendPayoutChannel } from "@/lib/payout-recommendations";

export const dynamic = "force-dynamic";

export default async function ArtistProfilePage() {
  const currentUser = await getCurrentUser();
  const artist = currentUser?.artist;
  if (!artist) {
    redirect("/login");
  }

  return (
    <>
      <h1>Your Profile</h1>
      <ArtistSettingsPanel artist={artist} recommendation={recommendPayoutChannel(artist.country)} />
    </>
  );
}

import { prisma } from "@/lib/prisma";
import { OfferActions } from "@/components/admin/offer-actions";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminOffersPage() {
  const user = await getCurrentUser();
  if (!checkPermission(user, "OPS_ADMIN").authorized) redirect("/login?next=/admin/offers");

  const offers = await prisma.offer.findMany({
    include: { artwork: { select: { title: true, saleMode: true, offerClosesAt: true } }, order: { select: { status: true } } },
    orderBy: [{ status: "asc" }, { amountCents: "desc" }, { submittedAt: "asc" }],
  });
  return <><h1>Offers and auctions</h1><p className="admin-form__hint">Review valid offers, accept a winner, and send the payment link.</p>
    <table className="admin-table"><thead><tr><th>Artwork</th><th>Mode</th><th>Bidder</th><th>Offer</th><th>Status</th><th>Submitted</th><th /></tr></thead><tbody>
      {offers.map((offer) => <tr key={offer.id}><td>{offer.artwork.title}</td><td>{offer.artwork.saleMode}</td><td>{offer.bidderEmail}</td><td>{offer.currency.toUpperCase()} {(offer.amountCents / 100).toFixed(2)}</td><td>{offer.status}</td><td>{offer.submittedAt.toLocaleString()}</td><td><OfferActions offerId={offer.id} status={offer.status} /></td></tr>)}
      {offers.length === 0 ? <tr><td colSpan={7}>No offers yet.</td></tr> : null}
    </tbody></table></>;
}

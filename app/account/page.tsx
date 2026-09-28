import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FallbackImage } from "@/components/ui/fallback-image";
import { OriginalsGrid } from "@/components/originals-grid";
import { AccountActionBar } from "@/components/account-action-bar";
import { AccountDeletionRequest } from "@/components/account-deletion-request";
import { getLiveArtworksByKind } from "@/lib/storefront";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Processing",
  PAID: "Preparing to ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  REFUNDED: "Refunded",
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [{ items: featuredArtworks, page: featuredPage, totalPages: featuredTotalPages }, orders] = await Promise.all([
    getLiveArtworksByKind("ORIGINAL", 1),
    prisma.order.findMany({
      where: { customerId: user.id },
      include: { artwork: true, shipment: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <AccountActionBar
        name={user.name || ""}
        email={user.email}
        hasArtist={Boolean(user.artist)}
        hasConservancy={Boolean(user.conservancy)}
        mfaEnabled={user.mfaEnabled}
      />
      <section className="account-discover" aria-labelledby="account-discover-title">
        <p className="eyebrow">For you</p>
        <h1 id="account-discover-title">Discover original work</h1>
        <p className="admin-form__hint">Explore new pieces from artists supporting conservation.</p>
        {featuredArtworks.length > 0 ? (
          <OriginalsGrid
            artworks={featuredArtworks}
            customerEmail={user.email}
            initialPage={featuredPage}
            totalPages={featuredTotalPages}
            infiniteScrollEnabled={false}
          />
        ) : <p className="centered-copy">No originals are available right now.</p>}
      </section>

      {(() => {
        // A customer can add either capability independently. Keep the
        // account dashboard useful even after one profile has been created.
        const showGetInvolved = !user.artist || !user.conservancy;

        const orderHistory =
          orders.length === 0 ? (
            <EmptyState
              icon={<Package />}
              title="No orders yet"
              description="Once you buy a piece, you'll be able to track it here."
              action={
                <Link href="/originals" className={buttonVariants()}>
                  Browse originals
                </Link>
              }
            />
          ) : (
            <ul className="account-orders__list">
              {orders.map((order) => (
                <li className="account-orders__item" key={order.id}>
                  <FallbackImage src={order.artwork.imageUrl} alt={order.artwork.altText} />
                  <div>
                    <h3>{order.artwork.title}</h3>
                    <p className="price">${(order.amountCents / 100).toFixed(2)}</p>
                    <p>{STATUS_LABELS[order.status] ?? order.status}</p>
                    {order.shipment?.trackingNumber ? (
                      <p>
                        Tracking: {order.shipment.trackingNumber} ({order.shipment.carrier})
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          );

        const getInvolvedCards = (
          // Flexbox keeps the independent actions balanced as either card
          // disappears after that profile has been created.
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {!user.artist ? (
              <Card variant="brand" style={{ flex: "1 1 16rem" }}>
                <h3 style={{ marginTop: 0 }}>Sell your art</h3>
                <p className="admin-form__hint">
                  Create an artist profile, submit your work, and support the wildlife cause behind each piece.
                </p>
                <Link href="/artist/onboarding" className={buttonVariants({ variant: "form" })}>
                  Start selling
                </Link>
              </Card>
            ) : null}
          </div>
        );

        // Keep the account page focused on orders when both optional profiles
        // already exist; otherwise show the independent next action(s).
        if (!showGetInvolved) {
          return (
            <section id="orders" className="account-orders" aria-label="Order history">
              <h2>Order history</h2>
              {orderHistory}
            </section>
          );
        }

        return (
          <Tabs defaultValue="get-involved" className="mt-6">
            <TabsList aria-label="Account sections">
              <TabsTrigger value="get-involved">Get involved</TabsTrigger>
              <TabsTrigger value="orders">Order history</TabsTrigger>
            </TabsList>
            <TabsContent value="get-involved">{getInvolvedCards}</TabsContent>
            <TabsContent id="orders" value="orders" className="account-orders">
              {orderHistory}
            </TabsContent>
          </Tabs>
        );
      })()}
      <AccountDeletionRequest />
    </>
  );
}

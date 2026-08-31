import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    include: { artwork: true, shipment: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <h1>My Account</h1>
      <p className="admin-form__hint">
        Signed in as <strong>{user.name || user.email}</strong>
      </p>

      {(() => {
        // One account can only ever be one of these (see the matching
        // check in /api/seller/onboarding and /api/cause/onboarding) — so
        // once a user has EITHER role there's nothing left to "get
        // involved" with; show the section only while they have neither.
        const showGetInvolved = !user.artist && !user.conservancy;

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
                  <img src={order.artwork.imageUrl} alt={order.artwork.altText} />
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
          // flexbox, not CSS grid with auto-fit: auto-fit's "collapse empty
          // tracks" behavior doesn't redistribute their space to a single
          // remaining item the way it looks like it should. flex-grow on
          // each card shares the row evenly. Both cards always render
          // together here — this whole block only renders when the user
          // has neither role yet (see showGetInvolved above), and picking
          // one is final, so there's no per-card "already have this one"
          // case to guard against anymore.
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Card variant="brand" style={{ flex: "1 1 16rem" }}>
              <h3 style={{ marginTop: 0 }}>Are you an artist?</h3>
              <p className="admin-form__hint">
                Sell your original work and prints — each sale splits proceeds between you and the wildlife
                cause your piece supports.
              </p>
              <Link href="/seller/onboarding" className={buttonVariants({ variant: "form" })}>
                Start selling
              </Link>
            </Card>
            <Card variant="brand" style={{ flex: "1 1 16rem" }}>
              <h3 style={{ marginTop: 0 }}>Represent a conservation cause?</h3>
              <p className="admin-form__hint">
                Register your organization so artists can pick your cause for new campaigns — you'll receive
                a share of every sale, once an admin verifies your registration.
              </p>
              <Link href="/cause/onboarding" className={buttonVariants({ variant: "form" })}>
                Register a cause
              </Link>
            </Card>
          </div>
        );

        // A single-tab "Tabs" is pointless UI — only show tabs when there's
        // genuinely something in "Get involved" to switch to (a user who's
        // already both an artist and a cause rep never sees that section at
        // all, so Order history renders alone, same as before).
        if (!showGetInvolved) {
          return (
            <section className="account-orders" aria-label="Order history">
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
            <TabsContent value="orders" className="account-orders">
              {orderHistory}
            </TabsContent>
          </Tabs>
        );
      })()}
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

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

      {!user.artist || !user.conservancy ? (
        <section aria-label="Get involved" style={{ marginTop: "1.5rem", marginBottom: "2rem" }}>
          <h2>Get involved</h2>
          {/* flexbox, not CSS grid with auto-fit: auto-fit's "collapse empty
              tracks" behavior doesn't redistribute their space to a single
              remaining item the way it looks like it should — a lone card
              (the common case: an artist-only or cause-only user only ever
              sees ONE of these two) ends up centered in a ~16rem column
              instead of spanning the row. flex-grow on each card fills the
              full width alone, or shares it evenly when both render — each
              card also needs maxWidth: "none" below, overriding the 36rem
              cap .admin-form normally applies for input-field readability,
              since that cap isn't relevant to a heading+paragraph+button
              card and was capping the single-card case at 36rem instead of
              letting it actually grow. */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {!user.artist ? (
              <div className="admin-form" style={{ flex: "1 1 16rem", maxWidth: "none" }}>
                <h3 style={{ marginTop: 0 }}>Are you an artist?</h3>
                <p className="admin-form__hint">
                  Sell your original work and prints — each sale splits proceeds between you and the wildlife
                  cause your piece supports.
                </p>
                <Link href="/seller/onboarding" className={buttonVariants({ variant: "form" })}>
                  Start selling
                </Link>
              </div>
            ) : null}
            {!user.conservancy ? (
              <div className="admin-form" style={{ flex: "1 1 16rem", maxWidth: "none" }}>
                <h3 style={{ marginTop: 0 }}>Represent a conservation cause?</h3>
                <p className="admin-form__hint">
                  Register your organization so artists can pick your cause for new campaigns — you'll receive
                  a share of every sale, once an admin verifies your registration.
                </p>
                <Link href="/cause/onboarding" className={buttonVariants({ variant: "form" })}>
                  Register a cause
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="account-orders" aria-label="Order history">
        <h2>Order history</h2>
          {orders.length === 0 ? (
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
          )}
      </section>
    </>
  );
}

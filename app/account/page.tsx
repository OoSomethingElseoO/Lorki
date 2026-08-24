import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";

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
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
            {!user.artist ? (
              <div className="admin-form">
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
              <div className="admin-form">
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
            <p>You haven&apos;t placed any orders yet.</p>
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

import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { AccountLogoutButton } from "@/components/account-logout-button";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Processing",
  PAID: "Preparing to ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  REFUNDED: "Refunded",
};

export default async function AccountPage() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    redirect("/account/login");
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: { artwork: true, shipment: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>My Account</PageTitle>
        <div className="account-summary">
          <p>
            Signed in as <strong>{customer.name || customer.email}</strong>
          </p>
          <AccountLogoutButton />
        </div>

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
      </main>
    </>
  );
}

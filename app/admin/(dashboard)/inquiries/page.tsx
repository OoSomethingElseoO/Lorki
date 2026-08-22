import { prisma } from "@/lib/prisma";
import { InquiryStatusForm } from "@/components/admin/inquiry-status-form";
import { getCampaignLabel } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  const inquiries = await prisma.inquiry.findMany({
    include: {
      artwork: { include: { campaign: { include: { animal: true, conservancy: true, artist: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <h1>Inquiries</h1>
      <p className="admin-form__hint">
        Interest in one-of-one originals — these go through a personal sale, not instant checkout. Follow up by
        email, then record the finished sale from /admin/orders.
      </p>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Artwork</th>
            <th>Buyer</th>
            <th>Message</th>
            <th>Status</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inquiry) => (
            <tr key={inquiry.id}>
              <td>
                {inquiry.artwork.title}
                <br />
                <span className="admin-form__hint">
                  {getCampaignLabel(inquiry.artwork.campaign)}
                </span>
              </td>
              <td>
                {inquiry.name}
                <br />
                <span className="admin-form__hint">{inquiry.email}</span>
              </td>
              <td>{inquiry.message ?? "—"}</td>
              <td>
                <InquiryStatusForm inquiryId={inquiry.id} status={inquiry.status} />
              </td>
              <td>{inquiry.createdAt.toLocaleDateString()}</td>
            </tr>
          ))}
          {inquiries.length === 0 ? (
            <tr>
              <td colSpan={5}>No inquiries yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

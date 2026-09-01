// Covers FAILED-payout revival end to end against the real running app:
// app/api/admin/payouts/[id]/revive/route.ts and
// components/admin/revive-payout-button.tsx.
//
// A FAILED payout only ever happens via a refund/chargeback clawback (see
// lib/refunds.ts and the Stripe webhook) — there's no UI path to create
// one, so every scenario seeds it directly via Prisma through the
// `failedPayout` fixture (tests/e2e/fixtures/test-fixtures.ts), exactly
// the way any E2E suite seeds hard-to-reach fixture data.
import { ADMIN_STORAGE_STATE } from "./fixtures/auth-storage";
import { createFailedPayoutFixture } from "./fixtures/db";
import { expect, prisma, test } from "./fixtures/test-fixtures";

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("FAILED payout revival", () => {
  test("a FAILED payout shows a Revive button on /admin/orders", async ({ page, failedPayout }) => {
    // Given a payout is FAILED (seeded via Prisma)
    await test.step("Given a payout is FAILED", async () => {
      const fresh = await prisma.payout.findUniqueOrThrow({ where: { id: failedPayout.payout.id } });
      expect(fresh.status).toBe("FAILED");
    });

    // When an admin views /admin/orders
    await test.step("When an admin views /admin/orders", async () => {
      await page.goto(`/admin/orders?q=${encodeURIComponent(failedPayout.buyerEmail)}`);
      await expect(page.getByText(failedPayout.buyerEmail)).toBeVisible();
    });

    // Then a "Revive" button is visible next to that payout
    await test.step('Then a "Revive" button is visible next to that payout', async () => {
      const row = page.locator("tr", { hasText: failedPayout.buyerEmail });
      await expect(row.getByText("FAILED")).toBeVisible();
      await expect(row.getByRole("button", { name: "Revive" })).toBeVisible();
    });
  });

  test("clicking Revive releases the payout and it moves to /admin/payouts", async ({ page, failedPayout }) => {
    await test.step("Given a payout is FAILED", async () => {
      await page.goto(`/admin/orders?q=${encodeURIComponent(failedPayout.buyerEmail)}`);
    });

    // When the admin clicks Revive
    await test.step("When the admin clicks Revive", async () => {
      const row = page.locator("tr", { hasText: failedPayout.buyerEmail });
      await row.getByRole("button", { name: "Revive" }).click();
      await expect(page.getByText("Payout released again — find it on /admin/payouts to mark it paid out.")).toBeVisible();
    });

    // Then the payout flips to RELEASED — verified both via the UI
    // updating and by checking the database directly via Prisma — and it
    // now appears on /admin/payouts (which only ever lists RELEASED
    // payouts).
    await test.step("Then the payout flips to RELEASED (UI + database)", async () => {
      const row = page.locator("tr", { hasText: failedPayout.buyerEmail });
      await expect(row.getByText("RELEASED")).toBeVisible();
      await expect(row.getByRole("button", { name: "Revive" })).toHaveCount(0);

      await expect
        .poll(async () => {
          const fresh = await prisma.payout.findUniqueOrThrow({ where: { id: failedPayout.payout.id } });
          return fresh.status;
        })
        .toBe("RELEASED");

      const fresh = await prisma.payout.findUniqueOrThrow({ where: { id: failedPayout.payout.id } });
      expect(fresh.releasedAt).not.toBeNull();
    });

    await test.step("And it now appears on /admin/payouts", async () => {
      await page.goto(`/admin/payouts?q=${encodeURIComponent(failedPayout.artwork.title)}`);
      await expect(page.getByText(failedPayout.artwork.title)).toBeVisible();
    });
  });

  test("reviving an already-RELEASED payout is rejected with 409", async ({ page }) => {
    // Given a payout that is already RELEASED
    const releasedPayout = await createFailedPayoutFixture({ payoutStatus: "RELEASED" });
    try {
      await test.step("Given a payout that is already RELEASED", async () => {
        const fresh = await prisma.payout.findUniqueOrThrow({ where: { id: releasedPayout.payout.id } });
        expect(fresh.status).toBe("RELEASED");
      });

      // When Revive is attempted again (hitting the API directly, as
      // there's no Revive button in the UI for a payout that isn't FAILED
      // — see the conditional render in app/admin/(dashboard)/orders/page.tsx)
      let status = 0;
      let body: { error?: string } = {};
      await test.step("When Revive is attempted again by hitting the API directly", async () => {
        // page.request.* doesn't carry an Origin header the way a real
        // page fetch() does — proxy.ts's CSRF check needs one to recognize
        // this as the same-origin call it actually is (see the identical
        // note in artist-management.spec.ts).
        const response = await page.request.post(`/api/admin/payouts/${releasedPayout.payout.id}/revive`, {
          headers: { origin: "http://localhost:3000" },
        });
        status = response.status();
        body = await response.json();
      });

      // Then it's rejected with 409
      await test.step("Then it's rejected with 409", async () => {
        expect(status).toBe(409);
        expect(body.error).toContain("RELEASED");

        const fresh = await prisma.payout.findUniqueOrThrow({ where: { id: releasedPayout.payout.id } });
        expect(fresh.status).toBe("RELEASED");
      });
    } finally {
      await releasedPayout.cleanup();
    }
  });
});

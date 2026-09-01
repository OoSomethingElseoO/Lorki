// Covers the ORIGINAL-artwork reservation lifecycle end to end against the
// real running app: app/api/inquiries/route.ts and lib/reservations.ts.
//
// Each scenario seeds its own throwaway artwork via the `originalArtwork` /
// `reservedArtwork` fixtures (tests/e2e/fixtures/test-fixtures.ts) and
// tears it down afterwards, so scenarios never depend on each other or on
// what else happens to be in the dev DB.
import { ADMIN_STORAGE_STATE } from "./fixtures/auth-storage";
import { expect, prisma, test } from "./fixtures/test-fixtures";

test.describe("Original-artwork reservation lifecycle", () => {
  test("an inquiry reserves an AVAILABLE original and it disappears from /originals", async ({
    page,
    originalArtwork,
  }) => {
    // Given an ORIGINAL artwork that is AVAILABLE
    await test.step("Given an ORIGINAL artwork that is AVAILABLE", async () => {
      const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: originalArtwork.artwork.id } });
      expect(fresh.inventoryState).toBe("AVAILABLE");

      await page.goto("/originals");
      await expect(page.getByRole("heading", { name: originalArtwork.artwork.title, exact: true })).toBeVisible();
    });

    // When a visitor opens the artwork's lightbox (components/artwork-
    // lightbox.tsx, opened from ArtworkCard's "Inquire to purchase" button
    // via components/originals-grid.tsx) and submits the real inquiry form
    // (components/inquiry-form.tsx) inside it.
    await test.step("When a visitor submits an inquiry on it", async () => {
      const card = page.locator("article.artwork-card").filter({
        has: page.getByRole("heading", { name: originalArtwork.artwork.title, exact: true }),
      });
      await card.getByRole("button", { name: "Inquire to purchase" }).click();

      const dialog = page.getByRole("dialog", { name: originalArtwork.artwork.title });
      const form = dialog.getByRole("form", { name: `Inquire about ${originalArtwork.artwork.title}` });

      await form.getByLabel("Your name").fill("E2E Visitor One");
      await form.getByLabel("Your email").fill(`visitor-one-${Date.now()}@e2e.test`);
      await form.getByRole("button", { name: "Inquire to purchase" }).click();

      await expect(dialog.getByText("Thanks — we'll be in touch by email shortly to arrange this personally.")).toBeVisible();
    });

    // Then the artwork becomes RESERVED and disappears from public listings
    await test.step("Then the artwork becomes RESERVED and disappears from /originals", async () => {
      await expect
        .poll(async () => {
          const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: originalArtwork.artwork.id } });
          return fresh.inventoryState;
        })
        .toBe("RESERVED");

      await page.goto("/originals");
      await expect(page.getByRole("heading", { name: originalArtwork.artwork.title, exact: true })).not.toBeVisible();
    });
  });

  test("a second inquiry on an already-RESERVED original is rejected and the first hold stands", async ({
    request,
    reservedArtwork,
  }) => {
    // Given an artwork is already RESERVED (seeded with a first inquiry
    // already recorded, the same state the previous scenario leaves
    // behind — seeded directly here so this scenario doesn't depend on
    // another test having run first).
    await test.step("Given an artwork is already RESERVED", async () => {
      const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: reservedArtwork.artwork.id } });
      expect(fresh.inventoryState).toBe("RESERVED");
      expect(reservedArtwork.inquiry).not.toBeNull();
    });

    // When a second visitor tries to submit another inquiry on the same
    // artwork. A page reload wouldn't even render the inquiry form any
    // more (RESERVED pieces are excluded from every storefront query — see
    // lib/storefront.ts), which is exactly the real-world race this
    // guards against: a second visitor whose page loaded a moment before
    // the reservation, submitting into it right after. Hitting the API
    // directly is the faithful way to reproduce that.
    let response: Awaited<ReturnType<typeof request.post>>;
    await test.step("When a second visitor tries to submit another inquiry on the same artwork", async () => {
      // The `request` fixture is a standalone APIRequestContext, not tied
      // to a page — it doesn't carry an Origin header the way a real
      // in-page fetch (e.g. the actual inquiry form) does, so proxy.ts's
      // CSRF same-origin check would otherwise reject this before it ever
      // reaches the route's own 409 logic. A real visitor's browser always
      // sends a matching Origin; setting it here just reproduces that.
      response = await request.post("/api/inquiries", {
        headers: { origin: "http://localhost:3000" },
        data: {
          artworkId: reservedArtwork.artwork.id,
          name: "E2E Visitor Two",
          email: `visitor-two-${Date.now()}@e2e.test`,
        },
      });
    });

    // Then it's rejected (409) and the piece stays reserved for the first
    // inquirer.
    await test.step("Then it's rejected (409) and the piece stays reserved for the first inquirer", async () => {
      expect(response!.status()).toBe(409);

      const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: reservedArtwork.artwork.id } });
      expect(fresh.inventoryState).toBe("RESERVED");

      const inquiries = await prisma.inquiry.findMany({ where: { artworkId: reservedArtwork.artwork.id } });
      expect(inquiries).toHaveLength(1);
      expect(inquiries[0].email).toBe(reservedArtwork.inquiry!.email);
    });
  });

  test.describe("admin closes the inquiry", () => {
    test.use({ storageState: ADMIN_STORAGE_STATE });

    test("closing a RESERVED artwork's inquiry releases it back to AVAILABLE immediately", async ({
      page,
      reservedArtwork,
    }) => {
      // Given an admin is logged in and an inquiry exists in RESERVED state
      await test.step("Given an admin is logged in and an inquiry exists in RESERVED state", async () => {
        const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: reservedArtwork.artwork.id } });
        expect(fresh.inventoryState).toBe("RESERVED");

        await page.goto(`/admin/inquiries?q=${encodeURIComponent(reservedArtwork.inquiry!.email)}`);
        await expect(page.getByText(reservedArtwork.artwork.title)).toBeVisible();
      });

      // When the admin changes that inquiry's status to CLOSED on
      // /admin/inquiries
      await test.step("When the admin changes that inquiry's status to CLOSED", async () => {
        const row = page.locator("tr", { hasText: reservedArtwork.inquiry!.email });
        await row.getByLabel("Inquiry status").selectOption("CLOSED");
        await expect(page.getByText("Status updated to CLOSED")).toBeVisible();
      });

      // Then the artwork is released back to AVAILABLE immediately (not
      // waiting for the 30-minute TTL) and reappears on /originals.
      await test.step("Then the artwork is released back to AVAILABLE and reappears on /originals", async () => {
        await expect
          .poll(async () => {
            const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: reservedArtwork.artwork.id } });
            return fresh.inventoryState;
          })
          .toBe("AVAILABLE");

        const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: reservedArtwork.artwork.id } });
        expect(fresh.reservedAt).toBeNull();

        await page.goto("/originals");
        await expect(page.getByRole("heading", { name: reservedArtwork.artwork.title, exact: true })).toBeVisible();
      });
    });
  });
});

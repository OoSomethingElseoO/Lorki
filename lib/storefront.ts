import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations";

// Shape every storefront component renders — decoupled from Prisma's nested
// campaign/artist include shape so components don't need to know the join.
export type StorefrontArtwork = {
  id: string;
  title: string;
  kind: "ORIGINAL" | "PRINT";
  story: string | null;
  artistName: string;
  artistSlug: string;
  artistBio: string;
  artistCountry: string;
  priceCents: number;
  currency: string;
  inventoryState: "AVAILABLE" | "RESERVED" | "SOLD";
  imageUrl: string;
  altText: string;
  printVariants: PrintVariantSummary[];
};

export type PrintVariantSummary = {
  id: string;
  size: string;
  widthMm: number;
  heightMm: number;
  material: string | null;
  priceCents: number;
  currency: string;
};

export const PAGE_SIZE = 12;
const INVALID_TEST_IMAGE_URL = "https://example.com/test.jpg";

export type ProductFilters = {
  q?: string;
  kind?: "ALL" | "ORIGINAL" | "PRINT";
  artist?: string;
  dateFrom?: string;
  dateTo?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: "newest" | "oldest" | "price_asc" | "price_desc";
};

export async function getProductCatalogue(page = 1, filters: ProductFilters = {}): Promise<PaginatedResult<StorefrontArtwork>> {
  await releaseExpiredReservations();
  const currentPage = normalizePage(page);
  const where = {
    isPublished: true,
    inventoryState: "AVAILABLE" as const,
    campaign: {
      status: "LIVE" as const,
      ...(filters.artist ? { artist: { name: { contains: filters.artist, mode: "insensitive" as const } } } : {}),
    },
    ...(filters.q ? { OR: [{ title: { contains: filters.q, mode: "insensitive" as const } }, { campaign: { artist: { name: { contains: filters.q, mode: "insensitive" as const } } } }] } : {}),
    ...(filters.kind && filters.kind !== "ALL" ? { kind: filters.kind } : {}),
    ...(filters.dateFrom || filters.dateTo ? { createdAt: { ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) } : {}), ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}) } } : {}),
    ...(filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined ? { priceCents: { ...(filters.minPriceCents !== undefined ? { gte: filters.minPriceCents } : {}), ...(filters.maxPriceCents !== undefined ? { lte: filters.maxPriceCents } : {}) } } : {}),
    NOT: { imageUrl: INVALID_TEST_IMAGE_URL },
  };
  const orderBy = filters.sort === "oldest" ? { createdAt: "asc" as const } : filters.sort === "price_asc" ? { priceCents: "asc" as const } : filters.sort === "price_desc" ? { priceCents: "desc" as const } : { createdAt: "desc" as const };
  const [items, totalCount] = await Promise.all([
    prisma.artwork.findMany({ where, include: { campaign: { include: { artist: true } }, printVariants: { where: { isPublished: true }, orderBy: { priceCents: "asc" } } }, orderBy, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.artwork.count({ where }),
  ]);
  return { items: items.map(mapArtwork), page: currentPage, totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), totalCount };
}

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalCount: number;
};

function mapArtwork(artwork: {
  id: string;
  title: string;
  kind: "ORIGINAL" | "PRINT";
  story: string | null;
  priceCents: number;
  currency: string;
  inventoryState: "AVAILABLE" | "RESERVED" | "SOLD";
  imageUrl: string;
  altText: string;
  campaign: { artist: { name: string; slug: string; bio: string; country: string } };
  printVariants?: PrintVariantSummary[];
}): StorefrontArtwork {
  return {
    id: artwork.id,
    title: artwork.title,
    kind: artwork.kind,
    story: artwork.story,
    artistName: artwork.campaign.artist.name,
    artistSlug: artwork.campaign.artist.slug,
    artistBio: artwork.campaign.artist.bio,
    artistCountry: artwork.campaign.artist.country,
    priceCents: artwork.priceCents,
    currency: artwork.currency,
    inventoryState: artwork.inventoryState,
    imageUrl: artwork.imageUrl,
    altText: artwork.altText,
    printVariants: artwork.printVariants ?? [],
  };
}

export async function getLiveNewsArticles() {
  return prisma.newsArticle.findMany({
    where: { status: "LIVE" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLiveNewsArticleBySlug(slug: string) {
  return prisma.newsArticle.findFirst({
    where: { slug, status: "LIVE" },
  });
}

export async function getHeroAnimals(): Promise<{ src: string; alt: string }[]> {
  // These are the Cloudinary copies of the committed local wildlife assets.
  // They are only a degraded-mode fallback; the database remains the source
  // of truth whenever Neon is available.
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    ?? process.env.CLOUDINARY_URL?.match(/@([^/?]+)/)?.[1];
  const cloudinaryFallback = cloudName ? [
    { src: `https://res.cloudinary.com/${cloudName}/image/upload/lorki/local/lorkulup-cubs.jpg`, alt: "Wildlife cubs" },
    { src: `https://res.cloudinary.com/${cloudName}/image/upload/lorki/local/lorkulup-cubs-2.jpg`, alt: "Wildlife cubs in their habitat" },
    { src: `https://res.cloudinary.com/${cloudName}/image/upload/lorki/local/lorkulup-family.jpg`, alt: "Wildlife family" },
    { src: `https://res.cloudinary.com/${cloudName}/image/upload/lorki/local/lorkulup-family-2.jpg`, alt: "Wildlife family in the wild" },
    { src: `https://res.cloudinary.com/${cloudName}/image/upload/lorki/local/lorkulup-portrait.jpg`, alt: "Wildlife portrait" },
    { src: `https://res.cloudinary.com/${cloudName}/image/upload/lorki/local/lorkulup-portrait-2.jpg`, alt: "Wildlife portrait with cubs" },
  ] : [];
  let animals: {
    name: string;
    species: string;
    imageUrl: string;
    campaigns: { artworks: { imageUrl: string; title: string; altText: string }[] }[];
  }[] = [];
  try {
    animals = await prisma.animal.findMany({
      select: {
        name: true,
        species: true,
        imageUrl: true,
        campaigns: {
          select: {
            artworks: {
              where: { isPublished: true },
              select: { imageUrl: true, title: true, altText: true },
              take: 8,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
  } catch {
    return cloudinaryFallback;
  }
  const seen = new Set<string>();
  const databaseImages = animals.flatMap((animal) => [
    { src: animal.imageUrl, alt: `${animal.name} (${animal.species})` },
    ...animal.campaigns.flatMap((campaign) => campaign.artworks.map((artwork) => ({
      src: artwork.imageUrl,
      alt: artwork.altText || artwork.title,
    }))),
  ]).filter(({ src }) => src && !src.startsWith("/api/uploads/") && src !== INVALID_TEST_IMAGE_URL && !seen.has(src))
    .filter(({ src }) => { seen.add(src); return true; });

  return (databaseImages.length ? databaseImages : cloudinaryFallback).slice(0, 6);
}

function normalizePage(page: number | undefined): number {
  return Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
}

export async function getLiveArtworksByKind(
  kind: "ORIGINAL" | "PRINT",
  page?: number,
): Promise<PaginatedResult<StorefrontArtwork>> {
  // Lazy cleanup on read: a reservation older than RESERVATION_TTL_MS (an
  // inquiry that never turned into a recorded sale) needs to fall back to
  // AVAILABLE before the query below filters on that column, or the piece
  // would stay invisible here indefinitely — nothing else calls this.
  await releaseExpiredReservations();
  const currentPage = normalizePage(page);
  const where = {
    kind,
    isPublished: true,
    inventoryState: "AVAILABLE" as const,
    campaign: { status: "LIVE" as const },
    NOT: { imageUrl: INVALID_TEST_IMAGE_URL },
  };

  const [artworks, totalCount] = await Promise.all([
    prisma.artwork.findMany({
      where,
      include: { campaign: { include: { artist: true } }, printVariants: { where: { isPublished: true }, orderBy: { priceCents: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.artwork.count({ where }),
  ]);

  return {
    items: artworks.map(mapArtwork),
    page: currentPage,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    totalCount,
  };
}

export async function getLiveArtworkById(id: string) {
  await releaseExpiredReservations();
  const artwork = await prisma.artwork.findFirst({
    where: { id, isPublished: true, inventoryState: "AVAILABLE", campaign: { status: "LIVE" } },
    include: { campaign: { include: { artist: true } }, printVariants: { where: { isPublished: true }, orderBy: { priceCents: "asc" } } },
  });
  return artwork ? mapArtwork(artwork) : null;
}

/** Public canonical artwork pages may remain shareable after a sale/reservation. */
export async function getPublicArtworkById(id: string) {
  const artwork = await prisma.artwork.findFirst({
    where: { id, campaign: { status: "LIVE" } },
    include: { campaign: { include: { artist: true } }, printVariants: { where: { isPublished: true }, orderBy: { priceCents: "asc" } } },
  });
  return artwork ? mapArtwork(artwork) : null;
}

const CAROUSEL_SIZE = 24;

// Backs the homepage's looping showcase carousel. Deliberately cached
// (unlike getLiveArtworksByKind above): the homepage renders per-request
// (see app/page.tsx's `dynamic = "force-dynamic"`), so without this every
// visitor would trigger its own artwork+campaign+artist join. A 60s window
// keeps that to at most one query/minute regardless of traffic.
//
// Trade-off: this intentionally skips releaseExpiredReservations() — a
// piece can look AVAILABLE here for up to 60s after actually going RESERVED.
// Fine for a decorative showcase; the real /originals listing and checkout
// paths call the uncached getLiveArtworksByKind above and stay accurate.
export const getCarouselArtworks = unstable_cache(
  async (): Promise<StorefrontArtwork[]> => {
    const artworks = await prisma.artwork.findMany({
      where: {
        isPublished: true,
        kind: "ORIGINAL",
        inventoryState: "AVAILABLE",
        campaign: { status: "LIVE" },
        NOT: { imageUrl: INVALID_TEST_IMAGE_URL },
      },
      include: { campaign: { include: { artist: true } }, printVariants: { where: { isPublished: true }, orderBy: { priceCents: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: CAROUSEL_SIZE,
    });
    return artworks.map(mapArtwork);
  },
  ["carousel-artworks"],
  { revalidate: 60 },
);

export async function getArtists(page?: number) {
  const currentPage = normalizePage(page);

  const [artists, totalCount] = await Promise.all([
    prisma.artist.findMany({
      where: { NOT: { imageUrl: INVALID_TEST_IMAGE_URL } },
      include: { socialLinks: true },
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.artist.count({ where: { NOT: { imageUrl: INVALID_TEST_IMAGE_URL } } }),
  ]);

  return {
    items: artists,
    page: currentPage,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    totalCount,
  };
}

export async function getArtistBySlug(slug: string) {
  return prisma.artist.findUnique({
    where: { slug },
    include: { socialLinks: true },
  });
}

export async function getLiveArtworksForArtist(artistId: string): Promise<StorefrontArtwork[]> {
  await releaseExpiredReservations();
  const artworks = await prisma.artwork.findMany({
    where: {
      isPublished: true,
      inventoryState: "AVAILABLE",
      campaign: { status: "LIVE", artistId },
    },
    include: { campaign: { include: { artist: true } }, printVariants: { where: { isPublished: true }, orderBy: { priceCents: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return artworks.map(mapArtwork);
}

export type ImpactTotals = {
  artistCents: number;
  conservancyCents: number;
  operationsCents: number;
  piecesSold: number;
};

// Shared by the home page teaser and the full /impact page — always derived
// from RELEASED payouts only, so the number shown is money that's actually
// moved, never just money collected.
export async function getImpactTotals(): Promise<ImpactTotals> {
  const [released, piecesSold] = await Promise.all([
    prisma.payout.groupBy({
      by: ["recipientType"],
      where: { status: "RELEASED" },
      _sum: { amountCents: true },
    }),
    prisma.artwork.count({ where: { inventoryState: "SOLD" } }),
  ]);

  const totals: ImpactTotals = { artistCents: 0, conservancyCents: 0, operationsCents: 0, piecesSold };
  for (const row of released) {
    const cents = row._sum.amountCents ?? 0;
    if (row.recipientType === "ARTIST") totals.artistCents = cents;
    if (row.recipientType === "CONSERVANCY") totals.conservancyCents = cents;
    if (row.recipientType === "OPERATIONS") totals.operationsCents = cents;
  }
  return totals;
}

export async function searchStorefront(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { artworks: [] as StorefrontArtwork[], artists: [] as Awaited<ReturnType<typeof getArtists>>["items"] };
  }

  await releaseExpiredReservations();
  const [artworks, artists] = await Promise.all([
    prisma.artwork.findMany({
      where: {
        isPublished: true,
        inventoryState: "AVAILABLE",
        campaign: { status: "LIVE" },
        OR: [
          { title: { contains: trimmed, mode: "insensitive" } },
          { campaign: { artist: { name: { contains: trimmed, mode: "insensitive" } } } },
        ],
      },
      include: { campaign: { include: { artist: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.artist.findMany({
      where: {
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { country: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      include: { socialLinks: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    artworks: artworks.map(mapArtwork),
    artists,
  };
}

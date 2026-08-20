import { prisma } from "@/lib/prisma";

// Shape every storefront component renders — decoupled from Prisma's nested
// campaign/artist include shape so components don't need to know the join.
export type StorefrontArtwork = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  priceCents: number;
  imageUrl: string;
  altText: string;
};

export const PAGE_SIZE = 12;

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalCount: number;
};

function mapArtwork(artwork: {
  id: string;
  title: string;
  priceCents: number;
  imageUrl: string;
  altText: string;
  campaign: { artist: { name: string; slug: string } };
}): StorefrontArtwork {
  return {
    id: artwork.id,
    title: artwork.title,
    artistName: artwork.campaign.artist.name,
    artistSlug: artwork.campaign.artist.slug,
    priceCents: artwork.priceCents,
    imageUrl: artwork.imageUrl,
    altText: artwork.altText,
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

function normalizePage(page: number | undefined): number {
  return Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
}

export async function getLiveArtworksByKind(
  kind: "ORIGINAL" | "PRINT",
  page?: number,
): Promise<PaginatedResult<StorefrontArtwork>> {
  const currentPage = normalizePage(page);
  const where = {
    kind,
    inventoryState: "AVAILABLE" as const,
    campaign: { status: "LIVE" as const },
  };

  const [artworks, totalCount] = await Promise.all([
    prisma.artwork.findMany({
      where,
      include: { campaign: { include: { artist: true } } },
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

export async function getArtists(page?: number) {
  const currentPage = normalizePage(page);

  const [artists, totalCount] = await Promise.all([
    prisma.artist.findMany({
      include: { socialLinks: true },
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.artist.count(),
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
  const artworks = await prisma.artwork.findMany({
    where: {
      inventoryState: "AVAILABLE",
      campaign: { status: "LIVE", artistId },
    },
    include: { campaign: { include: { artist: true } } },
    orderBy: { createdAt: "desc" },
  });

  return artworks.map(mapArtwork);
}

export async function searchStorefront(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { artworks: [] as StorefrontArtwork[], artists: [] as Awaited<ReturnType<typeof getArtists>>["items"] };
  }

  const [artworks, artists] = await Promise.all([
    prisma.artwork.findMany({
      where: {
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

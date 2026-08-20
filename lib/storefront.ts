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

export async function getLiveArtworksByKind(kind: "ORIGINAL" | "PRINT"): Promise<StorefrontArtwork[]> {
  const artworks = await prisma.artwork.findMany({
    where: {
      kind,
      inventoryState: "AVAILABLE",
      campaign: { status: "LIVE" },
    },
    include: { campaign: { include: { artist: true } } },
    orderBy: { createdAt: "desc" },
  });

  return artworks.map((artwork) => ({
    id: artwork.id,
    title: artwork.title,
    artistName: artwork.campaign.artist.name,
    artistSlug: artwork.campaign.artist.slug,
    priceCents: artwork.priceCents,
    imageUrl: artwork.imageUrl,
    altText: artwork.altText,
  }));
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

export async function getArtists() {
  return prisma.artist.findMany({
    include: { socialLinks: true },
    orderBy: { name: "asc" },
  });
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

  return artworks.map((artwork) => ({
    id: artwork.id,
    title: artwork.title,
    artistName: artwork.campaign.artist.name,
    artistSlug: artwork.campaign.artist.slug,
    priceCents: artwork.priceCents,
    imageUrl: artwork.imageUrl,
    altText: artwork.altText,
  }));
}

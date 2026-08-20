import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArtistForm } from "@/components/admin/artist-form";

type EditArtistPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditArtistPage({ params }: EditArtistPageProps) {
  const { id } = await params;

  const [artist, coOps] = await Promise.all([
    prisma.artist.findUnique({ where: { id }, include: { socialLinks: true } }),
    prisma.coOp.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!artist) {
    notFound();
  }

  return (
    <>
      <h1>Edit {artist.name}</h1>
      <ArtistForm
        id={artist.id}
        coOps={coOps}
        initial={{
          name: artist.name,
          country: artist.country,
          bio: artist.bio,
          imageUrl: artist.imageUrl,
          coOpId: artist.coOpId,
          socialLinks: artist.socialLinks.map((link) => ({ platform: link.platform, url: link.url })),
        }}
      />
    </>
  );
}

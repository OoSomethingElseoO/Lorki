import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const conservancy = await prisma.conservancy.upsert({
    where: { id: "seed-mara-lion-project" },
    update: {},
    create: {
      id: "seed-mara-lion-project",
      name: "Mara Lion Project",
      region: "Maasai Mara, Kenya",
      mission: "Placeholder conservancy partner — replace with the confirmed organization tied to Lorkulup.",
      website: "https://example.org",
      contactEmail: "contact@example.org",
    },
  });

  const animal = await prisma.animal.upsert({
    where: { slug: "lorkulup" },
    update: {},
    create: {
      slug: "lorkulup",
      name: "Lorkulup",
      species: "Lion",
      region: "Maasai Mara, Kenya",
      story: "Placeholder story for Lorkulup — replace with the real background once confirmed.",
      imageUrl: "/artwork/featured-original.png",
      conservancyId: conservancy.id,
    },
  });

  const artist = await prisma.artist.upsert({
    where: { slug: "placeholder-artist" },
    update: {},
    create: {
      slug: "placeholder-artist",
      name: "Placeholder Artist",
      country: "Kenya",
      bio: "Placeholder artist bio — replace with a confirmed Kenyan artist and their real background.",
      imageUrl: "/placeholders/artist-portrait.svg",
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { slug: "lorkulup-placeholder-artist" },
    update: {},
    create: {
      slug: "lorkulup-placeholder-artist",
      animalId: animal.id,
      artistId: artist.id,
      artistPercent: 50,
      conservancyPercent: 25,
      operationsPercent: 25,
      status: "DRAFT",
      artworks: {
        create: [
          {
            title: "Lorkulup, Original",
            kind: "ORIGINAL",
            priceCents: 250000,
            imageUrl: "/artwork/featured-original.png",
            altText: "Placeholder painting of Lorkulup the lion.",
          },
          {
            title: "Lorkulup, Print",
            kind: "PRINT",
            priceCents: 9500,
            imageUrl: "/artwork/featured-original.png",
            altText: "Placeholder print of Lorkulup the lion.",
          },
        ],
      },
    },
  });

  console.log("Seeded:", { conservancy: conservancy.name, animal: animal.name, artist: artist.name, campaign: campaign.slug });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

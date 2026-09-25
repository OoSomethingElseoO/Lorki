import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail.toLowerCase().trim() },
      update: {},
      create: {
        email: adminEmail.toLowerCase().trim(),
        name: "Admin",
        passwordHash: await hashPassword(adminPassword),
        isAdmin: true,
      },
    });
    console.log(`Seeded admin user: ${adminEmail} (only if it didn't already exist)`);
  } else {
    console.log("Skipped admin user seed — set ADMIN_EMAIL and ADMIN_PASSWORD in .env to bootstrap the first login.");
  }

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
      story: `Lorkulup was a male lion known for his calm strength and close bonds with his family. Male lions are often pushed out of their birth pride as sub-adults and become nomadic; brothers that stay together can form a coalition and have a better chance of establishing a pride. Lorkulup was one of five brothers, and accounts from people who followed the pride describe him as the gentlest of the group — still formidable, but often staying with the cubs and helping protect them.

He was frequently described as an exceptional buffalo hunter who helped the pride secure large prey. The same accounts say he welcomed family members who had been pushed out, including his younger brother Olonkera. After other coalition members drove Olonkera away, Lorkulup reportedly allowed him to return, bond with the younger cubs, and hunt with the family. When Lorkulup later died, Olonkera was forced out again; the cubs left with him, and he eventually became the dominant male of a coalition of five.

The circumstances around Lorkulup's death, earlier injuries, and alleged human persecution are community-reported claims and should be independently verified before publication. This profile preserves the account as supplied for the project, with links to the source videos available in the conservation team's research notes.

Source links supplied with this profile:\nLorkulup hunting with lionesses: https://www.facebook.com/share/r/1Am3qimNVh/?mibextid=wwXIfr\nLorkulup with a cub: https://www.facebook.com/share/r/17Lhyo94rf/?mibextid=wwXIfr\nLorkulup taking down buffalo: https://www.facebook.com/share/v/17D3JQ5uiB/?mibextid=wwXIfr\nLorkulup protecting Olonkera: https://www.facebook.com/share/v/1Gq9QbTgMT/?mibextid=wwXIfr\nThe pride after his death: https://www.facebook.com/share/v/1BAMHBTnjC/?mibextid=wwXIfr`,
      imageUrl: "/uploads/lorkulup-portrait.jpeg",
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
            imageUrl: "/uploads/lorkulup-portrait-2.jpeg",
            altText: "Lorkulup, a male lion, resting in the grass.",
            story: "A portrait of Lorkulup, remembered for his gentle confidence, his role in protecting the pride, and his ability to bring down buffalo with remarkable efficiency. This image is part of a community-supplied archive; biographical claims should be verified before publication.",
          },
          {
            title: "Lorkulup, Print",
            kind: "PRINT",
            priceCents: 9500,
            imageUrl: "/uploads/lorkulup-family.jpeg",
            altText: "Lorkulup with members of his lion family.",
            story: "Lorkulup was closely bonded with his family and was reported to have welcomed his younger brother Olonkera back to the pride. The accompanying account follows their coalition, the cubs they protected, and Olonkera's later path to leading a coalition of five.",
          },
        ],
      },
    },
  });

  // Initialise the hero pools for fresh installations without overwriting
  // an admin's later edits on subsequent seed runs.
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      siteName: "Lorki Originals",
      heroTagline: "Sell art. Own masterpieces. Protect wildlife.",
      heroHeadlineWords: {
        first: ["art", "masterpieces", "originals"],
        second: ["masterpieces", "originals", "art"],
        third: ["wildlife", "lions", "elephants", "habitats"],
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

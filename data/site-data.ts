export type SocialLink = {
  platform: string;
  url: string;
};

export type Conservancy = {
  slug: string;
  name: string;
  region: string;
  mission: string;
  website: string;
};

export type Animal = {
  slug: string;
  name: string;
  species: string;
  region: string;
  story: string;
  conservancySlug: string;
  image: string;
};

export type Split = {
  artistPercent: number;
  conservancyPercent: number;
  operationsPercent: number;
};

export type Campaign = {
  slug: string;
  animalSlug: string;
  artistSlug: string;
  split: Split;
};

export type Artist = {
  slug: string;
  name: string;
  country: string;
  age: number;
  bio: string;
  image: string;
  socialLinks: SocialLink[];
};

export type Artwork = {
  id: string;
  title: string;
  artistSlug: string;
  artistName: string;
  campaignSlug: string;
  price: string;
  image: string;
  alt: string;
};

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  image: string;
  alt: string;
};

export const ownerContact = {
  name: "Kat Morgan",
  email: "kat@example.com",
  phone: "(555) 019-2026",
};

export const conservancies: Conservancy[] = [
  {
    slug: "mara-lion-project",
    name: "Mara Lion Project",
    region: "Maasai Mara, Kenya",
    mission: "Placeholder conservancy partner — replace with the confirmed organization tied to Lorkulup.",
    website: "https://example.org",
  },
];

export const animals: Animal[] = [
  {
    slug: "lorkulup",
    name: "Lorkulup",
    species: "Lion",
    region: "Maasai Mara, Kenya",
    story: "Placeholder story for Lorkulup — replace with the real background once confirmed.",
    conservancySlug: "mara-lion-project",
    image: "/artwork/featured-original.png",
  },
];

export const artists: Artist[] = [
  {
    slug: "mara-vale",
    name: "Mara Vale",
    country: "Kenya",
    age: 41,
    bio: "Placeholder artist bio — replace with a confirmed Kenyan artist and their real background.",
    image: "/placeholders/artist-portrait.svg",
    socialLinks: [],
  },
  {
    slug: "noah-sato",
    name: "Noah Sato",
    country: "Kenya",
    age: 36,
    bio: "Placeholder artist bio — replace with a confirmed Kenyan artist and their real background.",
    image: "/placeholders/artist-portrait.svg",
    socialLinks: [],
  },
  {
    slug: "elena-rossi",
    name: "Elena Rossi",
    country: "Kenya",
    age: 52,
    bio: "Placeholder artist bio — replace with a confirmed Kenyan artist and their real background.",
    image: "/placeholders/artist-portrait.svg",
    socialLinks: [],
  },
  {
    slug: "amira-diallo",
    name: "Amira Diallo",
    country: "Kenya",
    age: 33,
    bio: "Placeholder artist bio — replace with a confirmed Kenyan artist and their real background.",
    image: "/placeholders/artist-portrait.svg",
    socialLinks: [],
  },
  {
    slug: "lucien-hart",
    name: "Lucien Hart",
    country: "Kenya",
    age: 47,
    bio: "Placeholder artist bio — replace with a confirmed Kenyan artist and their real background.",
    image: "/placeholders/artist-portrait.svg",
    socialLinks: [],
  },
  {
    slug: "sol-rivera",
    name: "Sol Rivera",
    country: "Kenya",
    age: 29,
    bio: "Placeholder artist bio — replace with a confirmed Kenyan artist and their real background.",
    image: "/placeholders/artist-portrait.svg",
    socialLinks: [],
  },
];

export const campaigns: Campaign[] = artists.map((artist) => ({
  slug: `lorkulup-${artist.slug}`,
  animalSlug: "lorkulup",
  artistSlug: artist.slug,
  split: {
    artistPercent: 50,
    conservancyPercent: 25,
    operationsPercent: 25,
  },
}));

export const artworks: Artwork[] = [
  {
    id: "arch-and-tide",
    title: "Arch and Tide",
    artistSlug: "mara-vale",
    artistName: "Mara Vale",
    campaignSlug: "lorkulup-mara-vale",
    price: "$2,400",
    image: "/artwork/featured-original.png",
    alt: "Abstract artwork with an arched pale form, terracotta shapes, water, and dark coastal silhouettes.",
  },
  {
    id: "quiet-channel",
    title: "Quiet Channel",
    artistSlug: "noah-sato",
    artistName: "Noah Sato",
    campaignSlug: "lorkulup-noah-sato",
    price: "$1,850",
    image: "/artwork/featured-original.png",
    alt: "Mixed-media abstract landscape in ochre, black, off-white, and deep teal.",
  },
  {
    id: "ochre-gate",
    title: "Ochre Gate",
    artistSlug: "elena-rossi",
    artistName: "Elena Rossi",
    campaignSlug: "lorkulup-elena-rossi",
    price: "$2,100",
    image: "/artwork/featured-original.png",
    alt: "Vertical abstract composition with warm ochre fields and a central pale doorway shape.",
  },
  {
    id: "shoreline-study",
    title: "Shoreline Study",
    artistSlug: "amira-diallo",
    artistName: "Amira Diallo",
    campaignSlug: "lorkulup-amira-diallo",
    price: "$1,600",
    image: "/artwork/featured-original.png",
    alt: "Layered abstract coastal scene with textured earth tones and dark organic forms.",
  },
  {
    id: "black-stone-morning",
    title: "Black Stone Morning",
    artistSlug: "lucien-hart",
    artistName: "Lucien Hart",
    campaignSlug: "lorkulup-lucien-hart",
    price: "$2,750",
    image: "/artwork/featured-original.png",
    alt: "Contemporary mixed-media artwork with black stone-like forms and warm paper textures.",
  },
  {
    id: "terracotta-window",
    title: "Terracotta Window",
    artistSlug: "sol-rivera",
    artistName: "Sol Rivera",
    campaignSlug: "lorkulup-sol-rivera",
    price: "$1,950",
    image: "/artwork/featured-original.png",
    alt: "Abstract painting with a terracotta window-like form, pale center, and teal accent.",
  },
];

export const prints: Artwork[] = artworks.map((artwork, index) => ({
  ...artwork,
  id: `${artwork.id}-print`,
  title: `${artwork.title} Print`,
  price: ["$95", "$120", "$110", "$85", "$140", "$105"][index],
}));

export const newsArticles: NewsArticle[] = [
  {
    id: "spring-studio-notes",
    title: "Spring Studio Notes",
    summary: "A short look at new textures, warm palettes, and the artists preparing work for the next release.",
    image: "/placeholders/news-studio.svg",
    alt: "Abstract studio scene with framed artwork shapes and warm sandy colors.",
  },
  {
    id: "collecting-originals",
    title: "Collecting Originals With Confidence",
    summary: "A practical introduction to scale, framing, provenance, and choosing artwork for lived spaces.",
    image: "/placeholders/news-studio.svg",
    alt: "Stylized artwork studio image with geometric forms and a sweeping line.",
  },
  {
    id: "artist-conversation",
    title: "Conversation With Mara Vale",
    summary: "Mara discusses layered paper, coastal memory, and the quiet discipline behind her newest works.",
    image: "/placeholders/news-studio.svg",
    alt: "Warm abstract studio placeholder with framed panels and circular artwork forms.",
  },
];

export function getArtistBySlug(slug: string) {
  return artists.find((artist) => artist.slug === slug);
}

export function getAnimalBySlug(slug: string) {
  return animals.find((animal) => animal.slug === slug);
}

export function getConservancyBySlug(slug: string) {
  return conservancies.find((conservancy) => conservancy.slug === slug);
}

export function getCampaignBySlug(slug: string) {
  return campaigns.find((campaign) => campaign.slug === slug);
}

export function getCampaignForArtwork(artwork: Artwork) {
  return getCampaignBySlug(artwork.campaignSlug);
}

export function getArtworksByArtist(slug: string) {
  const artist = getArtistBySlug(slug);
  const artistArtworks = artworks.filter((artwork) => artwork.artistSlug === slug);

  if (!artist || artistArtworks.length >= 3) {
    return artistArtworks;
  }

  return [1, 2, 3].map((number) => ({
    ...artistArtworks[0],
    id: `${slug}-gallery-${number}`,
    title: `${artistArtworks[0]?.title ?? "Untitled Study"} ${number}`,
    artistSlug: slug,
    artistName: artist.name,
  }));
}

export function inquiryHref(pieceTitle: string) {
  const subject = encodeURIComponent(`Artwork inquiry: ${pieceTitle}`);
  const body = encodeURIComponent(`Hello, I would like to ask about "${pieceTitle}".`);
  return `mailto:${ownerContact.email}?subject=${subject}&body=${body}`;
}

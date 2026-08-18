export type Artist = {
  slug: string;
  name: string;
  country: string;
  age: number;
  bio: string;
  image: string;
};

export type Artwork = {
  id: string;
  title: string;
  artistSlug: string;
  artistName: string;
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

export const artists: Artist[] = [
  {
    slug: "mara-vale",
    name: "Mara Vale",
    country: "Portugal",
    age: 41,
    bio: "Mara creates layered works that combine architectural memory, shoreline light, and quiet abstraction.",
    image: "/placeholders/artist-portrait.svg",
  },
  {
    slug: "noah-sato",
    name: "Noah Sato",
    country: "Japan",
    age: 36,
    bio: "Noah works with ink, linen, and restrained color to explore balance, pause, and interior landscapes.",
    image: "/placeholders/artist-portrait.svg",
  },
  {
    slug: "elena-rossi",
    name: "Elena Rossi",
    country: "Italy",
    age: 52,
    bio: "Elena's paintings use earthy pigment and gentle geometry to hold fragments of place and memory.",
    image: "/placeholders/artist-portrait.svg",
  },
  {
    slug: "amira-diallo",
    name: "Amira Diallo",
    country: "Senegal",
    age: 33,
    bio: "Amira builds luminous compositions from textile references, found forms, and hand-drawn marks.",
    image: "/placeholders/artist-portrait.svg",
  },
  {
    slug: "lucien-hart",
    name: "Lucien Hart",
    country: "Canada",
    age: 47,
    bio: "Lucien's studio practice centers on slow observation, weathered surfaces, and tonal restraint.",
    image: "/placeholders/artist-portrait.svg",
  },
  {
    slug: "sol-rivera",
    name: "Sol Rivera",
    country: "Mexico",
    age: 29,
    bio: "Sol creates warm, vivid works that move between symbolic landscape and contemporary folk abstraction.",
    image: "/placeholders/artist-portrait.svg",
  },
];

export const artworks: Artwork[] = [
  {
    id: "arch-and-tide",
    title: "Arch and Tide",
    artistSlug: "mara-vale",
    artistName: "Mara Vale",
    price: "$2,400",
    image: "/artwork/featured-original.png",
    alt: "Abstract artwork with an arched pale form, terracotta shapes, water, and dark coastal silhouettes.",
  },
  {
    id: "quiet-channel",
    title: "Quiet Channel",
    artistSlug: "noah-sato",
    artistName: "Noah Sato",
    price: "$1,850",
    image: "/artwork/featured-original.png",
    alt: "Mixed-media abstract landscape in ochre, black, off-white, and deep teal.",
  },
  {
    id: "ochre-gate",
    title: "Ochre Gate",
    artistSlug: "elena-rossi",
    artistName: "Elena Rossi",
    price: "$2,100",
    image: "/artwork/featured-original.png",
    alt: "Vertical abstract composition with warm ochre fields and a central pale doorway shape.",
  },
  {
    id: "shoreline-study",
    title: "Shoreline Study",
    artistSlug: "amira-diallo",
    artistName: "Amira Diallo",
    price: "$1,600",
    image: "/artwork/featured-original.png",
    alt: "Layered abstract coastal scene with textured earth tones and dark organic forms.",
  },
  {
    id: "black-stone-morning",
    title: "Black Stone Morning",
    artistSlug: "lucien-hart",
    artistName: "Lucien Hart",
    price: "$2,750",
    image: "/artwork/featured-original.png",
    alt: "Contemporary mixed-media artwork with black stone-like forms and warm paper textures.",
  },
  {
    id: "terracotta-window",
    title: "Terracotta Window",
    artistSlug: "sol-rivera",
    artistName: "Sol Rivera",
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

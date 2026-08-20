import type { Metadata } from "next";
import "./globals.css";
import { getBranding } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getBranding();
  return {
    title: siteName,
    description: "An accessibility-first homepage for an original artwork website.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

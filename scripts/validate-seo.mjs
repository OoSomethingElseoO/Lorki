#!/usr/bin/env node

/**
 * SEO contract check. With SEO_BASE_URL it performs a live deployment check;
 * without it, it validates the source contract and exits successfully so CI
 * does not silently test a made-up localhost application.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const base = process.env.SEO_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
const requiredFiles = ["app/sitemap.ts", "app/robots.ts", "app/manifest.ts", "lib/seo.ts"];
const requiredPages = ["app/artworks/[id]/page.tsx", "app/artists/[slug]/page.tsx", "app/news/[slug]/page.tsx"];
const failures = [];

for (const file of [...requiredFiles, ...requiredPages]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

const source = requiredPages.map((file) => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : "").join("\n");
const seoSource = fs.readFileSync(path.join(root, "lib/seo.ts"), "utf8");
for (const token of ["generateMetadata", "StructuredData"]) {
  if (!source.includes(token)) failures.push(`SEO page contract missing ${token}`);
}
if (!seoSource.includes("application/ld+json") && !fs.existsSync(path.join(root, "components/structured-data.tsx"))) failures.push("JSON-LD renderer is missing");
if (!seoSource.includes("alternates") || !seoSource.includes("canonical")) failures.push("canonical metadata helper is missing");
const sitemapSource = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
const robotsSource = fs.readFileSync(path.join(root, "app/robots.ts"), "utf8");
for (const token of ["getSiteUrl", "sitemap.xml", "/api/"]) {
  const haystack = `${sitemapSource}\n${robotsSource}`;
  if (!haystack.includes(token)) failures.push(`robots/sitemap contract missing ${token}`);
}

if (failures.length) {
  console.error("SEO validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (!base) {
  console.log("SEO source contract passed. Set SEO_BASE_URL to run live route checks.");
  process.exit(0);
}

let origin;
try {
  origin = new URL(base);
  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("production SEO_BASE_URL must use HTTPS");
} catch (error) {
  console.error(`Invalid SEO_BASE_URL: ${error.message}`);
  process.exit(1);
}

const routes = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/", "/artists", "/news"];
for (const route of routes) {
  const response = await fetch(new URL(route, origin));
  if (!response.ok) failures.push(`${route} returned HTTP ${response.status}`);
  const body = await response.text();
  if (route === "/robots.txt" && !body.includes("Sitemap:")) failures.push("robots.txt does not advertise sitemap.xml");
  if (route === "/sitemap.xml" && !body.includes("<urlset") && !body.includes("<sitemapindex")) failures.push("sitemap.xml is not XML sitemap output");
  if (route === "/" && !/<link[^>]+rel=["']canonical["']/i.test(body)) failures.push("homepage has no canonical link");
}

if (failures.length) {
  console.error("SEO live validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`SEO live validation passed for ${origin.origin}`);

#!/usr/bin/env node
/**
 * Small, dependency-free guardrail for image and bundle regressions.
 * Run with: npm run audit:frontend
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const roots = ["app", "components"];
const extensions = new Set([".tsx", ".ts", ".jsx", ".js"]);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) files.push(path);
  }
}

for (const directory of roots) await walk(join(root, directory));
const findings = [];
for (const file of files) {
  if (file.endsWith("components/ui/fallback-image.tsx")) continue;
  const source = (await readFile(file, "utf8")).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of source.matchAll(/<img\b([^>]*)>/g)) {
    const attrs = match[1];
    if (!/\bloading\s*=/.test(attrs)) findings.push(`${relative(root, file)}: image is missing loading`);
    if (!/\bdecoding\s*=/.test(attrs)) findings.push(`${relative(root, file)}: image is missing decoding`);
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Frontend asset audit passed (${files.length} source files inspected).`);
}

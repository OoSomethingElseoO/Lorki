import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` only needs this string to be syntactically valid — it
// doesn't connect to anything, just reads prisma/schema.prisma and emits
// client code. Using the strict env() helper here made every Prisma
// command, including generate, hard-fail during `docker build` on hosts
// that don't pass secret env vars into the build step (Render included) —
// confirmed via Prisma's own docs that this is the documented fallback
// pattern, not a workaround. Real commands that need a live connection
// (migrate deploy, db seed, the running app) get the actual DATABASE_URL
// from the environment at runtime, same as always.
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: DATABASE_URL,
  },
});

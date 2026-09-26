#!/usr/bin/env node

import pg from "pg";

const restoreUrl = process.env.RESTORE_DATABASE_URL;
const productionUrl = process.env.DATABASE_URL;

if (!restoreUrl) {
  console.error("RESTORE_DATABASE_URL is required; refusing to run against an unspecified database.");
  process.exit(2);
}
if (productionUrl && restoreUrl === productionUrl) {
  console.error("RESTORE_DATABASE_URL must not equal DATABASE_URL. Use a disposable Neon branch or restore instance.");
  process.exit(2);
}

const requiredTables = ["_prisma_migrations", "AuditLog", "PaymentProviderEvent", "Order", "Artwork"];
const client = new pg.Client({ connectionString: restoreUrl, connectionTimeoutMillis: 15_000, statement_timeout: 20_000 });

try {
  await client.connect();
  await client.query("SELECT 1");
  const tables = await client.query(`
    SELECT tablename FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = ANY($1::text[])
  `, [requiredTables]);
  const found = new Set(tables.rows.map((row) => row.tablename));
  const missing = requiredTables.filter((name) => !found.has(name));
  if (missing.length) throw new Error(`restore is missing required tables: ${missing.join(", ")}`);

  const migration = await client.query(`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1
  `);
  if (!migration.rows[0]) throw new Error("restore has no completed Prisma migration");

  const counts = {};
  for (const table of ["AuditLog", "PaymentProviderEvent", "Order", "Artwork"]) {
    const result = await client.query(`SELECT count(*)::bigint AS count FROM "${table}"`);
    counts[table] = Number(result.rows[0].count);
  }

  console.log(JSON.stringify({
    ok: true,
    checkedAt: new Date().toISOString(),
    latestMigration: migration.rows[0].migration_name,
    counts,
  }));
} catch (error) {
  console.error(`restore drill failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { testDatabaseName, testDatabaseUrl } from "./helpers/test-db-url";

const { Pool } = pg;

// Runs once before the whole suite (in the main process). Creates the isolated
// test database if it does not exist, then applies every Drizzle migration so
// the schema matches lib/db/drizzle exactly.
export default async function setup() {
  const dbName = testDatabaseName();

  // Connect to the existing development database to issue CREATE DATABASE.
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(here, "../../../lib/db/drizzle");

  const pool = new Pool({ connectionString: testDatabaseUrl() });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

import { pgTable, serial, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

// Versioned log of one-shot CONTENT migrations (data transforms), kept strictly
// separate from Drizzle SCHEMA migrations (lib/db/drizzle/*.sql). A migration is
// identified by its `name`; `checksum` captures the migration's source so an
// accidental later edit is detectable. A row is written only after up() succeeds,
// so `content:migrate` skips any name already recorded and never re-applies it.
// This table holds NO customer data and is never touched by seed/import.
export const contentMigrations = pgTable(
  "content_migrations",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    version: text("version").notNull().default("1"),
    checksum: text("checksum").notNull(),
    status: text("status").notNull().default("applied"),
    appliedBy: text("applied_by").notNull().default("content:migrate"),
    detailsJson: jsonb("details_json"),
    appliedAt: timestamp("applied_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_migrations_name_uniq").on(table.name),
  ],
);

import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

// Owner-editable landing-page sections. `key` identifies the section the public
// page renders (e.g. "hero", "benefits"); `content` is a flexible JSON blob of
// that section's editable copy. `isEnabled` + `sortOrder` let the owner toggle
// and reorder sections without code changes. Missing rows fall back to the
// hardcoded defaults baked into the public page.
export const landingSections = pgTable("landing_sections", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isEnabled: boolean("is_enabled").notNull().default(true),
  content: jsonb("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const faqItems = pgTable("faq_items", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Singleton (id = 1). Drives the document head via a client-side head manager;
// production-quality static defaults remain in index.html for crawlers.
export const seoSettings = pgTable("seo_settings", {
  id: integer("id").primaryKey().default(1),
  metaTitle: text("meta_title").notNull().default(""),
  metaDescription: text("meta_description").notNull().default(""),
  ogTitle: text("og_title").notNull().default(""),
  ogDescription: text("og_description").notNull().default(""),
  ogImage: text("og_image").notNull().default(""),
  canonicalUrl: text("canonical_url").notNull().default(""),
  robots: text("robots").notNull().default("index, follow"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Singleton (id = 1). Owner-editable AI behaviour. The Gemini API key is NEVER
// stored here — it lives only in the server env. This row holds the model name,
// prompts and tuning that the admin can change without code edits. `enabled` is
// the global AI kill switch combined with per-lesson topics.aiEnabled.
export const aiSettings = pgTable("ai_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  // Blank = follow the server's env default (config.gemini.model). Never store
  // a hardcoded model here — pinned names rot when Google retires the model.
  model: text("model").notNull().default(""),
  systemPrompt: text("system_prompt").notNull().default(""),
  evalInstruction: text("eval_instruction").notNull().default(""),
  tone: text("tone").notNull().default(""),
  maxResponseLength: integer("max_response_length").notNull().default(0),
  errorMessage: text("error_message").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Owner-editable technical platform settings, stored as a flat key/value map.
// The server defines the authoritative catalog of allowed keys (type, default,
// validation) in lib/platform-settings.ts; this table only holds overrides.
// SECRETS ARE NEVER STORED HERE — API keys/passwords live solely in the server
// environment. Values are kept as text and coerced by the catalog on read.
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Singleton (id = 1). SINGLE SOURCE OF TRUTH for the course price: the public
// price endpoint, the landing page, the promo banner and the amount charged by
// Paynow all read from here. Amounts are stored in grosz (1/100 PLN).
export const pricingSettings = pgTable("pricing_settings", {
  id: integer("id").primaryKey().default(1),
  priceGrosz: integer("price_grosz").notNull().default(3500),
  oldPriceGrosz: integer("old_price_grosz").notNull().default(19900),
  currency: text("currency").notNull().default("PLN"),
  promoEnabled: boolean("promo_enabled").notNull().default(true),
  promoLabel: text("promo_label").notNull().default(""),
  promoStartsAt: timestamp("promo_starts_at"),
  promoEndsAt: timestamp("promo_ends_at"),
  ctaText: text("cta_text").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

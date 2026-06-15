import { db } from "@workspace/db";
import { pricingSettings, seoSettings, landingSections, faqItems } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { config } from "../config/env";
import { logger } from "./logger";

// Single source of truth for the course price. The public price endpoint, the
// landing page, the promo banner and the amount charged by Paynow all read
// through this helper so they can never drift apart. Falls back to the env
// config only when the (seeded) singleton row is missing.
export type PricingSettings = {
  priceGrosz: number;
  oldPriceGrosz: number;
  currency: string;
  promoEnabled: boolean;
  promoLabel: string;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  ctaText: string;
};

export async function getPricingSettings(): Promise<PricingSettings> {
  const [row] = await db
    .select()
    .from(pricingSettings)
    .where(eq(pricingSettings.id, 1))
    .limit(1);

  if (!row) {
    logger.warn("pricing_settings row missing — falling back to env config price");
    return {
      priceGrosz: config.coursePriceGrosz,
      oldPriceGrosz: config.courseOldPriceGrosz,
      currency: config.currency,
      promoEnabled: config.courseOldPriceGrosz > config.coursePriceGrosz,
      promoLabel: "",
      promoStartsAt: null,
      promoEndsAt: null,
      ctaText: "",
    };
  }

  return {
    priceGrosz: row.priceGrosz,
    oldPriceGrosz: row.oldPriceGrosz,
    currency: row.currency,
    promoEnabled: row.promoEnabled,
    promoLabel: row.promoLabel,
    promoStartsAt: row.promoStartsAt,
    promoEndsAt: row.promoEndsAt,
    ctaText: row.ctaText,
  };
}

// Production-quality SEO defaults mirroring the static tags in index.html so a
// missing row never blanks the document head.
export const DEFAULT_SEO = {
  metaTitle: "fizyka7 — kurs fizyki dla klasy 7",
  metaDescription:
    "fizyka7 — nowoczesny kurs fizyki dla klasy 7: interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.",
  ogTitle: "fizyka7 — kurs fizyki dla klasy 7",
  ogDescription:
    "fizyka7 — nowoczesny kurs fizyki dla klasy 7: interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.",
  ogImage: "",
  canonicalUrl: "",
  robots: "index, follow",
};

export type SeoSettings = typeof DEFAULT_SEO;

export async function getSeoSettings(): Promise<SeoSettings> {
  const [row] = await db
    .select()
    .from(seoSettings)
    .where(eq(seoSettings.id, 1))
    .limit(1);
  if (!row) return { ...DEFAULT_SEO };
  return {
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImage: row.ogImage,
    canonicalUrl: row.canonicalUrl,
    robots: row.robots,
  };
}

// `onlyEnabled` is used by the public landing endpoint; the admin editor reads
// every section regardless of its enabled/sort state.
export async function getLandingSections(onlyEnabled: boolean) {
  const rows = await db
    .select()
    .from(landingSections)
    .orderBy(asc(landingSections.sortOrder), asc(landingSections.id));
  return onlyEnabled ? rows.filter((s) => s.isEnabled) : rows;
}

export async function getFaqItems(onlyVisible: boolean) {
  const rows = await db
    .select()
    .from(faqItems)
    .orderBy(asc(faqItems.sortOrder), asc(faqItems.id));
  return onlyVisible ? rows.filter((f) => f.isVisible) : rows;
}

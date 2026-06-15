import { useEffect } from "react";
import { useGetSeoContent } from "@workspace/api-client-react";

/**
 * Fallback SEO values — mirror the production-quality defaults baked into
 * index.html / the API's DEFAULT_SEO so the page is well-described before the
 * settings request resolves.
 */
const FALLBACK_SEO = {
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

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Client-side <head> manager. Reads the SEO settings singleton and reflects it
 * into the document title and meta/link tags, falling back to sensible defaults
 * while loading or when a field is empty. Renders nothing.
 */
export function SeoHead() {
  const { data } = useGetSeoContent();

  useEffect(() => {
    const seo = { ...FALLBACK_SEO, ...(data ?? {}) };

    if (seo.metaTitle) document.title = seo.metaTitle;
    upsertMeta("name", "description", seo.metaDescription);
    upsertMeta("name", "robots", seo.robots);
    upsertMeta("property", "og:title", seo.ogTitle || seo.metaTitle);
    upsertMeta(
      "property",
      "og:description",
      seo.ogDescription || seo.metaDescription,
    );
    upsertMeta("property", "og:image", seo.ogImage);
    upsertMeta("name", "twitter:title", seo.ogTitle || seo.metaTitle);
    upsertMeta(
      "name",
      "twitter:description",
      seo.ogDescription || seo.metaDescription,
    );
    upsertLink("canonical", seo.canonicalUrl);
  }, [data]);

  return null;
}

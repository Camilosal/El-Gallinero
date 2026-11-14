import type { Metadata } from "next";
import { APP_DEVELOPER } from "@/lib/branding";
import { LEGAL } from "@/lib/legal";

export const SITE_URL = "https://gallinero.iwage.co";
export const SITE_NAME = "El Gallinero · Iwagé Granja";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/guia/inicio-dashboard.webp`;

export const ENTITY_IDS = {
  person: "https://camilosaldarriaga.com/#person",
  organization: "https://iwage.co/#organization",
  website: `${SITE_URL}/#website`,
  software: `${SITE_URL}/#software`,
  project: "https://iwage.co/granja#project",
} as const;

export function canonicalUrlFor(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return SITE_URL;
  }
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const clean = normalized.replace(/\/+$/, "");
  return `${SITE_URL}${clean || ""}`;
}

export function toAbsoluteUrl(pathOrUrl?: string): string {
  if (!pathOrUrl || !pathOrUrl.trim()) {
    return DEFAULT_OG_IMAGE;
  }
  const value = pathOrUrl.trim();
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${SITE_URL}${normalized}`;
}

export function fitSeoTitle(rawTitle: string, suffix = " · El Gallinero", maxLen = 62): string {
  const clean = rawTitle.trim().replace(/\s+/g, " ");
  if (clean.length + suffix.length <= maxLen) {
    return `${clean}${suffix}`;
  }
  const budget = Math.max(15, maxLen - suffix.length);
  const sliced = clean.slice(0, budget);
  const lastSpace = sliced.lastIndexOf(" ");
  const base = lastSpace > 12 ? sliced.slice(0, lastSpace) : sliced;
  return `${base.replace(/[,:;.\-]+$/, "")}${suffix}`;
}

export function fitSeoDescription(rawDesc: string, maxLen = 155): string {
  const clean = rawDesc.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLen) {
    return clean;
  }
  const sliced = clean.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const base = lastSpace > 60 ? sliced.slice(0, lastSpace) : sliced;
  return `${base.replace(/[,:;.\-]+$/, "")}…`;
}

export interface BuildPageMetadataOptions {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: "website" | "article";
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
}

export function buildPageMetadata(options: BuildPageMetadataOptions): Metadata {
  const {
    title,
    description,
    path,
    ogImage,
    ogImageAlt,
    ogType = "website",
    noindex = false,
    publishedTime,
    modifiedTime,
  } = options;

  const canonical = canonicalUrlFor(path);
  const absoluteOgImage = toAbsoluteUrl(ogImage);
  const imageAlt = ogImageAlt ?? title;

  const openGraph: Metadata["openGraph"] =
    ogType === "article"
      ? {
          title,
          description,
          url: canonical,
          siteName: SITE_NAME,
          locale: "es_CO",
          type: "article",
          publishedTime,
          modifiedTime,
          authors: [APP_DEVELOPER.url],
          images: [
            {
              url: absoluteOgImage,
              width: 1200,
              height: 630,
              alt: imageAlt,
            },
          ],
        }
      : {
          title,
          description,
          url: canonical,
          siteName: SITE_NAME,
          locale: "es_CO",
          type: "website",
          images: [
            {
              url: absoluteOgImage,
              width: 1200,
              height: 630,
              alt: imageAlt,
            },
          ],
        };

  return {
    title,
    description,
    ...(noindex ? {} : { alternates: { canonical } }),
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteOgImage],
    },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export function buildBaseEntities(): Record<string, unknown>[] {
  const rawDigits = LEGAL.whatsapp.replace(/\D/g, "");
  const phone =
    rawDigits.length === 10 && rawDigits.startsWith("3")
      ? `+57${rawDigits}`
      : rawDigits
        ? `+${rawDigits}`
        : "+573026693366";

  return [
    {
      "@type": "Person",
      "@id": ENTITY_IDS.person,
      name: APP_DEVELOPER.name,
      url: APP_DEVELOPER.url,
      jobTitle: "Consultor de automatización e implementación de IA",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Ibagué",
        addressRegion: "Tolima",
        addressCountry: "CO",
      },
      sameAs: ["https://github.com/Camilosal", "https://iwage.co"],
    },
    {
      "@type": "Organization",
      "@id": ENTITY_IDS.organization,
      name: "Iwagé",
      url: "https://iwage.co",
      logo: `${SITE_URL}/icon-512.png`,
      description:
        "Ecosistema Iwagé en Ibagué, Tolima: Iwagé Granja, meliponicultura, café, tierras y software agropecuario abierto.",
      founder: { "@id": ENTITY_IDS.person },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Ibagué",
        addressRegion: "Tolima",
        addressCountry: "CO",
      },
      areaServed: [
        { "@type": "Country", name: "Colombia" },
        { "@type": "AdministrativeArea", name: "Tolima" },
      ],
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: LEGAL.email,
          telephone: phone,
          availableLanguage: "es",
          areaServed: "CO",
        },
      ],
      sameAs: [
        "https://iwage.co",
        "https://camilosaldarriaga.com",
        "https://espaciosplus.com",
        "https://github.com/Camilosal/El-Gallinero",
      ],
    },
    {
      "@type": "WebSite",
      "@id": ENTITY_IDS.website,
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: "es-CO",
      publisher: { "@id": ENTITY_IDS.organization },
    },
  ];
}

export function buildSoftwareNode(): Record<string, unknown> {
  return {
    "@type": "SoftwareApplication",
    "@id": ENTITY_IDS.software,
    name: "El Gallinero",
    description:
      "Gestión avícola y multiespecie de código abierto: identidad individual por ave, trazabilidad financiera automática, sanidad ICA, clasificación NTC 1240, inventarios y modo simple/avanzado. Funciona sin conexión. En producción en Iwagé Granja, Ibagué, Colombia.",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Farm Management Software",
    operatingSystem: "Web, PWA",
    inLanguage: "es-CO",
    url: SITE_URL,
    codeRepository: "https://github.com/Camilosal/El-Gallinero",
    license: "https://github.com/Camilosal/El-Gallinero/blob/main/LICENSE",
    programmingLanguage: ["TypeScript"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "COP",
      description:
        "Plan Semilla gratuito con 1 lote activo; planes por ciclo de pago con Nequi, Daviplata y PSE",
    },
    creator: { "@id": ENTITY_IDS.organization },
    author: { "@id": ENTITY_IDS.person },
    maintainer: { "@id": ENTITY_IDS.person },
    isPartOf: { "@id": ENTITY_IDS.project },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbNode(
  canonicalUrl: string,
  items: BreadcrumbItem[],
): Record<string, unknown> {
  const fullItems =
    items[0]?.path === "/"
      ? items
      : [{ name: "Inicio", path: "/" }, ...items];

  return {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: fullItems.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: canonicalUrlFor(item.path),
    })),
  };
}

export function buildFaqNode(
  canonicalUrl: string,
  faqs: ReadonlyArray<{ q: string; a: string }>,
): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}

export type WebPageKind =
  | "WebPage"
  | "AboutPage"
  | "ContactPage"
  | "CollectionPage"
  | "FAQPage";

export interface BuildJsonLdOptions {
  path: string;
  title: string;
  description?: string;
  pageType?: WebPageKind;
  ogImage?: string;
  breadcrumbs?: BreadcrumbItem[];
  extraNodes?: Record<string, unknown>[];
}

export function buildJsonLd(options: BuildJsonLdOptions): Record<string, unknown> {
  const {
    path,
    title,
    description,
    pageType = "WebPage",
    ogImage,
    breadcrumbs,
    extraNodes = [],
  } = options;

  const canonical = canonicalUrlFor(path);
  const breadcrumbNode = breadcrumbs?.length
    ? buildBreadcrumbNode(canonical, breadcrumbs)
    : null;

  const webPageNode: Record<string, unknown> = {
    "@type": pageType,
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: title,
    inLanguage: "es-CO",
    isPartOf: { "@id": ENTITY_IDS.website },
    about: { "@id": ENTITY_IDS.software },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: toAbsoluteUrl(ogImage),
    },
  };

  if (description) {
    webPageNode.description = description;
  }

  if (breadcrumbNode) {
    webPageNode.breadcrumb = { "@id": `${canonical}#breadcrumb` };
  }

  const graph: Record<string, unknown>[] = [
    ...buildBaseEntities(),
    webPageNode,
  ];

  if (breadcrumbNode) {
    graph.push(breadcrumbNode);
  }

  if (extraNodes.length > 0) {
    graph.push(...extraNodes);
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

import type { MetadataRoute } from "next";
import { BITACORA_ARTICLES } from "@/lib/bitacora-content";
import { GUIDE_DEFAULT_UPDATED_AT, guides } from "@/lib/guide-data";
import { CYCLE_PLANS_SHOWCASE } from "@/lib/landing-showcase";
import { SITE_URL, STATIC_ROUTE_LAST_MODIFIED } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = Object.keys(STATIC_ROUTE_LAST_MODIFIED);

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(STATIC_ROUTE_LAST_MODIFIED[route]),
    changeFrequency: ["", "/funcionalidades", "/recursos", "/recursos/herramientas", "/recursos/novedades", "/bitacora", "/guia"].includes(route) ? "weekly" : "monthly",
    priority: route === "" ? 1 : ["/registro", "/funcionalidades", "/recursos", "/recursos/herramientas", "/recursos/novedades", "/bitacora", "/guia"].includes(route) ? 0.9 : 0.7,
  }));

  for (const plan of CYCLE_PLANS_SHOWCASE) {
    entries.push({
      url: `${SITE_URL}/planes/${plan.slug}`,
      lastModified: new Date(plan.updatedAt),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const article of BITACORA_ARTICLES) {
    entries.push({
      url: `${SITE_URL}/bitacora/${article.slug}`,
      lastModified: new Date(article.reviewedAt),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const guide of guides) {
    entries.push({
      url: `${SITE_URL}/guia/${guide.slug}`,
      lastModified: new Date(guide.updatedAt ?? GUIDE_DEFAULT_UPDATED_AT),
      changeFrequency: "monthly",
      priority: 0.75,
    });
  }

  return entries;
}

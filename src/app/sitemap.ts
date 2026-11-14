import type { MetadataRoute } from "next";
import { BITACORA_ARTICLES } from "@/lib/bitacora-content";
import { guides } from "@/lib/guide-data";
import { CYCLE_PLANS_SHOWCASE } from "@/lib/landing-showcase";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/registro",
    "/guia",
    "/ayuda",
    "/open-source",
    "/realidad-campo",
    "/planes",
    "/nosotros",
    "/contacto",
    "/bitacora",
    "/terminos",
    "/retracto",
    "/privacidad",
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date("2026-11-14"),
    changeFrequency: route === "" || route === "/bitacora" || route === "/guia" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/registro" || route === "/bitacora" || route === "/guia" ? 0.9 : 0.7,
  }));

  for (const plan of CYCLE_PLANS_SHOWCASE) {
    entries.push({
      url: `${SITE_URL}/planes/${plan.slug}`,
      lastModified: new Date("2026-11-14"),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const article of BITACORA_ARTICLES) {
    entries.push({
      url: `${SITE_URL}/bitacora/${article.slug}`,
      lastModified: new Date(article.publishedAt),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const guide of guides) {
    entries.push({
      url: `${SITE_URL}/guia/${guide.slug}`,
      lastModified: new Date("2026-11-14"),
      changeFrequency: "monthly",
      priority: 0.75,
    });
  }

  return entries;
}

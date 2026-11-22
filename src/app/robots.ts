import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { APP_ROUTE_PREFIXES } from "@/lib/app-routes";

const PRIVATE_DISALLOW = [
  "/api/",
  "/admin",
  "/dashboard",
  ...APP_ROUTE_PREFIXES,
  "/login",
  "/*?s=",
  "/*?busqueda=",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "Claude-SearchBot",
          "Claude-User",
          "PerplexityBot",
          "Perplexity-User",
          "Applebot",
        ],
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "Google-Extended",
          "Applebot-Extended",
          "CCBot",
        ],
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

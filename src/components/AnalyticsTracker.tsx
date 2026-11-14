"use client";

import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    swetrix?: {
      init: (pid: string, options?: { apiURL?: string }) => void;
      trackViews: () => void;
      track: (options: { ev: string; unique?: boolean; meta?: Record<string, string> }) => void;
    };
  }
}

export const ATTRIBUTION_STORAGE_KEY = "galli_attribution_source";

const AI_REFERRERS: ReadonlyArray<{ match: string; label: string }> = [
  { match: "chatgpt.com", label: "ia:chatgpt" },
  { match: "chat.openai.com", label: "ia:chatgpt" },
  { match: "perplexity.ai", label: "ia:perplexity" },
  { match: "gemini.google.com", label: "ia:gemini" },
  { match: "copilot.microsoft.com", label: "ia:copilot" },
  { match: "claude.ai", label: "ia:claude" },
];

export function detectAttributionSource(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source")?.trim();
    const utmMedium = params.get("utm_medium")?.trim();
    const utmCampaign = params.get("utm_campaign")?.trim();
    if (utmSource) {
      return [
        `utm:${utmSource}`,
        utmMedium ? `/${utmMedium}` : "",
        utmCampaign ? `(${utmCampaign})` : "",
      ].join("");
    }

    const ref = document.referrer?.trim().toLowerCase() || "";
    if (!ref) return null;

    const aiHit = AI_REFERRERS.find((item) => ref.includes(item.match));
    if (aiHit) return aiHit.label;

    if (ref.includes("google.")) return "buscador:google";
    if (ref.includes("bing.")) return "buscador:bing";
    if (ref.includes("iwage.co") && !ref.includes("gallinero.iwage.co")) {
      return "ecosistema:iwage.co";
    }
    if (ref.includes("camilosaldarriaga.com")) {
      return "ecosistema:camilosaldarriaga.com";
    }
    if (ref.includes("espaciosplus.com")) {
      return "ecosistema:espaciosplus.com";
    }

    const hostname = new URL(ref).hostname;
    if (hostname && !hostname.includes("gallinero.iwage.co")) {
      return `referente:${hostname}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function getStoredAttributionSource(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  meta?: Record<string, string>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.swetrix?.track({ ev: eventName, meta });
  } catch {
    // Analítica opcional nunca debe interrumpir flujos de usuario.
  }
}

export function AnalyticsTracker() {
  const swetrixPid = process.env.NEXT_PUBLIC_SWETRIX_PID?.trim() || "";
  const swetrixApiUrl = process.env.NEXT_PUBLIC_SWETRIX_API_URL?.trim() || undefined;

  useEffect(() => {
    const detected = detectAttributionSource();
    if (!detected) return;
    try {
      if (!window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) {
        window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, detected);
      }
    } catch {
      // Ignorar si sessionStorage no está disponible.
    }
  }, []);

  if (!swetrixPid) {
    return null;
  }

  return (
    <Script
      src="https://swetrix.org/swetrix.js"
      strategy="lazyOnload"
      onLoad={() => {
        try {
          if (window.swetrix) {
            window.swetrix.init(
              swetrixPid,
              swetrixApiUrl ? { apiURL: swetrixApiUrl } : undefined,
            );
            window.swetrix.trackViews();
            const source = getStoredAttributionSource();
            if (source?.startsWith("ia:")) {
              window.swetrix.track({ ev: "ai_referrer_visit", meta: { source } });
            }
          }
        } catch {
          // Ignorar fallos de inicialización de analítica.
        }
      }}
    />
  );
}

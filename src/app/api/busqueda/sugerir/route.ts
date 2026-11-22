import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { isRequestRateLimited } from "@/lib/rate-limit";
import { normalizeText } from "@/lib/text";
import { searchEntries, type SearchEntry } from "@/lib/navigation";
import {
  getGateFlagForHref,
  isHrefEnabledByFlags,
  type FeatureFlagKey,
} from "@/lib/onboarding";
import { guideDetailHref, guides } from "@/lib/guide-data";
import {
  disambiguateSearchWithJev,
  type SearchSuggestionCandidate,
} from "@/lib/agent/jev-capabilities";

const SYNONYM_EXPANSIONS: Array<[RegExp, string]> = [
  [/\b(vacun|remedio|medic|inyec|carencia|retiro|enferm|veterin|botiquin)\b/, "sanidad control calendario bioseguridad retiro"],
  [/\b(murieron|mortal|bajas|ahog|muert)\b/, "mortalidad alertas bajas sanidad"],
  [/\b(postura|pone|poniendo|cubeta|carton|yema|cascara|peps)\b/, "huevos recoleccion inventario peps"],
  [/\b(concentrado|maiz|bulto|comida|purina|racion|forraje|comedero)\b/, "alimentacion alimento inventario egresos"],
  [/\b(plata|dinero|gast|factur|recibo|compre|deuda|fiao|fiado|cobr|pagar|dian|banco)\b/, "finanzas egresos ventas cuentas balance"],
  [/\b(jaula|galpon|corral|nido|lote|camada|espacio)\b/, "ubicaciones lugares galpones lotes"],
  [/\b(incub|nacedora|pollito|huevo fertil|embrion)\b/, "incubacion reproduccion nacimiento"],
  [/\b(abon|estiercol|compost|cama|olores)\b/, "gallinaza compostaje"],
  [/\b(peso|gramo|kilo|engorde|crecimiento|fcr|conversion)\b/, "peso carne estandares raza alimentacion"],
  [/\b(qr|camara|foto|codigo|escane)\b/, "escanear qr adjuntos ocr"],
  [/\b(offline|internet|senal|campo|voz|microfono)\b/, "offline voz asistente cierre"],
  [/\b(error|falla|bug|no sirve|bloque|ayuda|problema)\b/, "fallas soporte guia control"],
  [/\b(export|descarg|respald|backup|csv|excel|xlsx|siigo|alegra|odoo|zoho|erp|conector|api|token|puc)\b/, "exportar conectores erp csv excel json siigo alegra odoo zoho"],
  [/\b(configur|usuario|permiso|rol|operario|llave|tenant|superadmin|granja|plan|pago|nequi|pse|wompi|catalogo)\b/, "configuracion usuarios roles llave en mano granjas plan catalogos"],
];

function expandQueryTokens(query: string): string[] {
  const norm = normalizeText(query);
  const parts = [norm];
  for (const [pattern, expansion] of SYNONYM_EXPANSIONS) {
    if (pattern.test(norm)) parts.push(expansion);
  }
  return Array.from(
    new Set(
      parts
        .join(" ")
        .split(/\s+/)
        .filter((t) => t.length >= 3),
    ),
  );
}

function buildNavigationCandidates(
  query: string,
  flags?: Partial<Record<FeatureFlagKey, boolean>> | null,
): SearchSuggestionCandidate[] {
  const tokens = expandQueryTokens(query);

  const scored = searchEntries
    .map((entry: SearchEntry) => {
      const hay = normalizeText(
        `${entry.label} ${entry.group} ${entry.keywords.join(" ")}`,
      );
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) {
          score += normalizeText(entry.label).includes(token) ? 10 : 5;
        }
      }
      if (!flags || isHrefEnabledByFlags(entry.href, flags)) {
        score += 1;
      }
      const lockedByFlag =
        flags && !isHrefEnabledByFlags(entry.href, flags)
          ? (getGateFlagForHref(entry.href) ?? undefined)
          : undefined;

      return {
        score,
        candidate: {
          id: `${entry.href}|${entry.label}`,
          title: entry.label,
          summary: `${entry.group}: ${entry.keywords.slice(0, 6).join(", ")}`,
          href: entry.href,
          group: entry.group,
          ...(lockedByFlag ? { lockedByFlag } : {}),
        } satisfies SearchSuggestionCandidate,
      };
    })
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 6).map((item) => item.candidate);
}

function buildGuideCandidates(
  query: string,
  basePath = "/guia",
): SearchSuggestionCandidate[] {
  const tokens = expandQueryTokens(query);

  const scored = guides
    .map((guide) => {
      const hay = normalizeText(
        `${guide.title} ${guide.summary} ${guide.tags.join(" ")} ${guide.module}`,
      );
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) {
          score += normalizeText(guide.title).includes(token) ? 10 : 5;
        }
      }
      return {
        score,
        candidate: {
          id: guide.slug,
          title: guide.title,
          summary: guide.summary,
          href: guideDetailHref(guide.slug, basePath),
          group: guide.module,
        } satisfies SearchSuggestionCandidate,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 6).map((item) => item.candidate);
}

export const POST = withApiHandler(async (req: NextRequest) => {
  if (
    isRequestRateLimited(req, {
      namespace: "search-suggest",
      windowMs: 60 * 1000,
      maxAttempts: 30,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas consultas en poco tiempo." },
      { status: 429 },
    );
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const rawQuery = typeof body.query === "string" ? body.query.trim().slice(0, 200) : "";
  if (rawQuery.length < 3) {
    return NextResponse.json({ ok: true, suggestions: [], usedJev: false });
  }

  const scope = body.scope === "guides" ? "guides" : "navigation";
  const basePath =
    typeof body.basePath === "string" && body.basePath.startsWith("/manual")
      ? "/manual"
      : "/guia";
  const flags =
    body.flags && typeof body.flags === "object"
      ? (body.flags as Partial<Record<FeatureFlagKey, boolean>>)
      : undefined;

  const candidates =
    scope === "guides"
      ? buildGuideCandidates(rawQuery, basePath)
      : buildNavigationCandidates(rawQuery, flags);

  const { suggestions, usedJev } = await disambiguateSearchWithJev({
    query: rawQuery,
    candidates,
  });

  return NextResponse.json({
    ok: true,
    suggestions,
    usedJev,
  });
});

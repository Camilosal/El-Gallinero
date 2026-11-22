/**
 * C2: payload de notificación push local de briefings.
 *
 * Regla de privacidad del plan: la notificación NUNCA incluye datos sensibles
 * de la granja (hallazgos, cifras, nombres). Solo título genérico + conteo;
 * el detalle se ve al abrir /inicio dentro de la app autenticada.
 */

export interface BriefingPushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  unreadCount: number;
}

export function buildBriefingPushPayload(unreadCount: number): BriefingPushPayload {
  const count = Math.max(0, Math.floor(unreadCount));
  return {
    title: "Gina te informa",
    body:
      count === 1
        ? "Tienes 1 novedad de tu granja. Ábrela en IwaGranja."
        : `Tienes ${count} novedades de tu granja. Ábrelas en IwaGranja.`,
    url: "/inicio",
    tag: "gina-briefing",
    unreadCount: count,
  };
}
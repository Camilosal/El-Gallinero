/**
 * Identidad del vendedor y frases comerciales compartidas.
 *
 * Los datos reales se configuran por variables de entorno del servidor
 * (LEGAL_*). Mientras algún dato siga como "[por confirmar]", las páginas
 * legales muestran un aviso de BORRADOR pendiente de revisión por abogado.
 */
export const PENDING = "[por confirmar]";

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

export const LEGAL = {
  /** Nombre completo (persona natural) o razón social (sociedad). */
  razonSocial: env("LEGAL_RAZON_SOCIAL", PENDING),
  /** NIT o RUT. */
  nit: env("LEGAL_NIT", PENDING),
  /** "persona natural" | "sociedad": define si aplica el registro RNBD. */
  tipoPersona: env("LEGAL_TIPO_PERSONA", PENDING),
  ciudad: env("LEGAL_CIUDAD", "Ibagué, Tolima, Colombia"),
  email: env("LEGAL_EMAIL", PENDING),
  whatsapp: env("LEGAL_WHATSAPP", PENDING),
  /** Texto exacto sobre IVA mostrado junto a los precios. */
  ivaNote: env("LEGAL_IVA_NOTE", "IVA: por confirmar"),
  sitio: "gallinero.iwage.co",
  marca: "El Gallinero · Iwagé Granja",
} as const;

export const SIC_URL = "https://www.sic.gov.co";
export const SIC_LABEL = "Superintendencia de Industria y Comercio (SIC)";
export const RESPONSE_TIME = "1 día hábil";
export const LEGAL_DOCS_VERSION = "2026-11-borrador-1";
/** Clave en app_settings donde se guarda la aceptación registrada al crear la granja. */
export const LEGAL_CONSENT_SETTING_KEY = "legal.consent.v1";

/** Frases comerciales: landing, planes y términos deben usarlas palabra por palabra. */
export const PLAN_PROMISES = {
  noAutoCharge: "Sin cobros automáticos ni cláusulas de permanencia.",
  expiry:
    "Si vence un ciclo y decides no renovar, nunca bloqueamos la lectura de tu historial ni te impedimos cerrar o vender tu lote en curso.",
  pricesCop: "Precios en pesos colombianos (COP).",
} as const;

export function priceNote(): string {
  return `${PLAN_PROMISES.pricesCop} ${LEGAL.ivaNote}.`;
}

export function legalIsDraft(): boolean {
  return [
    LEGAL.razonSocial,
    LEGAL.nit,
    LEGAL.tipoPersona,
    LEGAL.email,
    LEGAL.whatsapp,
  ].some((v) => v === PENDING);
}

export function whatsappLink(message?: string): string | null {
  const digits = LEGAL.whatsapp.replace(/\D/g, "");
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export const LEGAL_LINKS = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/retracto", label: "Retracto y reembolsos" },
  { href: "/privacidad", label: "Tratamiento de datos" },
] as const;


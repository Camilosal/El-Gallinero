export const CONTACT_ROLES = ["cliente", "proveedor", "ambos"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const PERSON_TYPES = ["natural", "juridica"] as const;
export type PersonType = (typeof PERSON_TYPES)[number];

export const DOCUMENT_TYPES = ["CC", "NIT", "CE", "RUT", "Otro"] as const;

export const PAYMENT_METHODS = [
  { value: "contado", label: "Contado / Efectivo" },
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "credito", label: "Crédito / Plazo" },
  { value: "otro", label: "Otro" },
] as const;

export const ROLE_LABELS: Record<ContactRole, string> = {
  cliente: "Cliente",
  proveedor: "Proveedor",
  ambos: "Cliente y Proveedor",
};

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  natural: "Persona natural",
  juridica: "Empresa / Jurídica",
};

export const CLIENT_CATEGORY_SUGGESTIONS = [
  "Tienda de barrio",
  "Mayorista / Distribuidor",
  "Restaurante / Panadería",
  "Consumidor final",
  "Mercado campesino",
  "Finca / Vecino",
];

export const SUPPLIER_CATEGORY_SUGGESTIONS = [
  "Alimentos y concentrados",
  "Veterinaria y vacunas",
  "Aves y genética",
  "Insumos y ferretería",
  "Empaques y cubetas",
  "Transporte y servicios",
];

export interface ContactStats {
  salesCount: number;
  totalSalesAmount: number;
  receivablePending: number;
  overdueReceivables: number;
  purchasesCount: number;
  totalPurchasesAmount: number;
  payablePending: number;
  overduePayables: number;
  associatedCatalogItems: number;
  lastActivityDate: string | null;
}

export interface ContactRecord {
  id: string;
  name: string;
  role: ContactRole | string;
  personType: PersonType | string;
  documentType: string | null;
  documentNumber: string | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  zone: string | null;
  locationNotes: string | null;
  categoryTag: string | null;
  paymentMethod: string | null;
  creditDays: number;
  deliverySchedule: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _offlinePending?: boolean;
  stats?: ContactStats;
}

/** Verifica si un contacto aplica al filtro de rol solicitado (`cliente`, `proveedor` o `all`). */
export function contactMatchesRole(
  contactRole: string | null | undefined,
  filter: "cliente" | "proveedor" | "ambos" | "all",
): boolean {
  if (filter === "all") return true;
  if (filter === "ambos") return contactRole === "ambos";
  if (filter === "cliente") return contactRole === "cliente" || contactRole === "ambos";
  if (filter === "proveedor") return contactRole === "proveedor" || contactRole === "ambos";
  return true;
}

export function normalizeContactNameKey(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function formatContactLocation(contact: Partial<ContactRecord>): string {
  return [contact.zone, contact.city, contact.department]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}

/** Construye URL directa a WhatsApp normalizando móviles colombianos de 10 dígitos (`3XXXXXXXXX`). */
export function buildWhatsAppUrl(phoneOrWhatsapp: string | null | undefined): string | null {
  const raw = String(phoneOrWhatsapp || "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.length === 10 && digits.startsWith("3")) {
    digits = `57${digits}`;
  }
  return `https://wa.me/${digits}`;
}

export function getPaymentMethodLabel(value: string | null | undefined): string {
  if (!value) return "";
  return PAYMENT_METHODS.find((m) => m.value === value)?.label || value;
}

export function getContactCompleteness(contact: Partial<ContactRecord>): {
  hasContactInfo: boolean;
  hasLocation: boolean;
  hasCommercialTerms: boolean;
  scorePct: number;
  missingFields: string[];
} {
  const hasPhoneOrWa = Boolean(contact.phone?.trim() || contact.whatsapp?.trim());
  const hasEmail = Boolean(contact.email?.trim());
  const hasContactInfo = hasPhoneOrWa || hasEmail;
  const hasLocation = Boolean(contact.city?.trim() || contact.address?.trim() || contact.zone?.trim());
  const hasDocument = Boolean(contact.documentNumber?.trim());
  const hasCommercialTerms = Boolean(contact.paymentMethod?.trim() || (contact.creditDays ?? 0) > 0 || contact.categoryTag?.trim());

  const checks = [
    { ok: hasPhoneOrWa, label: "teléfono/WhatsApp" },
    { ok: Boolean(contact.city?.trim() || contact.address?.trim()), label: "ubicación/dirección" },
    { ok: hasDocument, label: "documento/NIT" },
    { ok: hasCommercialTerms, label: "condiciones comerciales" },
  ];

  const completed = checks.filter((c) => c.ok).length;
  return {
    hasContactInfo,
    hasLocation,
    hasCommercialTerms,
    scorePct: Math.round((completed / checks.length) * 100),
    missingFields: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

/** Suma `creditDays` a una fecha ISO YYYY-MM-DD para sugerir fecha de vencimiento. */
export function computeCreditDueDate(baseDate: string, creditDays: number): string {
  const days = Math.max(0, Math.round(Number(creditDays || 0)));
  if (!baseDate || !/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) return "";
  const dt = new Date(`${baseDate}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return "";
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

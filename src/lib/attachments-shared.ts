import { apiFetch } from "@/lib/fetch";

export const ATTACHMENT_ENTITY_TYPES = [
  "transaction",
  "payment",
  "contact",
  "health_control",
  "acquisition",
  "mortality",
  "asset",
  "maintenance",
  "composting",
  "biosecurity",
  "daily_closure",
  "other",
] as const;

export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

export const ATTACHMENT_CATEGORIES = [
  { value: "factura_dian", label: "Factura / Soporte DIAN" },
  { value: "etiqueta_ica", label: "Etiqueta / Lote ICA" },
  { value: "comprobante_pago", label: "Comprobante de pago (Nequi / Banco)" },
  { value: "rut_documento", label: "RUT / Documento de identidad" },
  { value: "gsmi_movilizacion", label: "Guía Sanitaria ICA (GSMI)" },
  { value: "certificado_genetico", label: "Certificado genético / sanitario" },
  { value: "signo_clinico", label: "Evidencia clínica / necropsia" },
  { value: "placa_serie", label: "Placa de serie / equipo" },
  { value: "garantia", label: "Garantía / manual técnico" },
  { value: "antes_despues", label: "Evidencia antes / después" },
  { value: "general", label: "Soporte general" },
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number]["value"];

export const OCR_MODES = [
  "factura_compra",
  "etiqueta_ica",
  "comprobante_pago",
  "rut_contacto",
] as const;

export type OcrExtractionMode = (typeof OCR_MODES)[number];

export const MORTALITY_QUICK_OBSERVATIONS = [
  "Normal",
  "Humedad cama",
  "Falta agua",
  "Signo clínico",
] as const;

export const MAX_COMPRESSED_IMAGE_BYTES = 240 * 1024; // < 250 KB según offline-first-rural-ux
export const MAX_PDF_BYTES = 1500 * 1024; // 1.5 MB para documentos PDF

export interface AttachmentRecord {
  id: string;
  entityType: AttachmentEntityType | string;
  entityId: string;
  category: AttachmentCategory | string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl?: string;
  extractedText?: string | null;
  extractedData?: Record<string, unknown> | null;
  notes?: string | null;
  createdAt?: string;
  _offlinePending?: boolean;
}

export interface FacturaCompraOcrData {
  mode: "factura_compra";
  supplierName?: string;
  documentType?: "NIT" | "CC";
  documentNumber?: string;
  invoiceNumber?: string;
  date?: string;
  category?: string;
  productName?: string;
  presentation?: string;
  presentationsCount?: number;
  factor?: number;
  unit?: string;
  unitPrice?: number;
  totalAmount?: number;
  notes?: string;
  summary: string;
}

export interface EtiquetaIcaOcrData {
  mode: "etiqueta_ica";
  product?: string;
  activeIngredient?: string;
  icaRegistration?: string;
  vaccineLab?: string;
  vaccineLot?: string;
  vaccineExpiryDate?: string;
  withdrawalDays?: number;
  withdrawalUntilDate?: string;
  coldChainTempC?: string;
  administrationRoute?: string;
  eventType?: "vacunacion" | "desparasitacion" | "tratamiento" | "vitaminas";
  summary: string;
}

export interface ComprobantePagoOcrData {
  mode: "comprobante_pago";
  amount?: number;
  date?: string;
  method?: "efectivo" | "transferencia" | "nequi" | "daviplata" | "otro";
  reference?: string;
  counterparty?: string;
  summary: string;
}

export interface RutContactoOcrData {
  mode: "rut_contacto";
  name?: string;
  personType?: "natural" | "juridica";
  documentType?: "NIT" | "CC" | "CE";
  documentNumber?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  department?: string;
  summary: string;
}

export type OcrExtractedPayload =
  | FacturaCompraOcrData
  | EtiquetaIcaOcrData
  | ComprobantePagoOcrData
  | RutContactoOcrData;

export function createDraftEntityId(prefix = "draft"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function calculateWithdrawalUntilDate(
  applicationDate: string | null | undefined,
  withdrawalDays: number | string | null | undefined,
): string | null {
  const days = Number(withdrawalDays ?? 0);
  if (!applicationDate || !/^\d{4}-\d{2}-\d{2}$/.test(applicationDate) || !Number.isFinite(days) || days <= 0) {
    return null;
  }
  const base = new Date(`${applicationDate}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + Math.round(days));
  return base.toISOString().slice(0, 10);
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIdx + 1);
  return Math.round((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime imágenes en el navegador a WebP/JPEG <= 1280px y < 240 KB
 * cumpliendo la regla offline-first-rural-ux (< 250 KB por foto).
 */
export async function compressImageToDataUrl(
  file: File | Blob,
  maxDimension = 1280,
  maxBytes = MAX_COMPRESSED_IMAGE_BYTES,
): Promise<{ dataUrl: string; mimeType: string; sizeBytes: number }> {
  const rawDataUrl = await readFileAsDataUrl(file);

  if (typeof document === "undefined" || typeof Image === "undefined") {
    const sizeBytes = estimateDataUrlBytes(rawDataUrl);
    return {
      dataUrl: rawDataUrl,
      mimeType: file.type || "image/jpeg",
      sizeBytes,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 800;
        let height = img.naturalHeight || img.height || 600;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const fallbackBytes = estimateDataUrlBytes(rawDataUrl);
          resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg", sizeBytes: fallbackBytes });
          return;
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const qualities = [0.78, 0.66, 0.54, 0.42];
        let bestDataUrl = "";
        let bestMime = "image/webp";
        let bestBytes = Infinity;

        for (const q of qualities) {
          let candidate = canvas.toDataURL("image/webp", q);
          let candidateMime = "image/webp";
          if (!candidate.startsWith("data:image/webp")) {
            candidate = canvas.toDataURL("image/jpeg", q);
            candidateMime = "image/jpeg";
          }
          const bytes = estimateDataUrlBytes(candidate);
          bestDataUrl = candidate;
          bestMime = candidateMime;
          bestBytes = bytes;
          if (bytes <= maxBytes) break;
        }

        resolve({
          dataUrl: bestDataUrl || rawDataUrl,
          mimeType: bestMime,
          sizeBytes: Number.isFinite(bestBytes) ? bestBytes : estimateDataUrlBytes(rawDataUrl),
        });
      } catch {
        const sizeBytes = estimateDataUrlBytes(rawDataUrl);
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg", sizeBytes });
      }
    };
    img.onerror = () => {
      const sizeBytes = estimateDataUrlBytes(rawDataUrl);
      resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg", sizeBytes });
    };
    img.src = rawDataUrl;
  });
}

export async function prepareAttachmentFile(file: File): Promise<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}> {
  const mime = (file.type || "").toLowerCase();
  const isImage = mime.startsWith("image/") || /\.(jpe?g|png|webp|heic|bmp)$/i.test(file.name);
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(file.name);

  if (!isImage && !isPdf) {
    throw new Error("Formato no soportado. Adjunta una foto (JPG, PNG, WebP) o documento PDF.");
  }

  if (isPdf) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error("El archivo PDF supera el límite de 1.5 MB para almacenamiento offline.");
    }
    const dataUrl = await readFileAsDataUrl(file);
    return {
      fileName: file.name || "documento.pdf",
      mimeType: "application/pdf",
      sizeBytes: file.size || estimateDataUrlBytes(dataUrl),
      dataUrl,
    };
  }

  const compressed = await compressImageToDataUrl(file);
  const baseName = (file.name || "captura").replace(/\.[^.]+$/, "");
  const ext = compressed.mimeType === "image/webp" ? "webp" : "jpg";
  return {
    fileName: `${baseName}.${ext}`,
    mimeType: compressed.mimeType,
    sizeBytes: compressed.sizeBytes,
    dataUrl: compressed.dataUrl,
  };
}

function parseColombianCurrencyNumber(raw: string): number | undefined {
  const cleaned = raw.trim().replace(/[$€\s]/g, "");
  if (!cleaned) return undefined;

  // Ej: 1.480.000 o 95.000,00 o 95,000
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    const normalized = cleaned.replace(/,/g, "");
    const num = Number(normalized);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }
  const plain = Number(cleaned.replace(/,/g, "."));
  return Number.isFinite(plain) && plain > 0 ? plain : undefined;
}

function extractIsoDate(text: string): string | undefined {
  const isoMatch = text.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const latamMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](20\d{2})\b/);
  if (latamMatch) {
    const day = latamMatch[1].padStart(2, "0");
    const month = latamMatch[2].padStart(2, "0");
    return `${latamMatch[3]}-${month}-${day}`;
  }
  return undefined;
}

/**
 * Analizador determinístico de documentos agropecuarios colombianos:
 * 1. factura_compra (DIAN / concentrado en bultos de 40 kg / insumos)
 * 2. etiqueta_ica (Reg. ICA, lote, laboratorio, vencimiento, días de retiro, cadena de frío 2-8°C)
 * 3. comprobante_pago (Nequi, Daviplata, Bancolombia / transferencia, referencia, valor)
 * 4. rut_contacto (RUT DIAN / Cédula, NIT, razón social, teléfono, correo, municipio)
 */
export function parseColombianAgroDocument(
  mode: OcrExtractionMode,
  rawText: string,
  fileName = "",
): OcrExtractedPayload {
  const combined = `${rawText || ""}\n${fileName || ""}`.trim();
  const lower = combined.toLowerCase();

  if (mode === "factura_compra") {
    const nitMatch = combined.match(/\b(?:NIT|N\.I\.T\.?)[:\s#]*([0-9]{6,12}(?:-[0-9])?)/i);
    const ccMatch = combined.match(/\b(?:CC|C\.C\.?|CEDULA)[:\s#]*([0-9]{6,12})/i);
    const invoiceMatch =
      combined.match(/\b(?:FACTURA(?:\s+ELECTR[OÓ]NICA)?(?:\s+DE\s+VENTA)?|SOPORTE|FV|FE|FAC|N[°ºo])\s*[:#-]?\s*([A-Z]{0,5}[- ]?\d{2,10})\b/i) ||
      combined.match(/\b([A-Z]{2,4}-\d{3,8})\b/);

    const supplierMatch =
      combined.match(/(?:PROVEEDOR|EMISOR|RAZ[OÓ]N\s+SOCIAL|VENDEDOR|ALMAC[EÉ]N|AGROPECUARIA)\s*[:.-]?\s*([^\n\r,;]{3,65})/i) ||
      combined.match(/\b((?:AGRO|CONCENTRADOS|ITALCOL|SOLLA| CONTEGRAL|PURINA|PRONACA|FINCA|VETERINARIA|INSUMOS|DISTRIBUIDORA)[^\n\r,;]{2,50})/i);

    const bultosMatch =
      combined.match(/(\d+(?:[.,]\d+)?)\s*(?:BULTOS?|SACOS?|COSTALES?)(?:\s*(?:DE|X|×)?\s*(\d{2})\s*KG)?/i) ||
      combined.match(/BULTOS?\s*(?:X|DE)?\s*(\d{2})\s*KG\s*[:x×-]?\s*(\d+)/i);

    let presentationsCount: number | undefined;
    let bagWeightKg = 40;
    if (bultosMatch) {
      if (/^BULTOS?/i.test(bultosMatch[0]) && bultosMatch[2]) {
        bagWeightKg = Number(bultosMatch[1]) || 40;
        presentationsCount = Number(bultosMatch[2].replace(",", "."));
      } else {
        presentationsCount = Number(bultosMatch[1].replace(",", "."));
        if (bultosMatch[2]) bagWeightKg = Number(bultosMatch[2]) || 40;
      }
    }

    const totalMatch =
      combined.match(/(?:TOTAL(?:\s+A\s+PAGAR|\s+FACTURA|\s+NETO)?|VALOR\s+TOTAL|MONTO\s+TOTAL|IMPORTE)\s*[:$]?\s*\$?\s*([0-9][0-9.,]{2,15})/i) ||
      combined.match(/\$\s*([0-9]{1,3}(?:[.,][0-9]{3})+)/);

    const unitPriceMatch =
      combined.match(/(?:PRECIO\s+UNITARIO|VALOR\s+UNITARIO|V\/U|PRECIO\s+X\s+BULTO|VALOR\s+BULTO|UNITARIO)\s*[:$]?\s*\$?\s*([0-9][0-9.,]{2,14})/i);

    let totalAmount = totalMatch ? parseColombianCurrencyNumber(totalMatch[1]) : undefined;
    let unitPrice = unitPriceMatch ? parseColombianCurrencyNumber(unitPriceMatch[1]) : undefined;

    if (!totalAmount && presentationsCount && unitPrice) {
      totalAmount = Math.round(presentationsCount * unitPrice);
    } else if (!unitPrice && presentationsCount && totalAmount && presentationsCount > 0) {
      unitPrice = Math.round(totalAmount / presentationsCount);
    }

    let category = "Compra de insumos";
    if (/(ponedora|engorde|iniciaci[oó]n|levante|concentrado|alimento|ma[ií]z|bulto|italcol|solla|contegral|purina)/i.test(lower)) {
      category = "Compra de alimento";
    } else if (/(vacuna|newcastle|gumboro|bronquitis|ivermectina|antibi[oó]tico|desparasit|sanitario|ica\b)/i.test(lower)) {
      category = "Control sanitario";
    } else if (/(energ[ií]a|acueducto|agua|luz|servicio|gas|internet)/i.test(lower)) {
      category = "Servicios (agua/luz)";
    } else if (/(mantenimiento|repuesto|malla|teja|bomba|arreglo|ferreter[ií]a)/i.test(lower)) {
      category = "Mantenimiento";
    } else if (/(transporte|flete|acarreo|peaje|combustible)/i.test(lower)) {
      category = "Transporte";
    }

    const productMatch =
      combined.match(/(?:PRODUCTO|CONCEPTO|DESCRIPCI[OÓ]N|ITEM|ART[IÍ]CULO)\s*[:.-]?\s*([^\n\r]{3,70})/i) ||
      combined.match(/\b((?:CONCENTRADO|PONEDORA|ENGORDE|INICIADOR|MA[IÍ]Z|VACUNA|VIRUTA| CAL )[^\n\r,;]{2,55})/i);

    const isFeed = category === "Compra de alimento" || Boolean(bultosMatch);
    const presentation = isFeed
      ? bagWeightKg === 25
        ? "Bulto 25kg"
        : bagWeightKg === 50
          ? "Bulto 50kg"
          : "Bulto 40kg"
      : "Unidad";
    const factor = isFeed ? (bagWeightKg === 25 ? 25 : bagWeightKg === 50 ? 50 : 40) : 1;
    const unit = isFeed ? "kg" : "unidades";

    const supplierName = supplierMatch?.[1]?.trim();
    const invoiceNumber = invoiceMatch?.[1]?.trim();
    const productName = productMatch?.[1]?.trim() || (isFeed ? `Concentrado (${presentation})` : undefined);
    const date = extractIsoDate(combined);

    const parts: string[] = [];
    if (invoiceNumber) parts.push(`Factura ${invoiceNumber}`);
    if (supplierName) parts.push(supplierName);
    if (presentationsCount && isFeed) parts.push(`${presentationsCount} × ${presentation} (${presentationsCount * factor} kg)`);
    if (totalAmount) parts.push(`$${totalAmount.toLocaleString("es-CO")}`);

    return {
      mode: "factura_compra",
      supplierName,
      documentType: nitMatch ? "NIT" : ccMatch ? "CC" : undefined,
      documentNumber: nitMatch?.[1] || ccMatch?.[1],
      invoiceNumber,
      date,
      category,
      productName,
      presentation,
      presentationsCount,
      factor,
      unit,
      unitPrice,
      totalAmount,
      notes: invoiceNumber ? `Soporte factura DIAN: ${invoiceNumber}` : undefined,
      summary: parts.length > 0 ? parts.join(" · ") : "Factura procesada (completa los campos faltantes).",
    };
  }

  if (mode === "etiqueta_ica") {
    const icaMatch =
      combined.match(/(?:REG(?:ISTRO)?\.?\s*ICA|ICA\s*N[°ºo.]?)\s*[:#-]?\s*([A-Z0-9-]{3,20})/i);
    const lotMatch =
      combined.match(/(?:LOTE|LOT|BATCH|L\.)\s*[:#-]?\s*([A-Z0-9-]{3,25})/i);
    const labMatch =
      combined.match(/(?:LABORATORIO|LAB\.?|FABRICANTE|TITULAR)\s*[:.-]?\s*([^\n\r,;]{3,45})/i) ||
      combined.match(/\b(MSD|BOEHRINGER|ZOETIS|CEVA|HIPRA|VECOL|VETERQUIMICA|BIOVET|CARVAL|INVET|AUROFARMA)\b/i);

    const withdrawalMatch =
      combined.match(/(?:TIEMPO\s+DE\s+RETIRO|PERIODO\s+DE\s+RETIRO|RETIRO)\s*[:.-]?\s*(\d{1,3})\s*D[IÍ]AS?/i) ||
      combined.match(/(\d{1,3})\s*D[IÍ]AS?\s+DE\s+RETIRO/i) ||
      (/sin\s+tiempo\s+de\s+retiro|retiro\s*:\s*0\s*d[ií]as/i.test(lower) ? ["0", "0"] : null);

    const expirySection = combined.match(/(?:VENC(?:IMIENTO|\.)?|EXP(?:IRA)?|CAD(?:UCIDAD)?|VENCE)\s*[:.-]?\s*([^\n\r]{4,20})/i);
    let vaccineExpiryDate = expirySection ? extractIsoDate(expirySection[1]) : undefined;
    if (!vaccineExpiryDate && expirySection) {
      const my = expirySection[1].match(/\b(0?[1-9]|1[0-2])[/-](20\d{2})\b/);
      if (my) {
        vaccineExpiryDate = `${my[2]}-${my[1].padStart(2, "0")}-28`;
      }
    }
    if (!vaccineExpiryDate) {
      vaccineExpiryDate = extractIsoDate(combined);
    }

    const tempMatch =
      combined.match(/([0-9]{1,2}\s*(?:°\s*C|a|-|–)\s*[0-9]{1,2}\s*°?\s*C)/i) ||
      combined.match(/([0-9]{1,2}(?:[.,][0-9])?\s*°\s*C)/i);
    const coldChainTempC = tempMatch ? tempMatch[1].replace(/\s+/g, "") : "2-8°C";

    let administrationRoute = "agua_bebida";
    if (/(ocular|nasal|gota)/i.test(lower)) administrationRoute = "ocular_nasal";
    else if (/(punz[oó]n|alar|membrana)/i.test(lower)) administrationRoute = "punzon_alar";
    else if (/(intramuscular|i\.m\.)/i.test(lower)) administrationRoute = "intramuscular";
    else if (/(subcut[aá]nea|s\.c\.)/i.test(lower)) administrationRoute = "subcutanea";
    else if (/(aspersi[oó]n|spray|nebulizaci[oó]n)/i.test(lower)) administrationRoute = "aspersor";

    let eventType: EtiquetaIcaOcaEventType = "vacunacion";
    if (/(ivermectina|fenbendazol|albendazol|levamisol|piperazina|desparasit|antihelm[ií]ntico)/i.test(lower)) {
      eventType = "desparasitacion";
    } else if (/(enrofloxacina|tilosina|oxitetraciclina|amoxicilina|sulfa|antibi[oó]tico|tratamiento)/i.test(lower)) {
      eventType = "tratamiento";
    } else if (/(vitamina|electrolito|amino[aá]cido|complejo\s+b)/i.test(lower)) {
      eventType = "vitaminas";
    }

    const productMatch =
      combined.match(/(?:PRODUCTO|VACUNA|MEDICAMENTO|NOMBRE\s+COMERCIAL)\s*[:.-]?\s*([^\n\r,;]{3,55})/i) ||
      combined.match(/\b((?:NEWCASTLE|GUMBORO|BRONQUITIS|MAREK|VIRUELA|CORIZA|SALMONELLA|IVERMECTINA|ENROFLOXACINA|TILOSINA|FENBENDAZOL)[^\n\r,;]{0,35})/i);

    const activeMatch =
      combined.match(/(?:PRINCIPIO\s+ACTIVO|COMPOSICI[OÓ]N|CEPA)\s*[:.-]?\s*([^\n\r,;]{3,50})/i);

    const withdrawalDays = withdrawalMatch ? Math.max(0, Number(withdrawalMatch[1])) : eventType === "vacunacion" ? 0 : undefined;
    const product = productMatch?.[1]?.trim();
    const icaRegistration = icaMatch?.[1]?.trim();
    const vaccineLot = lotMatch?.[1]?.trim();
    const vaccineLab = labMatch?.[1]?.trim();

    const parts: string[] = [];
    if (product) parts.push(product);
    if (icaRegistration) parts.push(`Reg. ICA ${icaRegistration}`);
    if (vaccineLot) parts.push(`Lote ${vaccineLot}`);
    if (withdrawalDays !== undefined) parts.push(`Retiro: ${withdrawalDays}d`);

    return {
      mode: "etiqueta_ica",
      product,
      activeIngredient: activeMatch?.[1]?.trim(),
      icaRegistration,
      vaccineLab,
      vaccineLot,
      vaccineExpiryDate,
      withdrawalDays,
      coldChainTempC,
      administrationRoute,
      eventType,
      summary: parts.length > 0 ? parts.join(" · ") : "Etiqueta ICA procesada.",
    };
  }

  if (mode === "comprobante_pago") {
    let method: ComprobantePagoOcrData["method"] = "transferencia";
    if (/nequi/i.test(lower)) method = "nequi";
    else if (/daviplata/i.test(lower)) method = "daviplata";
    else if (/efectivo|caja|recibo\s+de\s+caja/i.test(lower)) method = "efectivo";
    else if (/bancolombia|davivienda|bbva|banco|agrario|pse|transfiya|transferencia/i.test(lower)) method = "transferencia";

    const refMatch =
      combined.match(/(?:REFERENCIA|COMPROBANTE|APROBACI[OÓ]N|TRANSACCI[OÓ]N|CUS|N[°ºo]\s*DE\s*PAGO|REF\.?)\s*[:#-]?\s*([A-Z0-9-]{4,25})/i) ||
      combined.match(/\b([M0-9][0-9]{6,14})\b/);

    const amountMatch =
      combined.match(/(?:VALOR|MONTO|TOTAL|CUANTO|ENVIADO|PAGADO)\s*[:$]?\s*\$?\s*([0-9][0-9.,]{2,15})/i) ||
      combined.match(/\$\s*([0-9]{1,3}(?:[.,][0-9]{3})+)/);

    const counterpartyMatch =
      combined.match(/(?:PARA|DESTINATARIO|BENEFICIARIO|A\s+FAVOR\s+DE|RECIBE)\s*[:.-]?\s*([^\n\r,;]{3,55})/i);

    const amount = amountMatch ? parseColombianCurrencyNumber(amountMatch[1]) : undefined;
    const reference = refMatch?.[1]?.trim();
    const date = extractIsoDate(combined);
    const counterparty = counterpartyMatch?.[1]?.trim();

    const parts: string[] = [];
    parts.push(method.toUpperCase());
    if (amount) parts.push(`$${amount.toLocaleString("es-CO")}`);
    if (reference) parts.push(`Ref. ${reference}`);

    return {
      mode: "comprobante_pago",
      amount,
      date,
      method,
      reference,
      counterparty,
      summary: parts.join(" · "),
    };
  }

  // mode === "rut_contacto"
  const nitMatch = combined.match(/\b(?:NIT|N\.I\.T\.?|5\.\s*N[UÚ]MERO\s+DE\s+IDENTIFICACI[OÓ]N\s+TRIBUTARIA)[:\s#-]*([0-9]{6,12}(?:-[0-9])?)/i);
  const ccMatch = combined.match(/\b(?:CC|C\.C\.?|C[EÉ]DULA(?:\s+DE\s+CIUDADAN[IÍ]A)?)[:\s#-]*([0-9]{6,12})/i);
  const emailMatch = combined.match(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i);
  const phoneMatch = combined.match(/\b((?:\+?57\s*)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4})\b/);
  const nameMatch =
    combined.match(
      /(?:RAZ[OÓ]N\s+SOCIAL|NOMBRE\s+COMERCIAL|NOMBRE\s+COMPLETO|CLIENTE|PROVEEDOR|TITULAR)\s*[:.-]?\s*([^\n\r,;]{3,70}?)(?=\s+(?:NIT|N\.I\.T|CC|C\.C|C[EÉ]DULA|TEL[EÉ]FONO|CELULAR|WHATSAPP|CORREO|EMAIL|MUNICIPIO|CIUDAD|DEPARTAMENTO|DPTO|DIRECCI[OÓ]N)\b|[\n\r,;]|$)/i,
    );
  const cityMatch =
    combined.match(
      /(?:MUNICIPIO|CIUDAD)\s*[:.-]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,35}?)(?=\s+(?:DEPARTAMENTO|DPTO|DIRECCI[OÓ]N|VEREDA|TEL[EÉ]FONO|CORREO|NIT|CC)\b|[\n\r,;]|$)/i,
    );
  const deptMatch =
    combined.match(
      /(?:DEPARTAMENTO|DPTO\.?)\s*[:.-]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,35}?)(?=\s+(?:MUNICIPIO|CIUDAD|DIRECCI[OÓ]N|VEREDA|TEL[EÉ]FONO|CORREO|NIT|CC)\b|[\n\r,;]|$)/i,
    );
  const addressMatch =
    combined.match(
      /(?:DIRECCI[OÓ]N(?:\s+PRINCIPAL)?|UBICACI[OÓ]N|VEREDA)\s*[:.-]?\s*([^\n\r]{4,70}?)(?=\s+(?:MUNICIPIO|CIUDAD|DEPARTAMENTO|DPTO|TEL[EÉ]FONO|CORREO|NIT|CC)\b|[\n\r]|$)/i,
    );

  const name = nameMatch?.[1]?.trim();
  const isJuridica = Boolean(nitMatch) || /\b(S\.?A\.?S\.?|LTDA|S\.?A\.?|COOPERATIVA|ASOCIACI[OÓ]N|EMPRESA|AGROPECUARIA)\b/i.test(combined);
  const documentType = nitMatch ? "NIT" : "CC";
  const documentNumber = nitMatch?.[1] || ccMatch?.[1];
  const phone = phoneMatch?.[1]?.replace(/[^\d+]/g, "");

  const parts: string[] = [];
  if (name) parts.push(name);
  if (documentNumber) parts.push(`${documentType} ${documentNumber}`);
  if (cityMatch?.[1]) parts.push(cityMatch[1].trim());

  return {
    mode: "rut_contacto",
    name,
    personType: isJuridica ? "juridica" : "natural",
    documentType,
    documentNumber,
    phone,
    whatsapp: phone,
    email: emailMatch?.[1]?.toLowerCase(),
    address: addressMatch?.[1]?.trim(),
    city: cityMatch?.[1]?.trim(),
    department: deptMatch?.[1]?.trim(),
    summary: parts.length > 0 ? parts.join(" · ") : "Documento RUT / identificación procesado.",
  };
}

type EtiquetaIcaOcaEventType = "vacunacion" | "desparasitacion" | "tratamiento" | "vitaminas";

export async function bindDraftAttachments(
  draftEntityId: string | null | undefined,
  finalEntityId: string | null | undefined,
  entityType: AttachmentEntityType,
): Promise<void> {
  if (!draftEntityId || !finalEntityId || draftEntityId === finalEntityId) return;
  if (finalEntityId.startsWith("offline-") || finalEntityId.startsWith("mut_")) return;
  try {
    await apiFetch("/api/adjuntos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftEntityId,
        finalEntityId,
        entityType,
      }),
    });
  } catch {
    // En modo offline la cola de sincronización reenviará las mutaciones pendientes
  }
}


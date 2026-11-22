import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { createHash } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getCurrentFarmId } from "@/db/tenant-context";
import { getVisionConfig } from "@/lib/agent/config";
import { getFarmSubscriptionStatus } from "@/lib/subscription";
import { finishGinaUsage, getGinaQuotaSnapshot, reserveGinaUsage } from "@/lib/pricing/gina-quota";
import {
  OCR_MODES,
  parseColombianAgroDocument,
  type OcrExtractedPayload,
  type OcrExtractionMode,
} from "@/lib/attachments-shared";
import { resolveExpenseClassification } from "@/lib/finance/standard-expense-catalog";

const MODE_PROMPTS: Record<OcrExtractionMode, string> = {
  factura_compra:
    "Extrae de esta factura agropecuaria colombiana un JSON estricto con las llaves: supplierName, documentType ('NIT'|'CC'), documentNumber, invoiceNumber, date (YYYY-MM-DD), category ('Compra de alimento' o Familia estándar de egresos ej. '01 Sanidad preventiva'|'02 Diagnóstico y tratamientos'|'03 Bioseguridad'|'04 Cama y limpieza'|'05 Agua y suministro'|'06 Energía y clima'|'07 Equipos e infraestructura'|'08 Clasificación y empaque'|'15 Transporte y logística'|'22 Activos / inversión'), expenseCatalogId (opcional código 'CST-001'..'CST-303'), expenseFamily (opcional), productName, presentation ('Bulto 40kg'|'Bulto 50kg'|'Bulto 25kg'|'Unidad'), presentationsCount (número de bultos o unidades), unitPrice (número en COP), totalAmount (número en COP), rawText (transcripción resumida).",
  etiqueta_ica:
    "Extrae de esta etiqueta de vacuna/medicamento veterinario ICA un JSON estricto con las llaves: product, activeIngredient, icaRegistration (ej: '4589-DB'), vaccineLab, vaccineLot, vaccineExpiryDate (YYYY-MM-DD), withdrawalDays (número entero de días de retiro), coldChainTempC (ej: '2-8°C'), administrationRoute ('agua_bebida'|'ocular_nasal'|'punzon_alar'|'intramuscular'|'subcutanea'|'aspersor'), eventType ('vacunacion'|'desparasitacion'|'tratamiento'|'vitaminas'), rawText.",
  comprobante_pago:
    "Extrae de este comprobante de pago (Nequi, Daviplata, Bancolombia o recibo) un JSON estricto con las llaves: amount (número en COP), date (YYYY-MM-DD), method ('nequi'|'daviplata'|'transferencia'|'efectivo'), reference, counterparty, rawText.",
  rut_contacto:
    "Extrae de este RUT DIAN o documento de identificación colombiano un JSON estricto con las llaves: name, personType ('natural'|'juridica'), documentType ('NIT'|'CC'), documentNumber, phone, email, address, city, department, rawText.",
};

async function callMultimodalVision(
  mode: OcrExtractionMode,
  dataUrl: string,
  textHint: string,
): Promise<{ parsedJson?: Record<string, unknown>; rawText?: string } | null> {
  const config = getVisionConfig();
  if (!config || !dataUrl.startsWith("data:image/")) return null;

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Eres un extractor OCR experto en documentos agropecuarios de Colombia (facturas DIAN, bultos de concentrado de 40 kg, etiquetas con Reg. ICA y días de retiro, comprobantes Nequi/Bancolombia y RUT). Responde únicamente con un objeto JSON válido.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${MODE_PROMPTS[mode]}${textHint ? `\nTexto adicional o nota del operario: ${textHint}` : ""}`,
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return null;
    const cleanedJson = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const parsedJson = JSON.parse(cleanedJson) as Record<string, unknown>;
    return {
      parsedJson,
      rawText: typeof parsedJson.rawText === "string" ? parsedJson.rawText : content,
    };
  } catch {
    return null;
  }
}

function mergeVisionWithDeterministic(
  base: OcrExtractedPayload,
  visionJson?: Record<string, unknown>,
): OcrExtractedPayload {
  if (!visionJson) return base;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(visionJson)) {
    if (key === "mode" || key === "rawText" || value === null || value === undefined || value === "") continue;
    if (merged[key] === undefined || merged[key] === "" || merged[key] === null) {
      merged[key] = value;
    }
  }
  return merged as unknown as OcrExtractedPayload;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const rawMode = typeof body.mode === "string" ? body.mode.trim() : "";
  const wantsAutoMode = !rawMode || rawMode === "auto";
  if (!wantsAutoMode && !(OCR_MODES as readonly string[]).includes(rawMode)) {
    return NextResponse.json(
      { error: "Modo OCR inválido. Usa auto, factura_compra, etiqueta_ica, comprobante_pago o rut_contacto." },
      { status: 400 },
    );
  }
  let mode = (wantsAutoMode ? "factura_compra" : rawMode) as OcrExtractionMode;

  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const textHint = typeof body.textHint === "string" ? body.textHint.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";

  if (!dataUrl && !textHint && !fileName) {
    return NextResponse.json(
      { error: "Debes enviar una imagen (dataUrl) o el texto de la etiqueta/factura (textHint)." },
      { status: 400 },
    );
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const farmId = (user as { farmId?: string | null }).farmId || getCurrentFarmId();
  const subscription = await getFarmSubscriptionStatus(farmId);
  let reservation: Awaited<ReturnType<typeof reserveGinaUsage>> | null = null;
  if (dataUrl) {
    reservation = await reserveGinaUsage({
      farmId,
      userId: user.id,
      entitlements: subscription.entitlements,
      modality: "attachment",
      requestId: req.headers.get("x-gina-request-id"),
      requestFingerprint: createHash("sha256").update(dataUrl).digest("hex"),
    });
    if (!reservation.allowed) {
      const status = reservation.code === "GINA_QUOTA_EXCEEDED" ? 429 : 409;
      return NextResponse.json({ error: reservation.error, code: reservation.code, quota: reservation.quota }, { status });
    }
  }

  try {
  const [{ classifyOcrDocumentWithJev }, { ICA_VETERINARY_VADEMECUM }] = await Promise.all([
    import("@/lib/agent/jev-capabilities"),
    import("@/lib/external-sources/wave2-standards-sanitary-ica"),
  ]);

  if (wantsAutoMode) {
    const preDetect = await classifyOcrDocumentWithJev({
      requestedMode: "auto",
      text: textHint,
      fileName,
    });
    mode = preDetect.detectedMode;
  }

  const visionResult = dataUrl ? await callMultimodalVision(mode, dataUrl, textHint) : null;
  const combinedText = [textHint, visionResult?.rawText || ""].filter(Boolean).join("\n");
  const jevSuggestions = await classifyOcrDocumentWithJev({
    requestedMode: wantsAutoMode ? "auto" : mode,
    text: combinedText,
    fileName,
    vademecumItems: ICA_VETERINARY_VADEMECUM,
  });
  if (wantsAutoMode) {
    mode = jevSuggestions.detectedMode;
  }

  const deterministic = parseColombianAgroDocument(mode, combinedText, fileName);
  const extracted = mergeVisionWithDeterministic(deterministic, visionResult?.parsedJson);

  if (mode === "factura_compra" && extracted && typeof extracted === "object") {
    const rec = extracted as unknown as Record<string, unknown>;
    if (!rec.suggestedCategory && jevSuggestions.suggestedExpenseCategory) {
      rec.suggestedCategory = jevSuggestions.suggestedExpenseCategory;
    }
    if (!rec.suggestedSpecies && jevSuggestions.suggestedSpecies) {
      rec.suggestedSpecies = jevSuggestions.suggestedSpecies;
    }
    const resolved = resolveExpenseClassification({
      type: "egreso",
      category: typeof rec.category === "string" ? rec.category : jevSuggestions.suggestedExpenseCategory,
      expenseCatalogId: typeof rec.expenseCatalogId === "string" ? rec.expenseCatalogId : null,
      expenseFamily: typeof rec.expenseFamily === "string" ? rec.expenseFamily : null,
      description: [rec.productName, combinedText].filter(Boolean).join(" ").slice(0, 200),
    });
    rec.expenseCatalogId = rec.expenseCatalogId || resolved.expenseCatalogId;
    rec.expenseFamily = rec.expenseFamily || resolved.expenseFamily;
    rec.expenseConcept = rec.expenseConcept || resolved.expenseConcept;
    rec.expenseTreatment = rec.expenseTreatment || resolved.expenseTreatment;
    rec.expenseDriver = rec.expenseDriver || resolved.expenseDriver;
  } else if (mode === "etiqueta_ica" && jevSuggestions.matchedIcaItem && extracted && typeof extracted === "object") {
    const rec = extracted as unknown as Record<string, unknown>;
    if (!rec.productName) rec.productName = jevSuggestions.matchedIcaItem.commercialName;
    if (!rec.icaRegistration) rec.icaRegistration = jevSuggestions.matchedIcaItem.icaRegistration;
    if (rec.withdrawalDays === undefined || rec.withdrawalDays === null) {
      rec.withdrawalDays = Math.max(
        jevSuggestions.matchedIcaItem.withdrawalDaysEggs,
        jevSuggestions.matchedIcaItem.withdrawalDaysMeat,
      );
    }
  }

  if (reservation?.allowed) await finishGinaUsage(reservation.eventId, true);
  const quota = reservation?.allowed
    ? await getGinaQuotaSnapshot({ farmId, userId: user.id, entitlements: subscription.entitlements })
    : null;
  return NextResponse.json({
    ok: true,
    mode,
    provider: visionResult ? "vision+deterministic" : "deterministic",
    extractedText: combinedText || fileName || null,
    extracted,
    jevSuggestions,
    ...(quota ? { ginaQuota: quota } : {}),
  });
  } catch (error) {
    if (reservation?.allowed) await finishGinaUsage(reservation.eventId, false).catch(() => undefined);
    throw error;
  }
});


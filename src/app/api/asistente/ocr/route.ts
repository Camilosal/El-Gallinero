import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { getVisionConfig } from "@/lib/agent/config";
import {
  OCR_MODES,
  parseColombianAgroDocument,
  type OcrExtractedPayload,
  type OcrExtractionMode,
} from "@/lib/attachments-shared";

const MODE_PROMPTS: Record<OcrExtractionMode, string> = {
  factura_compra:
    "Extrae de esta factura agropecuaria colombiana un JSON estricto con las llaves: supplierName, documentType ('NIT'|'CC'), documentNumber, invoiceNumber, date (YYYY-MM-DD), category ('Compra de alimento'|'Control sanitario'|'Compra de insumos'|'Mantenimiento'|'Servicios (agua/luz)'|'Transporte'), productName, presentation ('Bulto 40kg'|'Bulto 50kg'|'Bulto 25kg'|'Unidad'), presentationsCount (número de bultos o unidades), unitPrice (número en COP), totalAmount (número en COP), rawText (transcripción resumida).",
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

  const mode = (typeof body.mode === "string" ? body.mode.trim() : "") as OcrExtractionMode;
  if (!(OCR_MODES as readonly string[]).includes(mode)) {
    return NextResponse.json(
      { error: "Modo OCR inválido. Usa factura_compra, etiqueta_ica, comprobante_pago o rut_contacto." },
      { status: 400 },
    );
  }

  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const textHint = typeof body.textHint === "string" ? body.textHint.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";

  if (!dataUrl && !textHint && !fileName) {
    return NextResponse.json(
      { error: "Debes enviar una imagen (dataUrl) o el texto de la etiqueta/factura (textHint)." },
      { status: 400 },
    );
  }

  const visionResult = dataUrl ? await callMultimodalVision(mode, dataUrl, textHint) : null;
  const combinedText = [textHint, visionResult?.rawText || ""].filter(Boolean).join("\n");
  const deterministic = parseColombianAgroDocument(mode, combinedText, fileName);
  const extracted = mergeVisionWithDeterministic(deterministic, visionResult?.parsedJson);

  return NextResponse.json({
    ok: true,
    mode,
    provider: visionResult ? "vision+deterministic" : "deterministic",
    extractedText: combinedText || fileName || null,
    extracted,
  });
});


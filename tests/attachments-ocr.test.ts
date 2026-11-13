import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, farmLocations, healthControl } from "@/db/schema";
import {
  DELETE as deleteAttachment,
  GET as getAttachments,
  POST as postAttachment,
  PUT as putAttachment,
} from "@/app/api/adjuntos/route";
import { POST as postOcr } from "@/app/api/asistente/ocr/route";
import { POST as postHealthControl } from "@/app/api/sanidad/control/route";

const SAMPLE_WEBP_DATA_URL =
  "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Fase 1 + 2: Adjuntos Polimórficos Offline-First y Extracción OCR", () => {
  it("crea, consulta (incluyendo metaOnly), re-vincula borradores y elimina adjuntos de forma idempotente", async () => {
    const customId = "11111111-2222-4333-8444-555555555555";
    const draftEntityId = "draft_test_tx_001";
    const finalEntityId = "22222222-3333-4444-8555-666666666666";

    try {
      // 1. POST inicial en borrador
      const createRes = await postAttachment(
        jsonRequest("http://localhost:3000/api/adjuntos", "POST", {
          id: customId,
          entityType: "transaction",
          entityId: draftEntityId,
          category: "factura_dian",
          fileName: "factura_italcol.webp",
          mimeType: "image/webp",
          sizeBytes: 18400,
          dataUrl: SAMPLE_WEBP_DATA_URL,
          notes: "Factura física bultos ponedora",
        }),
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.id).toBe(customId);
      expect(created.entityId).toBe(draftEntityId);
      expect(created.category).toBe("factura_dian");

      // 2. Reintento idempotente (simulando reenvío de cola offline)
      const retryRes = await postAttachment(
        jsonRequest("http://localhost:3000/api/adjuntos", "POST", {
          id: customId,
          entityType: "transaction",
          entityId: draftEntityId,
          category: "factura_dian",
          fileName: "factura_italcol.webp",
          mimeType: "image/webp",
          sizeBytes: 18400,
          dataUrl: SAMPLE_WEBP_DATA_URL,
          notes: "Factura sincronizada desde móvil",
        }),
      );
      expect(retryRes.status).toBe(200);
      const retried = await retryRes.json();
      expect(retried.notes).toBe("Factura sincronizada desde móvil");

      // 3. Re-vincular borrador (draftEntityId -> finalEntityId)
      const rebindRes = await putAttachment(
        jsonRequest("http://localhost:3000/api/adjuntos", "PUT", {
          draftEntityId,
          finalEntityId,
          entityType: "transaction",
        }),
      );
      expect(rebindRes.status).toBe(200);
      const rebindData = await rebindRes.json();
      expect(rebindData.ok).toBe(true);
      expect(rebindData.reboundCount).toBe(1);

      // 4. GET con metaOnly=1 (sin dataUrl pesado para espejo offline)
      const metaRes = await getAttachments(
        jsonRequest(
          `http://localhost:3000/api/adjuntos?entityType=transaction&entityId=${finalEntityId}&metaOnly=1`,
          "GET",
        ),
      );
      expect(metaRes.status).toBe(200);
      const metaRows = await metaRes.json();
      expect(metaRows).toHaveLength(1);
      expect(metaRows[0].id).toBe(customId);
      expect(metaRows[0].dataUrl).toBeUndefined();

      // 5. DELETE
      const delRes = await deleteAttachment(
        jsonRequest(`http://localhost:3000/api/adjuntos?id=${customId}`, "DELETE"),
      );
      expect(delRes.status).toBe(200);
    } finally {
      await db.delete(attachments).where(eq(attachments.id, customId));
    }
  });

  it("extrae datos estructurados en los 4 modos OCR agropecuarios colombianos", async () => {
    // 1. Factura de compra con bultos de 40 kg
    const facturaRes = await postOcr(
      jsonRequest("http://localhost:3000/api/asistente/ocr", "POST", {
        mode: "factura_compra",
        textHint:
          "FACTURA ELECTRÓNICA DE VENTA FE-1045 Proveedor: Concentrados Italcol S.A. NIT: 800123456-1 Fecha: 2026-03-10 Producto: Concentrado Ponedora Fase 1 Cantidad: 12 Bultos de 40kg Precio unitario: $94.000 Total a pagar: $1.128.000",
      }),
    );
    expect(facturaRes.status).toBe(200);
    const facturaData = await facturaRes.json();
    expect(facturaData.ok).toBe(true);
    expect(facturaData.extracted).toMatchObject({
      mode: "factura_compra",
      invoiceNumber: "FE-1045",
      documentType: "NIT",
      documentNumber: "800123456-1",
      date: "2026-03-10",
      category: "Compra de alimento",
      presentation: "Bulto 40kg",
      presentationsCount: 12,
      factor: 40,
      unitPrice: 94000,
      totalAmount: 1128000,
    });

    // 2. Etiqueta ICA con días de retiro y cadena de frío
    const icaRes = await postOcr(
      jsonRequest("http://localhost:3000/api/asistente/ocr", "POST", {
        mode: "etiqueta_ica",
        textHint:
          "Vacuna Newcastle B1 Cepa LaSota Laboratorio: MSD Salud Animal Reg. ICA: 4589-DB Lote: NK-2026A Vence: 2027-06-30 Tiempo de retiro: 21 días Conservar entre 2-8°C Vía ocular o nasal",
      }),
    );
    expect(icaRes.status).toBe(200);
    const icaData = await icaRes.json();
    expect(icaData.extracted).toMatchObject({
      mode: "etiqueta_ica",
      icaRegistration: "4589-DB",
      vaccineLot: "NK-2026A",
      vaccineExpiryDate: "2027-06-30",
      withdrawalDays: 21,
      coldChainTempC: "2-8°C",
      administrationRoute: "ocular_nasal",
      eventType: "vacunacion",
    });

    // 3. Comprobante de pago Nequi
    const pagoRes = await postOcr(
      jsonRequest("http://localhost:3000/api/asistente/ocr", "POST", {
        mode: "comprobante_pago",
        textHint:
          "¡Envío exitoso por Nequi! Valor enviado: $450.000 Fecha: 15/03/2026 Referencia: M94827162 Para: Agroinsumos del Oriente",
      }),
    );
    expect(pagoRes.status).toBe(200);
    const pagoData = await pagoRes.json();
    expect(pagoData.extracted).toMatchObject({
      mode: "comprobante_pago",
      method: "nequi",
      amount: 450000,
      date: "2026-03-15",
      reference: "M94827162",
      counterparty: "Agroinsumos del Oriente",
    });

    // 4. RUT / Contacto
    const rutRes = await postOcr(
      jsonRequest("http://localhost:3000/api/asistente/ocr", "POST", {
        mode: "rut_contacto",
        textHint:
          "Razón social: Agropecuaria El Rosal SAS NIT: 901456789-2 Teléfono: 312 456 7890 Correo: ventas@elrosal.co Municipio: Rionegro Departamento: Antioquia Dirección: Km 4 Vía Llanogrande",
      }),
    );
    expect(rutRes.status).toBe(200);
    const rutData = await rutRes.json();
    expect(rutData.extracted).toMatchObject({
      mode: "rut_contacto",
      name: "Agropecuaria El Rosal SAS",
      personType: "juridica",
      documentType: "NIT",
      documentNumber: "901456789-2",
      phone: "3124567890",
      email: "ventas@elrosal.co",
      city: "Rionegro",
      department: "Antioquia",
    });
  });

  it("persiste trazabilidad ICA y calcula automáticamente withdrawalUntilDate en /api/sanidad/control", async () => {
    const [loc] = await db
      .insert(farmLocations)
      .values({
        code: `LOC-ICA-${Date.now()}`,
        name: "Galpón Bioseguro ICA Test",
        type: "galpon",
        status: "activa",
      })
      .returning();

    let createdControlId: string | null = null;
    try {
      const res = await postHealthControl(
        jsonRequest("http://localhost:3000/api/sanidad/control", "POST", {
          date: "2026-03-01",
          locationId: loc.id,
          type: "tratamiento",
          description: "Tratamiento antimicrobiano con retiro ICA",
          affectedHens: "todas",
          product: "Enrofloxacina 10%",
          withdrawalDays: 14,
          vaccineLot: "ENR-9921",
          vaccineLab: "Vecol",
          vaccineExpiryDate: "2027-09-30",
          coldChainTempC: "4.5",
          administrationRoute: "agua_bebida",
          cost: "0",
        }),
      );
      expect(res.status).toBe(201);
      const created = await res.json();
      createdControlId = created.id;
      expect(created.withdrawalDays).toBe(14);
      expect(created.withdrawalUntilDate).toBe("2026-03-15");
      expect(created.vaccineLot).toBe("ENR-9921");
      expect(created.vaccineLab).toBe("Vecol");
      expect(created.administrationRoute).toBe("agua_bebida");
    } finally {
      if (createdControlId) {
        await db.delete(healthControl).where(eq(healthControl.id, createdControlId));
      }
      await db.delete(farmLocations).where(eq(farmLocations.id, loc.id));
    }
  });
});


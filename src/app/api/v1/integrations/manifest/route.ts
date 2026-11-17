import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { withIntegrationContext } from "@/lib/integrations/auth-guard";
import { ERP_PROFILES, INTEGRATION_SCOPES } from "@/lib/export/auth";
import { ERP_PROFILE_METADATA } from "@/lib/integrations/profiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await withIntegrationContext(req, [], async (ctx) => {
      const [farm] = await db
        .select({
          id: farms.id,
          name: farms.name,
          slug: farms.slug,
        })
        .from(farms)
        .where(eq(farms.id, ctx.farmId))
        .limit(1);

      return NextResponse.json(
        {
          object: "integration_manifest",
          apiVersion: "v1",
          farm: farm ?? { id: ctx.farmId, name: "Granja", slug: null },
          authVia: ctx.via,
          activeProfile: ctx.profile,
          supportedProfiles: ERP_PROFILES.map((id) => ERP_PROFILE_METADATA[id]),
          scopes: INTEGRATION_SCOPES,
          mapping: ctx.mapping,
          endpoints: [
            {
              id: "manifest",
              method: "GET",
              path: "/api/v1/integrations/manifest",
              requiredScope: null,
              description: "Metadatos del conector, perfiles ERP disponibles y mapeo PUC/impuestos.",
            },
            {
              id: "transactions",
              method: "GET",
              path: "/api/v1/integrations/transactions",
              requiredScope: "read:finance",
              queryParams: ["profile", "from", "to", "updated_since", "type", "limit", "cursor"],
              description: "Ingresos y gastos contables adaptados al perfil ERP.",
            },
            {
              id: "inventory",
              method: "GET",
              path: "/api/v1/integrations/inventory",
              requiredScope: "read:inventory",
              queryParams: ["profile", "kind", "updated_since", "limit", "cursor"],
              description: "Catálogo y saldos actuales de alimentos e insumos.",
            },
            {
              id: "inventory-movements",
              method: "GET",
              path: "/api/v1/integrations/inventory/movements",
              requiredScope: "read:inventory",
              queryParams: ["profile", "from", "to", "updated_since", "limit", "cursor"],
              description: "Entradas, compras, consumos y ajustes de inventario.",
            },
            {
              id: "contacts",
              method: "GET",
              path: "/api/v1/integrations/contacts",
              requiredScope: "read:contacts",
              queryParams: ["profile", "role", "updated_since", "limit", "cursor"],
              description: "Terceros (clientes, proveedores y plazos de crédito).",
            },
            {
              id: "cost-centers",
              method: "GET",
              path: "/api/v1/integrations/cost-centers",
              requiredScope: "read:finance | read:production",
              queryParams: ["profile"],
              description: "Centros de costo por especie y ubicaciones productivas.",
            },
            {
              id: "export-json",
              method: "GET",
              path: "/api/export?dataset=resumen-diario&format=json",
              requiredScope: "any",
              queryParams: ["dataset", "format=json", "from", "to", "updated_since", "limit", "cursor"],
              description: "Exportación incremental JSON de los 17 datasets operativos.",
            },
            {
              id: "agent-tools",
              method: "GET",
              path: "/api/v1/agent/tools",
              requiredScope: "agent:read | agent:write",
              description:
                "Manifiesto de herramientas del agente (schemas JSON, dominio Jev, confirmación requerida) filtrado por scopes.",
            },
            {
              id: "agent-tool-execute",
              method: "POST",
              path: "/api/v1/agent/tools/{name}",
              requiredScope: "agent:read (consultas) | agent:write (escrituras)",
              description:
                "Ejecuta una herramienta como el usuario delegante del token. Escrituras sensibles devuelven 202 con actionId pendiente de confirmación.",
            },
            {
              id: "agent-action-confirm",
              method: "POST",
              path: "/api/asistente/acciones/{actionId}/confirmar",
              requiredScope: "agent:write",
              description: "Confirma y ejecuta una acción pendiente creada por el agente externo (mismo token).",
            },
            {
              id: "agent-action-cancel",
              method: "POST",
              path: "/api/asistente/acciones/{actionId}/cancelar",
              requiredScope: "agent:write",
              description: "Cancela una acción pendiente creada por el agente externo (mismo token).",
            },
          ],
          syncedAt: new Date().toISOString(),
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    });
  } catch (error) {
    console.error("Integrations manifest error:", error);
    return NextResponse.json({ error: "No se pudo consultar el manifiesto" }, { status: 500 });
  }
}

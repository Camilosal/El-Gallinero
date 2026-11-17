import { BITACORA_ARTICLES } from "@/lib/bitacora-content";
import { guides } from "@/lib/guide-data";
import { CYCLE_PLANS_SHOWCASE } from "@/lib/landing-showcase";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export function GET() {
  const guideLines = guides.map(
    (g) => `- [${g.title}](${SITE_URL}/guia/${g.slug}): ${g.summary}`,
  );
  const articleLines = BITACORA_ARTICLES.map(
    (a) => `- [${a.title}](${SITE_URL}/bitacora/${a.slug}): ${a.summary}`,
  );
  const planLines = CYCLE_PLANS_SHOWCASE.map(
    (p) => `- [${p.name} (${p.priceLabel})](${SITE_URL}/planes/${p.slug}): ${p.summary}`,
  );

  const content = [
    "# IwaGranja — gestión de granjas multiespecie",
    "",
    "> Software web y PWA offline-first de código abierto para gestionar granjas avícolas y multiespecie (gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes) en Colombia.",
    "",
    "En producción en el gallinero piloto de Iwagé Granja (vereda Ambalá, Ibagué, Tolima, Colombia). Desarrollado por Camilo Saldarriaga (https://camilosaldarriaga.com) dentro del ecosistema Iwagé (https://iwage.co).",
    "",
    "## Documentación y soporte",
    `- [Centro de recursos](${SITE_URL}/recursos): artículos, herramientas y novedades del proyecto`,
    `- [Plantilla P1 de seguridad y autonomía alimentaria](${SITE_URL}/recursos/herramientas/p1): prototipo interactivo para personalizar una ficha y un plan preliminar de proyecto`,
    `- [Manual de uso completo (8 módulos y 2 secciones base)](${SITE_URL}/guia): guía ilustrada paso a paso con capturas reales`,
    `- [Ayuda y preguntas frecuentes](${SITE_URL}/ayuda): pagos por ciclo, modo offline, exportación y normativa`,
    `- [Contacto y soporte](${SITE_URL}/contacto): soporte técnico, implementación y canal PQR (respuesta en 1 día hábil)`,
    ...guideLines,
    "",
    "## Producto y propuesta",
    `- [Funcionalidades de IwaGranja](${SITE_URL}/funcionalidades): recorrido por los módulos operativos, automatizaciones y capacidades de campo`,
    `- [Inicio y vitrina interactiva](${SITE_URL}/#modulos): módulos esenciales, estándares ICA / NTC 1240 y asistente Gina`,
    `- [Realidad del campo](${SITE_URL}/realidad-campo): problemas reales del galpón y cómo se resuelven`,
    `- [Planes y precios](${SITE_URL}/planes): plan gratuito Semilla y planes por ciclo sin cobros automáticos`,
    ...planLines,
    `- [Crear granja gratis](${SITE_URL}/registro): arranque Día 1 en 3 minutos`,
    `- [Nosotros](${SITE_URL}/nosotros): historia en Ibagué, Tolima y relación con Iwagé`,
    "",
    "## Capacidades agénticas e integraciones (verificado nov-2026)",
    "IwaGranja incluye a Gina, un asistente de IA operativo para la granja: consultas en lenguaje natural, dictado por voz (también sin señal), lectura de fotos de facturas, memoria persistente de preferencias y deep-links a las pantallas de la app.",
    `- [Guía del asistente avanzado](${SITE_URL}/guia/asistente-avanzado): briefing diario proactivo con hallazgos de la granja (entregado en la app, por push y por Telegram), delegación gradual de escrituras rutinarias y canal bidireccional de Telegram con notas de voz, botones Confirmar/Cancelar y el comando /parte`,
    `- [Guía de integraciones ERP y agentes](${SITE_URL}/guia/integraciones-erp-agentes): tokens con scopes, API v1 de herramientas del agente y servidor MCP`,
    "- API v1 de herramientas del agente: GET /api/v1/agent/tools devuelve el manifiesto de herramientas filtrado por scope; POST /api/v1/agent/tools/{nombre} ejecuta una herramienta como el usuario delegante del token, con RBAC y aislamiento por granja (RLS).",
    "- Servidor MCP: POST /api/mcp (Streamable HTTP, JSON-RPC 2.0: initialize, tools/list, tools/call) permite conectar clientes como Claude u otros agentes MCP; usa el mismo ejecutor, candados y auditoría que la API v1.",
    "- Scopes de integración: agent:read (consultas) y agent:write (escrituras). Los tokens con agent:write requieren fecha de expiración obligatoria de máximo 90 días y pueden revocarse en cualquier momento desde la app.",
    "- Piso duro de seguridad: las escrituras sensibles (ventas, gastos, pagos, cierres, etc.) NUNCA se ejecutan automáticamente desde ningún canal (app, voz, Telegram, API v1 o MCP): quedan pendientes hasta la confirmación humana expresa. Toda acción queda auditada con su origen (assistant, telegram, external_agent, delegated_auto) y el token/usuario/chat que la originó.",
    "",
    "## Bitácora técnica de campo",
    `- [Índice de la bitácora](${SITE_URL}/bitacora): guías prácticas basadas en operación real`,
    ...articleLines,
    "",
    "## Código abierto y cumplimiento",
    `- [Modelo Open Source](${SITE_URL}/open-source): fórmulas auditables y despliegue propio con Docker y PostgreSQL`,
    "- [Repositorio en GitHub](https://github.com/Camilosal/El-Gallinero): código fuente, arquitectura TypeScript/Next.js y documentación",
    `- [Términos y condiciones](${SITE_URL}/terminos): condiciones del servicio, IVA y propiedad de datos`,
    `- [Política de tratamiento de datos (Ley 1581)](${SITE_URL}/privacidad): privacidad y analítica sin cookies de rastreo`,
    `- [Retracto y reembolsos](${SITE_URL}/retracto): derecho de retracto en 5 días hábiles`,
    "",
    "## Ecosistema relacionado",
    "- [Iwagé Hub](https://iwage.co): ecosistema agropecuario y territorial en Ibagué",
    "- [Camilo Saldarriaga](https://camilosaldarriaga.com): autor y consultor de automatización e IA",
    "",
  ].join("\n");

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

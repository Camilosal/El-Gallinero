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
    "# El Corral — Iwagé Granja",
    "",
    "> Software web y PWA offline-first de código abierto para gestionar granjas avícolas y multiespecie (gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes) en Colombia.",
    "",
    "En producción en el gallinero piloto de Iwagé Granja (vereda Ambalá, Ibagué, Tolima, Colombia). Desarrollado por Camilo Saldarriaga (https://camilosaldarriaga.com) dentro del ecosistema Iwagé (https://iwage.co).",
    "",
    "## Documentación y soporte",
    `- [Manual de uso completo (8 módulos y 2 secciones base)](${SITE_URL}/guia): guía ilustrada paso a paso con capturas reales`,
    `- [Ayuda y preguntas frecuentes](${SITE_URL}/ayuda): pagos por ciclo, modo offline, exportación y normativa`,
    `- [Contacto y soporte](${SITE_URL}/contacto): soporte técnico, implementación y canal PQR (respuesta en 1 día hábil)`,
    ...guideLines,
    "",
    "## Producto y propuesta",
    `- [Inicio y vitrina interactiva](${SITE_URL}/#modulos): módulos esenciales, estándares ICA / NTC 1240 y asistente Gina`,
    `- [Realidad del campo](${SITE_URL}/realidad-campo): problemas reales del galpón y cómo se resuelven`,
    `- [Planes y precios](${SITE_URL}/planes): plan gratuito Semilla y planes por ciclo sin cobros automáticos`,
    ...planLines,
    `- [Crear granja gratis](${SITE_URL}/registro): arranque Día 1 en 3 minutos`,
    `- [Nosotros](${SITE_URL}/nosotros): historia en Ibagué, Tolima y relación con Iwagé`,
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

import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { buildPageMetadata, buildSoftwareNode } from "@/lib/seo";

const TITLE = "Código abierto y soberanía de datos · IwaGranja";
const DESCRIPTION =
  "Modelo Open Source de IwaGranja: fórmulas zootécnicas auditables, despliegue propio con Docker y PostgreSQL y aportes desde campo o código.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/open-source",
  ogImage: "/images/guia/inicio-dashboard.webp",
  ogImageAlt: "Plataforma abierta IwaGranja para granjas mixtas",
});

const PILLARS = [
  {
    code: "01 · TRANSPARENCIA",
    title: "Fórmulas y reglas auditables",
    detail:
      "Puedes revisar cómo se calcula la conversión alimenticia (FCR), el punto de equilibrio por especie, la salida PEPS de cubetas NTC 1240 y los bloqueos por tiempo de retiro sanitario. También la capa agéntica: las herramientas del asistente, la API v1 y el servidor MCP comparten un mismo ejecutor con piso duro de confirmación para escrituras sensibles.",
  },
  {
    code: "02 · SOBERANÍA",
    title: "Tus datos son tuyos, siempre",
    detail:
      "Puedes desplegar IwaGranja en tu propio servidor con Docker y PostgreSQL o usar la nube gestionada en app.iwage.co, sin quedar amarrado a un proveedor ni perder tus registros.",
  },
  {
    code: "03 · EVOLUCIÓN EN CAMPO",
    title: "Construido con productores reales",
    detail:
      "Las mejoras nacen de granjas reales: altitud colombiana, 6 especies (aves, conejos y cuyes), modo sin señal en galpón y normatividad ICA/INVIMA/DIAN.",
  },
] as const;

const CONTRIBUTE_WAYS = [
  {
    role: "Productores y operarios",
    action: "Reporta casos de campo",
    summary:
      "Cuéntanos qué líneas genéticas manejas, qué tablas de peso o postura usas en tu altitud o qué flujo te quita tiempo en el galpón.",
    href: "/contacto",
    cta: "Enviar caso de campo",
  },
  {
    role: "Zootecnistas y veterinarios",
    action: "Valida normas y curvas",
    summary:
      "Ayúdanos a revisar parámetros biológicos, tiempos de retiro farmacológico, protocolos de compostaje AGROSAVIA y guías sanitarias.",
    href: "/guia",
    cta: "Revisar guía actual",
  },
  {
    role: "Desarrolladores y diseñadores",
    action: "Envía Issues y Pull Requests",
    summary:
      "Stack moderno en Next.js (App Router), TypeScript, Drizzle ORM, PostgreSQL y Tailwind CSS, listo para levantar en local con pruebas automatizadas. Puedes aportar herramientas al agente o conectar clientes vía API v1 y MCP.",
    href: "https://github.com/Camilosal/El-Gallinero",
    cta: "Ir al repositorio en GitHub ↗",
    external: true,
  },
] as const;

export default function OpenSourcePage() {
  return (
    <PublicPageShell
      title="Open Source y participación"
      intro="IwaGranja es software abierto pensado para que las granjas pequeñas y medianas tengan control total sobre su operación y sus datos."
      path="/open-source"
      description={DESCRIPTION}
      extraJsonLdNodes={[buildSoftwareNode()]}
    >
      <div className="space-y-8 text-[var(--iw-semantic-text-primary)] leading-relaxed">
        <section aria-labelledby="os-como-funciona">
          <h2 id="os-como-funciona" className="text-xl font-bold text-[var(--iw-semantic-text-primary)]">
            Cómo funciona nuestro modelo abierto
          </h2>
          <p className="mt-2 text-[var(--iw-semantic-text-primary)]">
            El código fuente de la aplicación web, el modelo multi-especie, las validaciones zootécnicas y la
            documentación operativa están publicados de forma abierta. Cualquier productor, técnico o equipo puede
            inspeccionarlos, adaptarlos o auto-hospedarlos.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {PILLARS.map((item) => (
              <article
                key={item.code}
                className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-2xs"
              >
                <p className="font-mono text-[11px] font-semibold tracking-wider text-[var(--iw-semantic-action-primary)]">
                  {item.code}
                </p>
                <h3 className="mt-1.5 text-base font-bold text-[var(--iw-semantic-text-primary)]">{item.title}</h3>
                <p className="mt-2 text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="os-participar"
          className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] p-6"
        >
          <h2 id="os-participar" className="text-xl font-bold text-[var(--iw-semantic-text-primary)]">
            Cómo puedes participar (con o sin código)
          </h2>
          <p className="mt-2 text-sm text-[var(--iw-semantic-text-primary)]">
            No necesitas saber programar para aportar. Gran parte del valor de IwaGranja viene de quienes trabajan
            todos los días con aves, conejos, cuyes y compostaje.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {CONTRIBUTE_WAYS.map((way) => (
              <div
                key={way.role}
                className="flex flex-col justify-between rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4"
              >
                <div>
                  <span className="inline-block rounded-full bg-[var(--iw-semantic-bg-feature)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--iw-semantic-text-primary)]">
                    {way.role}
                  </span>
                  <h3 className="mt-2.5 text-base font-bold text-[var(--iw-semantic-text-primary)]">{way.action}</h3>
                  <p className="mt-1.5 text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">{way.summary}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--iw-semantic-border-default)]">
                  {"external" in way && way.external ? (
                    <a
                      href={way.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
                    >
                      {way.cta}
                    </a>
                  ) : (
                    <Link
                      href={way.href}
                      className="text-sm font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
                    >
                      {way.cta} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="os-stack" className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-6">
          <h2 id="os-stack" className="text-lg font-bold text-[var(--iw-semantic-text-primary)]">
            Stack técnico y despliegue propio
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)]">FRONTEND &amp; API</p>
              <p className="font-semibold text-[var(--iw-semantic-text-primary)]">Next.js + TypeScript</p>
            </div>
            <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)]">BASE DE DATOS</p>
              <p className="font-semibold text-[var(--iw-semantic-text-primary)]">PostgreSQL + Drizzle ORM</p>
            </div>
            <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)]">CAMPO OFFLINE</p>
              <p className="font-semibold text-[var(--iw-semantic-text-primary)]">PWA + IndexedDB + QR</p>
            </div>
            <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)]">INFRAESTRUCTURA</p>
              <p className="font-semibold text-[var(--iw-semantic-text-primary)]">Docker Compose</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="https://github.com/Camilosal/El-Gallinero"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-action-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--iw-semantic-action-primary-text)] hover:bg-[var(--iw-semantic-action-primary-hover)] transition"
            >
              Ver repositorio en GitHub ↗
            </a>
            <Link
              href="/registro"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-action-secondary-border)] bg-[var(--iw-semantic-action-secondary)] px-4 py-2.5 text-sm font-semibold text-[var(--iw-semantic-action-secondary-text)] hover:bg-[var(--iw-semantic-bg-feature)] transition"
            >
              Probar granja en la nube →
            </Link>
            <Link
              href="/guia/integraciones-erp-agentes"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-subtle)] transition"
            >
              Guía de API v1 y MCP →
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { buildPageMetadata, buildSoftwareNode } from "@/lib/seo";

const TITLE = "Código abierto y soberanía de datos · El Gallinero";
const DESCRIPTION =
  "Modelo Open Source de El Gallinero: fórmulas zootécnicas auditables, despliegue propio con Docker y PostgreSQL y aportes desde campo o código.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/open-source",
  ogImage: "/images/guia/inicio-dashboard.webp",
  ogImageAlt: "Plataforma abierta El Gallinero para granjas mixtas",
});

const PILLARS = [
  {
    code: "01 · TRANSPARENCIA",
    title: "Fórmulas y reglas auditables",
    detail:
      "Puedes revisar cómo se calcula la conversión alimenticia (FCR), el punto de equilibrio por especie, la salida PEPS de cubetas NTC 1240 y los bloqueos por tiempo de retiro sanitario.",
  },
  {
    code: "02 · SOBERANÍA",
    title: "Tus datos son tuyos, siempre",
    detail:
      "Puedes desplegar El Gallinero en tu propio servidor con Docker y PostgreSQL o usar la nube gestionada en gallinero.iwage.co, sin quedar amarrado a un proveedor ni perder tus registros.",
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
      "Stack moderno en Next.js (App Router), TypeScript, Drizzle ORM, PostgreSQL y Tailwind CSS, listo para levantar en local con pruebas automatizadas.",
    href: "https://github.com/Camilosal/El-Gallinero",
    cta: "Ir al repositorio en GitHub ↗",
    external: true,
  },
] as const;

export default function OpenSourcePage() {
  return (
    <PublicPageShell
      title="Open Source y participación"
      intro="El Gallinero es software abierto pensado para que las granjas pequeñas y medianas tengan control total sobre su operación y sus datos."
      path="/open-source"
      description={DESCRIPTION}
      extraJsonLdNodes={[buildSoftwareNode()]}
    >
      <div className="space-y-8 text-slate-700 leading-relaxed">
        <section aria-labelledby="os-como-funciona">
          <h2 id="os-como-funciona" className="text-xl font-bold text-slate-900">
            Cómo funciona nuestro modelo abierto
          </h2>
          <p className="mt-2 text-slate-700">
            El código fuente de la aplicación web, el modelo multi-especie, las validaciones zootécnicas y la
            documentación operativa están publicados de forma abierta. Cualquier productor, técnico o equipo puede
            inspeccionarlos, adaptarlos o auto-hospedarlos.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {PILLARS.map((item) => (
              <article
                key={item.code}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
              >
                <p className="font-mono text-[11px] font-semibold tracking-wider text-emerald-800">
                  {item.code}
                </p>
                <h3 className="mt-1.5 text-base font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="os-participar"
          className="rounded-2xl border border-emerald-900/15 bg-emerald-50/50 p-6"
        >
          <h2 id="os-participar" className="text-xl font-bold text-slate-900">
            Cómo puedes participar (con o sin código)
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            No necesitas saber programar para aportar. Gran parte del valor de El Gallinero viene de quienes trabajan
            todos los días con aves, conejos, cuyes y compostaje.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {CONTRIBUTE_WAYS.map((way) => (
              <div
                key={way.role}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-900">
                    {way.role}
                  </span>
                  <h3 className="mt-2.5 text-base font-bold text-slate-900">{way.action}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{way.summary}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                  {"external" in way && way.external ? (
                    <a
                      href={way.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-950"
                    >
                      {way.cta}
                    </a>
                  ) : (
                    <Link
                      href={way.href}
                      className="text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-950"
                    >
                      {way.cta} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="os-stack" className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 id="os-stack" className="text-lg font-bold text-slate-900">
            Stack técnico y despliegue propio
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-slate-500">FRONTEND &amp; API</p>
              <p className="font-semibold text-slate-900">Next.js + TypeScript</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-slate-500">BASE DE DATOS</p>
              <p className="font-semibold text-slate-900">PostgreSQL + Drizzle ORM</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-slate-500">CAMPO OFFLINE</p>
              <p className="font-semibold text-slate-900">PWA + IndexedDB + QR</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <p className="font-mono text-[11px] text-slate-500">INFRAESTRUCTURA</p>
              <p className="font-semibold text-slate-900">Docker Compose</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="https://github.com/Camilosal/El-Gallinero"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#132a1e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3d2b]"
            >
              Ver repositorio en GitHub ↗
            </a>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Probar granja en la nube →
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}

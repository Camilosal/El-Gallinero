import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Egg,
  LayoutDashboard,
  Lock,
  Mic,
  QrCode,
  ShieldCheck,
  Wallet,
  Wheat,
  Bird,
} from "lucide-react";
import MobileNav from "@/components/MobileNav";
import ScrollReveal from "@/components/ScrollReveal";
import { LandingShowcase } from "@/components/LandingShowcase";
import { LandingFooter } from "@/components/LandingFooter";
import {
  AI_AUTOMATION_PILLARS,
  CYCLE_PLANS_SHOWCASE,
  LANDING_MODULES,
  SECTOR_STANDARDS,
} from "@/lib/landing-showcase";
import { APP_DEVELOPER } from "@/lib/branding";
import { PLAN_PROMISES, priceNote } from "@/lib/legal";

export const dynamic = "force-dynamic";

const HERO_CHIPS = [
  "Funciona sin señal",
  "Aves, conejos y cuyes",
  "Arranca en 3 min",
];

const PILLAR_ICONS: Record<string, typeof Mic> = {
  "ai-assistant": Mic,
  "ocr-qr-automation": QrCode,
  "micro-insights-routines": CheckCircle2,
};

const MODULE_ICONS: Record<string, typeof LayoutDashboard> = {
  inicio: LayoutDashboard,
  huevos: Egg,
  animales: Bird,
  alimento: Wheat,
  sanidad: ShieldCheck,
  finanzas: Wallet,
};

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "El Gallinero — Iwagé Granja",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, PWA",
    url: "https://gallinero.iwage.co",
    inLanguage: "es",
    description:
      "Aplicación web y móvil offline-first para granjas mixtas: postura, engorde, alimento, sanidad, trazabilidad QR, finanzas por especie y asistente por voz.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "COP",
    },
    author: {
      "@type": "Person",
      name: APP_DEVELOPER.name,
      url: APP_DEVELOPER.url,
    },
    maintainer: {
      "@type": "Person",
      name: APP_DEVELOPER.name,
      url: APP_DEVELOPER.url,
    },
  };

  return (
    <div id="top" className="land-body">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ScrollReveal>
        <nav className="land-nav" aria-label="Navegación principal">
          <div className="land-wrap flex items-center justify-between gap-4 py-3.5">
            <Link
              href="#top"
              className="font-display text-lg font-bold tracking-tight text-[var(--ink)] flex items-center gap-2 shrink-0"
            >
              <span
                className="w-2.5 h-2.5 rounded-full bg-[var(--forest)]"
                aria-hidden="true"
              />
              El Gallinero
            </Link>

            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--moss)]">
              <a href="#como-funciona" className="hover:text-[var(--ink)] transition">
                Cómo funciona
              </a>
              <a href="#modulos" className="hover:text-[var(--ink)] transition">
                Módulos y Normas
              </a>
              <a href="#planes" className="hover:text-[var(--ink)] transition">
                Planes
              </a>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--paper)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:border-[var(--forest)] transition"
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--forest)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--forest-deep)] transition"
              >
                Crear granja gratis
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <MobileNav />
            </div>
          </div>
        </nav>

        <header className="land-hero relative overflow-hidden bg-[var(--forest-deep)] text-[#f5efe2]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(233,196,106,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(92,122,94,0.28),transparent_50%)]"
            aria-hidden="true"
          />

          <div className="land-wrap relative z-10 py-10 sm:py-14 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-5 space-y-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e7cf9e]">
                  Gestión para granjas mixtas · Iwagé
                </p>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.08]">
                  Tu granja al día,{" "}
                  <span className="text-[#e9c46a]">
                    desde el galpón hasta las cuentas.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-[#e8e2d4] leading-relaxed max-w-xl">
                  Anota huevos, alimento, sanidad y ventas desde el celular.
                  La app ordena el resto y te muestra la utilidad del día.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href="/registro"
                    className="inline-flex items-center gap-2 rounded-full bg-[#e9c46a] px-6 py-3 text-sm font-bold text-[#132a1e] hover:bg-[#f2d385] transition shadow-sm"
                  >
                    Crear mi granja gratis
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a
                    href="#como-funciona"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-medium text-[#e8e2d4] hover:bg-white/10 transition"
                  >
                    Ver cómo funciona ↓
                  </a>
                </div>

                <ul className="flex flex-wrap gap-2 pt-1 text-xs text-[#e8e2d4]">
                  {HERO_CHIPS.map((chip) => (
                    <li
                      key={chip}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-medium"
                    >
                      <Check
                        className="w-3.5 h-3.5 text-[#e9c46a] shrink-0"
                        aria-hidden="true"
                      />
                      {chip}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-7">
                <LandingShowcase variant="hero" />
              </div>
            </div>
          </div>
        </header>

        <section
          id="como-funciona"
          className="land-quick land-section py-14 sm:py-16"
          aria-labelledby="como-funciona-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-7">
              <p className="land-eyebrow">1 · Anota en menos de 2 minutos</p>
              <h2 id="como-funciona-heading" className="land-h2">
                Tres formas de registrar sin llenar planillas
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Habla, escanea o confirma la rutina. La app ordena los datos y
                actualiza inventarios y cuentas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AI_AUTOMATION_PILLARS.map((pillar) => {
                const Icon = PILLAR_ICONS[pillar.id] ?? CheckCircle2;
                return (
                  <article
                    key={pillar.id}
                    className="land-reveal flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--forest)]">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{pillar.eyebrow}</span>
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                        {pillar.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-[var(--moss)] leading-relaxed">
                        {pillar.summary}
                      </p>
                    </div>
                    <div className="mt-auto rounded-lg border border-[var(--line)] bg-[var(--cream)] px-3 py-2.5 text-xs">
                      <p className="font-medium text-[var(--ink)]">
                        {pillar.exampleInput}
                      </p>
                      <p className="mt-0.5 text-[var(--moss)]">
                        → {pillar.exampleOutput}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="modulos"
          className="land-section border-t border-[var(--line)] bg-[var(--cream)] py-14 sm:py-18"
          aria-labelledby="modulos-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-6">
              <p className="land-eyebrow">2 · Módulos y Normas</p>
              <h2 id="modulos-heading" className="land-h2">
                6 módulos que crecen contigo
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Empiezas con lo esencial y activas más áreas cuando tu granja lo
                pida. La trazabilidad conecta todo de punta a punta.
              </p>
            </div>

            <figure className="land-trace-frame overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-2 shadow-sm">
              <Image
                src="/traceability-flow.png"
                alt="Flujo conectado entre nacimientos, galpones, postura, sanidad, alimento y trazabilidad comercial"
                width={1200}
                height={620}
                loading="lazy"
                className="w-full h-auto rounded-xl block"
              />
            </figure>

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {LANDING_MODULES.map((mod) => {
                const Icon = MODULE_ICONS[mod.id] ?? LayoutDashboard;
                return (
                  <article
                    key={mod.id}
                    className="land-reveal rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
                  >
                    <div className="flex items-center gap-2 text-[var(--forest)]">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <h3 className="font-display text-base sm:text-lg font-bold text-[var(--ink)]">
                        {mod.name}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs sm:text-sm text-[var(--moss)] leading-relaxed">
                      {mod.summary}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <Link
                href="/guia"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--forest)] hover:underline"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                Ver guía completa (14 módulos)
              </Link>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
              <div className="border-b border-[var(--line)] p-5 sm:p-6">
                <p className="land-eyebrow">Normas del sector</p>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-2">
                  Las reglas que la app aplica por ti
                </h3>
                <p className="mt-1.5 text-sm text-[var(--moss)]">
                  Toca una norma para ver el detalle. No necesitas memorizarlas:
                  el sistema las usa al registrar y al vender.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-3 sm:p-4">
                {SECTOR_STANDARDS.map((item, index) => (
                  <details
                    key={item.code}
                    className="land-norm rounded-xl border border-[var(--line)] bg-[var(--cream)]"
                    open={index === 0}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--forest)] block">
                          {item.code} · {item.authority}
                        </span>
                        <span className="mt-0.5 block font-display text-sm font-bold text-[var(--ink)] leading-snug">
                          {item.title}
                        </span>
                      </span>
                      <ChevronDown
                        className="land-norm-chevron w-4 h-4 shrink-0 text-[var(--forest)]"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="space-y-2 border-t border-[var(--line)] px-4 py-3 text-xs">
                      <p className="text-[var(--moss)] leading-relaxed">
                        {item.summary}
                      </p>
                      <p className="font-medium text-[var(--ink)] leading-relaxed">
                        {item.enforcement}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 font-mono text-[10px] text-[var(--moss)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="planes"
          className="land-section border-t border-[var(--line)] bg-[var(--paper)] py-14 sm:py-18"
          aria-labelledby="planes-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-8">
              <p className="land-eyebrow">3 · Planes por ciclo productivo</p>
              <h2 id="planes-heading" className="land-h2">
                Paga por cosecha o usa 1 lote gratis
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Sin tarjeta, sin permanencia y sin cobros automáticos. Eliges el
                plan cuando tu ciclo lo pida.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {CYCLE_PLANS_SHOWCASE.map((plan) => (
                <article
                  key={plan.id}
                  className={`land-reveal rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4 ${
                    plan.featured
                      ? "border-[var(--forest)] bg-white shadow-sm"
                      : "border-[var(--line)] bg-[var(--cream)]"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--forest)]">
                        {plan.badge}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--moss)]">
                        {plan.durationLabel}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-base sm:text-lg font-bold text-[var(--ink)]">
                        {plan.name}
                      </h3>
                      <p className="font-display text-xl sm:text-2xl font-bold text-[var(--forest)] mt-1">
                        {plan.priceLabel}
                      </p>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--moss)] leading-relaxed">
                      {plan.summary}
                    </p>
                  </div>

                  <ul className="space-y-1.5 pt-3 border-t border-[var(--line)] text-xs text-[var(--ink)]">
                    {plan.highlights.map((hl) => (
                      <li key={hl} className="flex items-start gap-1.5 leading-snug">
                        <Check className="w-3.5 h-3.5 text-[var(--forest)] shrink-0 mt-0.5" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="land-guarantees mt-5 grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4 text-xs sm:text-sm md:grid-cols-2 md:gap-0 md:p-0">
              <div className="flex items-start gap-2.5 md:p-4">
                <Lock
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forest)]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-[var(--ink)]">
                    Tus datos nunca se bloquean al vencer un ciclo
                  </p>
                  <p className="mt-1 text-[var(--moss)] leading-relaxed">
                    {PLAN_PROMISES.expiry}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 border-t border-[var(--line)] pt-3 md:border-l md:border-t-0 md:p-4 md:pt-4">
                <CreditCard
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forest)]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-[var(--ink)]">
                    Pago único por Nequi, Daviplata o PSE
                  </p>
                  <p className="mt-1 text-[var(--moss)] leading-relaxed">
                    {PLAN_PROMISES.noAutoCharge}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-[var(--moss)]">
              {priceNote()}{" "}
              <Link href="/terminos" className="underline underline-offset-2">
                Términos y condiciones
              </Link>{" "}
              ·{" "}
              <Link href="/retracto" className="underline underline-offset-2">
                Retracto y reembolsos
              </Link>
            </p>
          </div>
        </section>

        <section
          id="acceso"
          className="land-close-section py-10 sm:py-14"
          aria-labelledby="acceso-heading"
        >
          <div className="land-wrap">
            <div className="land-close-banner overflow-hidden rounded-3xl bg-[var(--forest-deep)] px-6 py-8 text-center text-[#f5efe2] sm:px-10 sm:py-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e7cf9e]">
                4 · Comienza hoy
              </p>
              <h2
                id="acceso-heading"
                className="mx-auto mt-2 max-w-2xl font-display text-2xl font-bold leading-tight text-white sm:text-3xl"
              >
                Tu granja puede estar al día hoy mismo
              </h2>

              <ol className="mx-auto mt-4 flex max-w-2xl flex-col items-center justify-center gap-2 text-xs text-[#d6dfd8] sm:flex-row sm:gap-3">
                {[
                  "Crea tu granja",
                  "Carga tus animales vivos",
                  "Anota en el galpón",
                ].map((step, index) => (
                  <li
                    key={step}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e9c46a] text-[10px] font-bold text-[#132a1e]">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="inline-flex items-center gap-2 rounded-full bg-[#e9c46a] px-6 py-3 text-sm font-bold text-[#132a1e] hover:bg-[#f2d385] transition shadow-sm"
                >
                  Crear mi granja gratis
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://github.com/Camilosal/El-Gallinero"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 fill-current shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2.14c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15v3.19c0 .31.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                  </svg>
                  Código abierto en GitHub
                </a>
              </div>

              <p className="mt-3 text-xs text-[#c7cebb]">
                30 días full · sin tarjeta · datos siempre disponibles
              </p>
            </div>
          </div>
        </section>

        <LandingFooter />
      </ScrollReveal>
    </div>
  );
}

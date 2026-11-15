import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Egg,
  LayoutDashboard,
  Lock,
  Mic,
  QrCode,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Wheat,
  WifiOff,
  Bird,
} from "lucide-react";
import MobileNav from "@/components/MobileNav";
import ScrollReveal from "@/components/ScrollReveal";
import { LandingShowcase } from "@/components/LandingShowcase";
import { LandingFooter } from "@/components/LandingFooter";
import { ModulesAccordionShowcase } from "@/components/ModulesAccordionShowcase";
import { SectorStandardsCarousel } from "@/components/SectorStandardsCarousel";
import { JsonLd } from "@/components/JsonLd";
import {
  buildFaqNode,
  buildJsonLd,
  buildPageMetadata,
  buildSoftwareNode,
  SITE_URL,
} from "@/lib/seo";
import {
  ADOPTION_HIGHLIGHTS,
  AI_AUTOMATION_PILLARS,
  CYCLE_PLANS_SHOWCASE,
  EXTRA_LANDING_MODULES,
  LANDING_MODULES,
  SECTOR_STANDARDS,
  type AdoptionHighlightItem,
} from "@/lib/landing-showcase";
import { APP_DEVELOPER } from "@/lib/branding";
import { PLAN_PROMISES, priceNote } from "@/lib/legal";
import { FAQS } from "@/lib/legal-content";

export const dynamic = "force-dynamic";

const HOME_TITLE = "El Gallinero · Software libre para granjas avícolas";
const HOME_DESCRIPTION =
  "Gestión de granja sin señal: huevos, alimento, sanidad, trazabilidad QR y finanzas por especie. Código abierto, en producción en Ibagué, Colombia.";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    ogImage: "/images/guia/inicio-dashboard.webp",
    ogImageAlt: "Pantalla principal de El Gallinero con tareas de hoy, alertas y trazabilidad",
  }),
  authors: [{ name: APP_DEVELOPER.name, url: APP_DEVELOPER.url }],
};

const HERO_DOCK_CARDS = [
  {
    id: "arranque",
    icon: Clock,
    title: "Arranca en pocos minutos",
    summary: "Solo aves o animales vivos de hoy y guía precargada.",
  },
  {
    id: "offline",
    icon: WifiOff,
    title: "Funciona sin señal",
    summary: "Abre una vez con red, registra en el galpón y sincroniza al volver.",
  },
  {
    id: "productores",
    icon: Bird,
    title: "Aves, conejos, cuyes y cuentas",
    summary: "Separa cada especie y entrega tu utilidad diaria.",
  },
] as const;

const HERO_FRAGMENTS = [
  {
    id: "campo",
    label: "Captura en galpón",
    detail: "Huevos NTC 1240, alimento, mortalidad y ventas.",
  },
  {
    id: "informativa",
    label: "Herramienta informativa",
    detail: "Curvas de crecimiento, FCR y alertas biológicas.",
  },
  {
    id: "sanidad",
    label: "Normativa y retiros",
    detail: "Calendario ICA, tiempos de retiro y compostaje.",
  },
  {
    id: "utilidad",
    label: "Cierre diario",
    detail: "Resumen de caja por especie listo para WhatsApp.",
  },
] as const;

const PILLAR_ICONS: Record<string, typeof Mic> = {
  "ai-assistant": Mic,
  "ocr-qr-automation": QrCode,
  "micro-insights-routines": CheckCircle2,
};

const ADOPTION_ICONS: Record<AdoptionHighlightItem["id"], typeof Sparkles> = {
  "arranque-rapido": Sparkles,
  "escala-gradual": TrendingUp,
  "campo-sin-senal": WifiOff,
  "utilidad-ciclos": Wallet,
};

const MODULE_ICONS: Record<string, typeof LayoutDashboard> = {
  inicio: LayoutDashboard,
  huevos: Egg,
  animales: Bird,
  alimento: Wheat,
  sanidad: ShieldCheck,
  finanzas: Wallet,
};

const iconDelayStyle = (delaySeconds: number): CSSProperties =>
  ({ ["--icon-delay" as string]: `${delaySeconds}s` }) as CSSProperties;

export default function HomePage() {
  const jsonLd = buildJsonLd({
    path: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    pageType: "WebPage",
    ogImage: "/images/guia/inicio-dashboard.webp",
    extraNodes: [buildSoftwareNode(), buildFaqNode(SITE_URL, FAQS.slice(0, 6))],
  });

  return (
    <div id="top" className="land-body">
      <JsonLd data={jsonLd} />

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
              <Link href="/bitacora" className="hover:text-[var(--ink)] transition">
                Bitácora
              </Link>
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
          <Image
            src="/hero-illustration.png"
            alt="Ilustración rural de El Gallinero en Ibagué, Tolima"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-20 pointer-events-none select-none"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(233,196,106,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(19,42,30,0.85),rgba(19,42,30,0.72))]"
            aria-hidden="true"
          />

          <div className="land-wrap relative z-10 pt-14 sm:pt-16 lg:pt-20 pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-6 space-y-5">
                <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#e7cf9e]">
                  Plataforma digital y herramienta informativa
                </p>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-[46px] font-bold tracking-tight text-white leading-[1.08]">
                  Tu granja al día,{" "}
                  <span className="text-[#e9c46a]">
                    desde el galpón hasta las cuentas.
                  </span>
                </h1>

                <p className="text-base sm:text-[17px] text-[#e8e2d4] leading-relaxed max-w-lg">
                  Pensada para pequeños y medianos productores de granjas mixtas: anota en
                  campo sin señal y consulta guías técnicas y tu utilidad real cada día.
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
              </div>

              <div className="lg:col-span-6">
                <a
                  href="#vitrina"
                  aria-label="Explorar capturas reales de El Gallinero"
                  className="block land-browser-frame overflow-hidden rounded-2xl border border-white/15 bg-[var(--paper)] shadow-2xl group"
                >
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--line)] bg-[#f4ede0]">
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#d4a373]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#e9c46a]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4f775d]" />
                    </div>
                    <span className="font-mono text-[11px] text-[var(--moss)] truncate">
                      gallinero.iwage.co/dashboard
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--forest)]">
                      Vista real
                    </span>
                  </div>

                  <div className="relative bg-white overflow-hidden">
                    <Image
                      src="/images/guia/inicio-dashboard.webp"
                      alt="Pantalla principal real de El Gallinero con tareas de hoy, alertas y accesos rápidos"
                      width={1280}
                      height={800}
                      priority
                      className="w-full h-auto block group-hover:scale-[1.01] transition-transform duration-300"
                    />
                  </div>
                </a>
              </div>
            </div>

            <div className="land-hero-dock mt-10 sm:mt-12 lg:mt-14 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/15">
              {HERO_DOCK_CARDS.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.id}
                    className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6 sm:py-4"
                  >
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e9c46a]/30 bg-[#e9c46a]/15 text-[#e9c46a]"
                      aria-hidden="true"
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-sm sm:text-base font-bold text-white leading-snug">
                        <span className="mr-1.5 font-mono text-[11px] font-semibold text-[#e7cf9e]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        {card.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-[#d6dfd8] leading-snug">
                        {card.summary}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </header>

        <section
          aria-label="Qué puedes consultar y registrar cada día"
          className="border-b border-[var(--line)] bg-[var(--paper)] py-5 sm:py-6"
        >
          <div className="land-wrap grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {HERO_FRAGMENTS.map((frag) => (
              <div
                key={frag.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--cream)]/60 px-4 py-3"
              >
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--forest)]">
                  {frag.label}
                </p>
                <p className="mt-1 text-xs sm:text-sm text-[var(--ink)] leading-snug">
                  {frag.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <LandingShowcase />

        <section
          id="como-funciona"
          className="land-quick land-section"
          aria-labelledby="como-funciona-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-7">
              <p className="land-eyebrow">2 · Fácil de adoptar</p>
              <h2 id="como-funciona-heading" className="land-h2">
                Pensada para anotar en menos de 2 minutos
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Pequeños y medianos productores registran por voz, código QR o toque rápido
                mientras consultan reglas y resultados claros al instante.{" "}
                <Link
                  href="/realidad-campo"
                  className="font-semibold text-[var(--forest)] underline underline-offset-4 hover:text-[var(--forest-deep)]"
                >
                  Ver problemas reales del campo que resolvemos →
                </Link>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AI_AUTOMATION_PILLARS.map((pillar, idx) => {
                const Icon = PILLAR_ICONS[pillar.id] ?? CheckCircle2;
                return (
                  <article
                    key={pillar.id}
                    className="land-reveal land-animated-card flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="land-card-icon-badge"
                        style={iconDelayStyle(idx * 0.45)}
                        aria-hidden="true"
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[var(--forest)]">
                        {pillar.eyebrow}
                      </span>
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

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {ADOPTION_HIGHLIGHTS.map((item, idx) => {
                const Icon = ADOPTION_ICONS[item.id] ?? Sparkles;
                return (
                  <article
                    key={item.id}
                    className="land-reveal land-animated-card rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="land-card-icon-badge"
                        style={iconDelayStyle(idx * 0.35 + 0.2)}
                        aria-hidden="true"
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="text-right">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--forest)] block">
                          {item.step}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--moss)] block">
                          {item.badge}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-[var(--ink)] leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-[var(--moss)] leading-relaxed">
                        {item.description}
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
          className="land-section border-t border-[var(--line)] bg-[var(--cream)]"
          aria-labelledby="modulos-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-7">
              <p className="land-eyebrow">3 · Qué incluye el sistema</p>
              <h2 id="modulos-heading" className="land-h2">
                8 módulos reales que crecen contigo
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Empiezas con 6 frentes esenciales desde el Día 1 y puedes activar
                las demás herramientas de los 8 módulos cuando tu operación lo pida.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              <div className="lg:col-span-5 space-y-4">
                <figure className="land-trace-frame overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 shadow-sm">
                  <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
                    <Image
                      src="/traceability-flow.png"
                      alt="Flujo conectado entre nacimientos, galpones, postura, sanidad, alimento y trazabilidad comercial"
                      width={1200}
                      height={620}
                      loading="lazy"
                      className="w-full h-auto block"
                    />
                  </div>
                  <figcaption className="mt-3 text-xs text-[var(--moss)]">
                    <span className="font-medium text-[var(--ink)]">
                      Trazabilidad de punta a punta entre lotes, bodega y ventas.
                    </span>
                  </figcaption>
                </figure>
              </div>

              <div className="lg:col-span-7">
                <ModulesAccordionShowcase
                  coreModules={LANDING_MODULES}
                  extraModules={EXTRA_LANDING_MODULES}
                />
              </div>
            </div>

            <SectorStandardsCarousel standards={SECTOR_STANDARDS} />
          </div>
        </section>

        {/* Banner dedicado de lado a lado para acceso directo a la Guía de uso */}
        <section
          aria-label="Acceso directo a la guía de uso"
          className="w-full bg-[var(--forest-deep)] text-[#f5efe2] border-y border-[var(--line)] py-6"
        >
          <div className="land-wrap flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9c46a] text-[#132a1e]">
                <BookOpen className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#e7cf9e]">
                  Manual práctico · 8 módulos y 2 guías base
                </p>
                <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-snug">
                  ¿Quieres ver cada pantalla y flujo antes de registrarte?
                </h2>
                <p className="text-xs sm:text-sm text-[#d6dfd8] mt-0.5">
                  Recorre la guía completa paso a paso con capturas reales, modo offline y ejemplos de campo.
                </p>
              </div>
            </div>

            <Link
              href="/guia"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e9c46a] px-5 py-2.5 text-sm font-bold text-[#132a1e] hover:bg-[#f2d385] transition shrink-0"
            >
              Abrir guía de uso
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section
          id="planes"
          className="land-section border-t border-[var(--line)] bg-[var(--paper)]"
          aria-labelledby="planes-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-8">
              <p className="land-eyebrow">4 · Planes por ciclo productivo</p>
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
                  <div className="mt-4 space-y-2">
                    <Link
                      href="/registro"
                      className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                        plan.featured
                          ? "bg-[var(--forest)] text-white hover:bg-[var(--forest-deep)] shadow-sm"
                          : "border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--forest)] hover:bg-white/50"
                      }`}
                    >
                      {plan.featured ? "Empezar ciclo" : "Unirme al plan"}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href={`/planes/${plan.slug}`}
                      className="w-full inline-flex items-center justify-center text-xs font-semibold text-[var(--forest)] underline underline-offset-4 hover:text-[var(--forest-deep)] py-1"
                    >
                      Ver detalle del plan →
                    </Link>
                  </div>
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
                    Tu historial nunca se bloquea al vencer un ciclo
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
          id="preguntas-frecuentes"
          className="land-section border-t border-[var(--line)] bg-[var(--cream)]"
          aria-labelledby="faq-heading"
        >
          <div className="land-wrap">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div className="max-w-2xl">
                <p className="land-eyebrow">Preguntas frecuentes</p>
                <h2 id="faq-heading" className="land-h2">
                  Dudas comunes antes de empezar
                </h2>
                <p className="land-section-sub" style={{ marginBottom: 0 }}>
                  Respuestas rápidas sobre uso sin señal, especies, precios y respaldo de tus datos.
                </p>
              </div>
              <Link
                href="/ayuda"
                className="text-sm font-semibold text-[var(--forest)] underline underline-offset-4 hover:text-[var(--forest-deep)] shrink-0"
              >
                Ver todas las preguntas e imágenes →
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {FAQS.slice(0, 6).map((faq, idx) => (
                <details
                  key={faq.q}
                  className="land-accordion rounded-xl border border-[var(--line)] bg-[var(--paper)]"
                  open={idx < 2}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[#f4ede0] rounded-xl transition-colors">
                    <span>{faq.q}</span>
                    <ChevronDown className="w-4 h-4 shrink-0 text-[var(--forest)]" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-[var(--line)] px-4 py-3 text-sm text-[var(--ink-soft)] leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section
          id="acceso"
          className="land-section land-close-section"
          aria-labelledby="acceso-heading"
        >
          <div className="land-wrap">
            <div className="land-close-banner overflow-hidden rounded-3xl bg-[var(--forest-deep)] px-6 py-8 text-center text-[#f5efe2] sm:px-10 sm:py-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e7cf9e]">
                5 · Comienza hoy
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
                <Link
                  href="/open-source"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  Cómo funciona Open Source
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
                30 días full · sin tarjeta · historial y exportación siempre disponibles
              </p>
            </div>
          </div>
        </section>

        <LandingFooter />
      </ScrollReveal>
    </div>
  );
}

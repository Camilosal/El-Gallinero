import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
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
import { PublicNavigation } from "@/components/PublicNavigation";
import ScrollReveal from "@/components/ScrollReveal";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingShowcase } from "@/components/LandingShowcase";
import { LandingSubscriptionPlans } from "@/components/LandingSubscriptionPlans";
import { LandingFooter } from "@/components/LandingFooter";
import { ModulesAccordionShowcase } from "@/components/ModulesAccordionShowcase";
import { AnimalRadar } from "@/components/landing/AnimalRadar";
import { ChickenLifecycleAnimation } from "@/components/landing/ChickenLifecycleAnimation";
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
  EXTRA_LANDING_MODULES,
  LANDING_MODULES,
  type AdoptionHighlightItem,
} from "@/lib/landing-showcase";
import { APP_DEVELOPER } from "@/lib/branding";
import { PLAN_PROMISES, priceNote } from "@/lib/legal";
import { FAQS } from "@/lib/legal-content";
import { getPublicPricingOffer } from "@/lib/pricing/quote";

export const dynamic = "force-dynamic";

const HOME_TITLE = "IwaGranja · Software libre para granjas avícolas";
const HOME_DESCRIPTION =
  "Gestión de granja sin señal: huevos, alimento, sanidad, trazabilidad QR y finanzas por especie. Código abierto, en producción en Ibagué, Colombia.";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    ogImage: "/images/guia/inicio-dashboard.webp",
    ogImageAlt: "Pantalla principal de IwaGranja con tareas de hoy, alertas y trazabilidad",
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
    icon: Egg,
    label: "Captura en galpón",
    detail: "Huevos por tamaño, alimento, mortalidad y ventas.",
  },
  {
    id: "informativa",
    icon: TrendingUp,
    label: "Herramienta informativa",
    detail: "Curvas de crecimiento, FCR y alertas biológicas.",
  },
  {
    id: "sanidad",
    icon: ShieldCheck,
    label: "Sanidad y bioseguridad",
    detail: "Registros sanitarios, tiempos de retiro y alertas.",
  },
  {
    id: "utilidad",
    icon: Wallet,
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
  const pricingOffer = getPublicPricingOffer();
  const jsonLd = buildJsonLd({
    path: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    pageType: "WebPage",
    ogImage: "/images/guia/inicio-dashboard.webp",
    extraNodes: [buildSoftwareNode(), buildFaqNode(SITE_URL, FAQS)],
  });

  return (
    <div id="top" className="land-body">
      <JsonLd data={jsonLd} />

      <ScrollReveal>
        <PublicNavigation brandHref="#top" />

        <header className="land-hero relative overflow-hidden bg-[var(--iw-color-forest-dark)] text-[var(--iw-color-white)]">
          <Image
            src="/hero-illustration.webp"
            alt="Ilustración rural de IwaGranja en Ibagué, Tolima"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-20 pointer-events-none select-none"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(177,122,69,0.20),transparent_55%),linear-gradient(180deg,rgba(38,70,58,0.78)_0%,rgba(18,29,21,0.82)_100%)]"
            aria-hidden="true"
          />

          <div className="land-wrap relative z-10 pt-14 sm:pt-16 lg:pt-20 pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <BrandLogo
                    variant="mark"
                    size={28}
                    decorative
                    className="rounded-lg bg-white/95 p-0.5 border border-white/25 shadow-sm"
                  />
                  <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--iw-color-paper)]">
                    Plataforma digital y herramienta informativa
                  </p>
                </div>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-[46px] font-bold tracking-tight text-[var(--iw-color-white)] leading-[1.08]">
                  Tu granja al día,{" "}
                  <span className="text-[var(--iw-color-sage)]">
                    desde el galpón hasta las cuentas.
                  </span>
                </h1>

                <p className="text-base sm:text-[17px] text-[var(--iw-color-paper)] leading-relaxed max-w-lg">
                  Pensada para pequeños y medianos productores de granjas mixtas: anota en
                  campo sin señal y consulta guías técnicas y tu utilidad real cada día.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href="/registro"
                    className="inline-flex min-h-12 items-center gap-2 rounded-[var(--iw-radius-control)] bg-[var(--iw-color-paper)] px-6 py-3 text-sm font-bold text-[var(--iw-color-ink-strong)] hover:bg-[var(--iw-color-white)] transition shadow-sm"
                  >
                    Crear mi granja gratis
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a
                    href="#como-funciona"
                    className="inline-flex min-h-12 items-center gap-2 rounded-[var(--iw-radius-control)] border border-white/25 px-4 py-3 text-sm font-medium text-[var(--iw-color-paper)] hover:bg-white/10 transition"
                  >
                    Ver cómo funciona ↓
                  </a>
                </div>

                <p className="text-xs text-[var(--iw-color-sage)]">
                  ¿Coordinas una cooperativa, ONG o equipo técnico?{" "}
                  <a
                    href="#planes"
                    className="font-semibold text-[var(--iw-color-paper)] underline underline-offset-4 hover:text-[var(--iw-color-white)]"
                  >
                    Ver planes para organizaciones →
                  </a>
                </p>
              </div>

              <div className="lg:col-span-6">
                <a
                  href="#modulos"
                  aria-label="Explorar las especies que puedes gestionar en IwaGranja"
                  className="block land-browser-frame overflow-hidden rounded-2xl border border-white/15 bg-[var(--iw-semantic-bg-surface)] shadow-[var(--iw-shadow-popover)]"
                >
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)]">
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--iw-color-terracotta)]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--iw-color-ochre)]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--iw-color-forest)]" />
                    </div>
                    <span className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)] truncate">
                      app.iwage.co/animales
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--iw-semantic-action-primary)]">
                      Vista ilustrativa
                    </span>
                  </div>

                  <div className="relative bg-[var(--iw-semantic-bg-surface)] overflow-hidden">
                    <AnimalRadar />
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
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--iw-radius-control)] border border-white/20 bg-white/10 text-[var(--iw-color-paper)]"
                      aria-hidden="true"
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-sm sm:text-base font-bold text-[var(--iw-color-white)] leading-snug">
                        <span className="mr-1.5 font-mono text-[11px] font-semibold text-[var(--iw-color-sage)]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        {card.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--iw-color-paper)] leading-snug">
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
          aria-label="Herramientas de registro y consulta"
          className="border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)] py-4 sm:py-5"
        >
          <ul className="land-wrap land-floating-facts">
            {HERO_FRAGMENTS.map((frag) => {
              const Icon = frag.icon;
              return (
                <li key={frag.id} className="land-floating-fact">
                  <Icon className="h-4 w-4 shrink-0 text-[var(--iw-semantic-action-primary)]" aria-hidden="true" />
                  <span><strong>{frag.label}:</strong> {frag.detail}</span>
                </li>
              );
            })}
          </ul>
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
                  className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
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
                    className="land-reveal land-animated-card flex flex-col gap-3 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-[var(--iw-shadow-card)]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="land-card-icon-badge"
                        style={iconDelayStyle(idx * 0.45)}
                        aria-hidden="true"
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[var(--iw-semantic-action-primary)]">
                        {pillar.eyebrow}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-[var(--iw-semantic-text-primary)]">
                        {pillar.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                        {pillar.summary}
                      </p>
                    </div>
                    <div className="mt-auto rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-3 py-2.5 text-xs">
                      <p className="font-medium text-[var(--iw-semantic-text-primary)]">
                        {pillar.exampleInput}
                      </p>
                      <p className="mt-0.5 text-[var(--iw-semantic-text-secondary)]">
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
                    className="land-reveal land-animated-card rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-4 flex flex-col gap-2.5"
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
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-semantic-action-primary)] block">
                          {item.step}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--iw-semantic-text-secondary)] block">
                          {item.badge}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-[var(--iw-semantic-text-primary)] leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">
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
          className="land-section border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]"
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
                <figure className="land-trace-frame overflow-hidden rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3 shadow-[var(--iw-shadow-card)]">
                  <div className="overflow-hidden rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]">
                    <ChickenLifecycleAnimation />
                  </div>
                  <figcaption className="mt-3 text-xs text-[var(--iw-semantic-text-secondary)]">
                    <span className="font-medium text-[var(--iw-semantic-text-primary)]">
                      Ciclo de crecimiento: nacimiento, etapa productiva y postura.
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

            <aside className="mt-8 flex flex-col gap-3 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-[var(--iw-shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">Guía para consulta</p>
                <h3 className="mt-1 font-display text-lg font-bold text-[var(--iw-semantic-text-primary)]">Normas y guías para una granja mixta</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">Revisa qué fuentes oficiales consultar según la especie y cómo distinguir una guía de una obligación o certificación.</p>
              </div>
              <Link href="/bitacora/normas-y-guias-granja-mixta" className="inline-flex min-h-12 shrink-0 items-center gap-2 font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]">
                Leer el artículo <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </section>

        {/* Banner dedicado de lado a lado para acceso directo a la Guía de uso */}
        <section
          aria-label="Acceso directo a la guía de uso"
          className="w-full bg-[var(--iw-color-forest-dark)] text-[var(--iw-color-white)] border-y border-[var(--iw-semantic-border-default)] py-6"
        >
          <div className="land-wrap flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--iw-radius-control)] bg-[var(--iw-color-paper)] text-[var(--iw-color-ink-strong)]">
                <BookOpen className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--iw-color-sage)]">
                  Manual práctico · 8 módulos y 2 guías base
                </p>
                <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--iw-color-white)] leading-snug">
                  ¿Quieres ver cada pantalla y flujo antes de registrarte?
                </h2>
                <p className="text-xs sm:text-sm text-[var(--iw-color-paper)] mt-0.5">
                  Recorre la guía completa paso a paso con capturas reales, modo offline y ejemplos de campo.
                </p>
              </div>
            </div>

            <Link
              href="/guia"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--iw-radius-control)] bg-[var(--iw-color-paper)] px-5 py-2.5 text-sm font-bold text-[var(--iw-color-ink-strong)] hover:bg-[var(--iw-color-white)] transition shrink-0"
            >
              Abrir guía de uso
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section
          id="confianza"
          className="land-section border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]"
          aria-labelledby="confianza-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-7">
              <p className="land-eyebrow">Confianza y respaldo</p>
              <h2 id="confianza-heading" className="land-h2">
                Especificaciones verificables y operación en campo
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Sin promesas infladas ni sellos ficticios: cada capacidad descrita corresponde al software real en uso y documentación abierta.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <article className="land-reveal land-animated-card rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)] p-5 flex flex-col gap-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-color-ochre)]">
                  Territorio real
                </span>
                <h3 className="font-display text-base font-bold text-[var(--iw-semantic-text-primary)]">
                  Operación en Ibagué, Tolima
                </h3>
                <p className="text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                  Diseñada y probada junto a granjas mixtas en producción, adaptada a prácticas e insumos en Colombia.
                </p>
              </article>

              <article className="land-reveal land-animated-card rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)] p-5 flex flex-col gap-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-color-ochre)]">
                  Continuidad en campo
                </span>
                <h3 className="font-display text-base font-bold text-[var(--iw-semantic-text-primary)]">
                  Respaldo local verificable
                </h3>
                <p className="text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                  Tus anotaciones se guardan primero en el dispositivo mediante IndexedDB y muestran cuándo siguen pendientes o sincronizadas.
                </p>
              </article>

              <article className="land-reveal land-animated-card rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)] p-5 flex flex-col gap-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-color-ochre)]">
                  Fuentes consultables
                </span>
                <h3 className="font-display text-base font-bold text-[var(--iw-semantic-text-primary)]">
                  Criterios técnicos en bitácora
                </h3>
                <p className="text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                  Referenciamos NTC 1240, guías ICA y tablas productivas en{" "}
                  <Link href="/bitacora" className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-2">
                    la bitácora pública
                  </Link>{" "}
                  sin confundir orientación con certificación oficial.
                </p>
              </article>

              <article className="land-reveal land-animated-card rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)] p-5 flex flex-col gap-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-color-ochre)]">
                  Código auditable
                </span>
                <h3 className="font-display text-base font-bold text-[var(--iw-semantic-text-primary)]">
                  Transparencia Open Source
                </h3>
                <p className="text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                  Puedes revisar el código, exportar tus registros y conocer nuestro modelo abierto en{" "}
                  <Link href="/open-source" className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-2">
                    Open Source
                  </Link>
                  .
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          id="planes"
          className="land-section border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)]"
          aria-labelledby="planes-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-8">
              <p className="land-eyebrow">4 · Planes y suscripciones</p>
              <h2 id="planes-heading" className="land-h2">
                Elige cómo quieres crecer
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Dos modalidades: para administrar tu granja o para acompañar una organización y sus proyectos.
              </p>
            </div>

            <LandingSubscriptionPlans offer={pricingOffer} />

            <div className="land-guarantees mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4 text-xs sm:text-sm md:grid-cols-2 md:gap-0 md:p-0 shadow-[var(--iw-shadow-card)]">
              <div className="flex items-start gap-2.5 md:p-4">
                <Lock
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--iw-semantic-action-primary)]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-[var(--iw-semantic-text-primary)]">
                    Tu historial nunca se bloquea al vencer un ciclo
                  </p>
                  <p className="mt-1 text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                    {PLAN_PROMISES.expiry}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 border-t border-[var(--iw-semantic-border-default)] pt-3 md:border-l md:border-t-0 md:p-4 md:pt-4">
                <CreditCard
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--iw-semantic-action-primary)]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-[var(--iw-semantic-text-primary)]">
                    Período prepago, sin renovación automática
                  </p>
                  <p className="mt-1 text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                    {PLAN_PROMISES.noAutoCharge}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-[var(--iw-semantic-text-secondary)]">
              {priceNote()} Los costos logísticos extraordinarios se confirman antes de contratar.{" "}
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
          className="land-section border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]"
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
                className="text-sm font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)] shrink-0"
              >
                Ver todas las preguntas e imágenes →
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="land-accordion rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]"
                >
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-page)] rounded-2xl transition-colors">
                    <span>{faq.q}</span>
                    <ChevronDown className="w-4 h-4 shrink-0 text-[var(--iw-semantic-action-primary)]" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-[var(--iw-semantic-border-default)] px-4 py-3 text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">
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
            <div className="land-close-banner overflow-hidden rounded-3xl bg-[var(--iw-color-forest-dark)] px-6 py-8 text-center text-[var(--iw-color-white)] sm:px-10 sm:py-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--iw-color-sage)]">
                5 · Comienza hoy
              </p>
              <h2
                id="acceso-heading"
                className="mx-auto mt-2 max-w-2xl font-display text-2xl font-bold leading-tight text-[var(--iw-color-white)] sm:text-3xl"
              >
                Tu granja puede estar al día hoy mismo
              </h2>

              <ol className="mx-auto mt-4 flex max-w-2xl flex-col items-center justify-center gap-2 text-xs text-[var(--iw-color-paper)] sm:flex-row sm:gap-3">
                {[
                  "Crea tu granja",
                  "Carga tus animales vivos",
                  "Anota en el galpón",
                ].map((step, index) => (
                  <li
                    key={step}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--iw-color-paper)] text-[10px] font-bold text-[var(--iw-color-ink-strong)]">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="inline-flex min-h-12 items-center gap-2 rounded-[var(--iw-radius-control)] bg-[var(--iw-color-paper)] px-6 py-3 text-sm font-bold text-[var(--iw-color-ink-strong)] hover:bg-[var(--iw-color-white)] transition shadow-sm"
                >
                  Crear mi granja gratis
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/open-source"
                  className="inline-flex min-h-12 items-center gap-2 rounded-[var(--iw-radius-control)] border border-white/25 px-5 py-3 text-sm font-semibold text-[var(--iw-color-white)] hover:bg-white/10 transition"
                >
                  Cómo funciona Open Source
                </Link>
                <a
                  href="https://github.com/Camilosal/El-Gallinero"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-[var(--iw-radius-control)] border border-white/25 px-6 py-3 text-sm font-semibold text-[var(--iw-color-white)] hover:bg-white/10 transition"
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

              <p className="mt-3 text-xs text-[var(--iw-color-sage)]">
                Plan Gratis · 1 usuario · 1 localización · sin tarjeta
              </p>
            </div>
          </div>
        </section>

        <LandingFooter />
      </ScrollReveal>
    </div>
  );
}

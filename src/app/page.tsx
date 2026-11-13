import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import MobileNav from "@/components/MobileNav";
import ScrollReveal from "@/components/ScrollReveal";
import { LandingShowcase } from "@/components/LandingShowcase";
import {
  ADOPTION_KEYS,
  AI_AUTOMATION_PILLARS,
  CYCLE_PLANS_SHOWCASE,
  SECTOR_STANDARDS,
} from "@/lib/landing-showcase";
import { APP_DEVELOPER } from "@/lib/branding";
import { LegalFooter } from "@/components/LegalFooter";
import { PLAN_PROMISES, priceNote } from "@/lib/legal";

export const dynamic = "force-dynamic";

const ESSENTIAL_MODULES = [
  {
    name: "Inicio y tareas",
    summary:
      "Avisos urgentes arriba, cifras clave del día y tareas que se validan con registros reales.",
  },
  {
    name: "Huevos e incubación",
    summary:
      "Clasificación por peso NTC 1240, salidas por orden de llegada y seguimiento de nacedoras.",
  },
  {
    name: "Aves y mamíferos",
    summary:
      "Lotes de ponedoras, pollo de engorde, codornices, patos, conejos y curíes en un solo control.",
  },
  {
    name: "Alimento y bodega",
    summary:
      "Descuento de bultos de 40 kg, días de alimento restantes, insumos y equipos.",
  },
  {
    name: "Sanidad y bioseguridad",
    summary:
      "Calendario de vacunas, control de accesos y bloqueo preventivo en tiempos de retiro.",
  },
  {
    name: "Ventas y finanzas",
    summary:
      "Registro de ventas por especie, punto de equilibrio unitario y reportes en Excel o PDF.",
  },
];

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
              <a href="#vitrina" className="hover:text-[var(--ink)] transition">
                Cómo se ve
              </a>
              <a href="#estandares" className="hover:text-[var(--ink)] transition">
                Estándares
              </a>
              <a href="#modulos" className="hover:text-[var(--ink)] transition">
                Qué incluye
              </a>
              <a href="#planes" className="hover:text-[var(--ink)] transition">
                Planes
              </a>
              <a href="#acceso" className="hover:text-[var(--ink)] transition">
                Empezar
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
          <Image
            src="/images/heroes/inicio-2x.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-right opacity-30 pointer-events-none select-none"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#132a1e]/95 via-[#132a1e]/88 to-[#132a1e]/60 pointer-events-none"
            aria-hidden="true"
          />

          <div className="land-wrap relative z-10 py-12 sm:py-16 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-6 space-y-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e7cf9e]">
                  Gestión para granjas mixtas · Iwagé
                </p>

                <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08]">
                  Tu granja al día, desde el galpón hasta las cuentas.
                </h1>

                <p className="text-base sm:text-lg text-[#e8e2d4] leading-relaxed max-w-xl">
                  Anota huevos, alimento, salud, trazabilidad y ventas desde el celular, incluso sin señal de internet en la vereda.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href="/registro"
                    className="inline-flex items-center gap-2 rounded-full bg-[#e9c46a] px-6 py-3 text-sm font-bold text-[#132a1e] hover:bg-[#f2d385] transition shadow-sm"
                  >
                    Empezar gratis (3 min)
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a
                    href="#vitrina"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-medium text-[#e8e2d4] hover:bg-white/10 transition"
                  >
                    Ver cómo se ve ↓
                  </a>
                </div>

                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs text-[#e8e2d4]">
                  <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 leading-relaxed">
                    <strong className="block text-[#e7cf9e] font-semibold mb-0.5">
                      Día 1 en 3 minutos
                    </strong>
                    Solo animales vivos de hoy; plan sanitario ICA y curva genética se precargan según la edad.
                  </li>
                  <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 leading-relaxed">
                    <strong className="block text-[#e7cf9e] font-semibold mb-0.5">
                      Sin señal y bajo el sol
                    </strong>
                    Botones amplios de alto contraste y copia local cifrada que sincroniza al volver a casa.
                  </li>
                  <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 leading-relaxed">
                    <strong className="block text-[#e7cf9e] font-semibold mb-0.5">
                      Utilidad neta al instante
                    </strong>
                    Balance del día listo para WhatsApp y alertas de ventana óptima de cosecha.
                  </li>
                </ul>
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
                <p className="mt-2.5 text-center text-xs text-[#d6dfd8]">
                  Pantalla principal organizada en 3 pasos para revisar el día sin enredos.
                </p>
              </div>
            </div>
          </div>
        </header>

        <LandingShowcase />

        <section
          id="estandares"
          className="land-section land-standards py-14 sm:py-18"
          aria-labelledby="estandares-heading"
        >
          <div className="land-wrap space-y-12">
            <div>
              <div className="max-w-2xl mb-6">
                <p className="land-eyebrow">2 · Normas y buenas prácticas</p>
                <h2 id="estandares-heading" className="land-h2">
                  Reglas del sector aplicadas de forma automática
                </h2>
                <p className="land-section-sub" style={{ marginBottom: 0 }}>
                  Clasificación comercial, bioseguridad y control de retiros funcionan en segundo plano para respaldar cada venta y certificación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SECTOR_STANDARDS.map((item) => (
                  <article
                    key={item.code}
                    className="land-reveal rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--moss)] mb-2">
                        <span className="font-semibold text-[var(--forest)]">
                          {item.code}
                        </span>
                        <span>{item.authority}</span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-[var(--ink)] leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--moss)] leading-relaxed">
                        {item.summary}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="pt-10 border-t border-[var(--line)] space-y-8">
              <div className="max-w-2xl">
                <p className="land-eyebrow">Fácil de adoptar</p>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] leading-tight">
                  Ayuda automática para registrar en menos tiempo
                </h3>
                <p className="mt-2 text-sm sm:text-base text-[var(--moss)]">
                  Diseñada para que cualquier persona en la granja pueda llevar registros claros sin llenar planillas eternas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {AI_AUTOMATION_PILLARS.map((pillar, idx) => {
                  const Icon =
                    idx === 0 ? Bot : idx === 1 ? QrCode : ShieldCheck;
                  return (
                    <article
                      key={pillar.id}
                      className="land-reveal rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--forest)] mb-2">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{pillar.eyebrow}</span>
                        </div>
                        <h4 className="font-display text-lg font-bold text-[var(--ink)]">
                          {pillar.title}
                        </h4>
                        <p className="mt-1.5 text-sm text-[var(--moss)] leading-relaxed">
                          {pillar.summary}
                        </p>
                      </div>

                      <div className="rounded-lg bg-[var(--cream)] border border-[var(--line)] px-3 py-2.5 text-xs">
                        <p className="font-medium text-[var(--ink)]">
                          {pillar.exampleInput}
                        </p>
                        <p className="text-[var(--moss)] mt-0.5">
                          → {pillar.exampleOutput}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {ADOPTION_KEYS.map((item) => (
                  <div
                    key={item.step}
                    className="land-reveal rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--moss)]">
                      <span className="font-bold text-[var(--forest)]">
                        {item.step}
                      </span>
                      <span className="truncate">{item.metric}</span>
                    </div>
                    <h4 className="font-display text-base font-bold text-[var(--ink)] leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--moss)] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="modulos" aria-labelledby="modulos-heading">
          <div className="land-historia py-14 sm:py-16">
            <div className="land-wrap">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e7cf9e]">
                    3 · Todo conectado de punta a punta
                  </p>
                  <blockquote className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug">
                    «Cada huevo, animal y bulto de concentrado mantiene su historia completa hasta la venta.»
                  </blockquote>
                  <p className="text-sm text-[#d6dfd8] leading-relaxed">
                    Al registrar una recolección, una vacuna o un despacho, la app actualiza inventarios, costos del lote y trazabilidad pública sin que tengas que repetir cuentas.
                  </p>
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <div className="rounded-xl overflow-hidden border border-white/15 bg-white p-2 shadow-lg">
                    <Image
                      src="/traceability-flow.png"
                      alt="Flujo conectado entre nacimientos, galpones, postura, sanidad, alimento y trazabilidad comercial"
                      width={1200}
                      height={620}
                      loading="lazy"
                      className="w-full h-auto rounded-lg block"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#e7cf9e] block">
                        Especies
                      </span>
                      <span className="font-semibold text-white mt-0.5 block">
                        Aves, patos, conejos y curíes
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#e7cf9e] block">
                        Ubicaciones
                      </span>
                      <span className="font-semibold text-white mt-0.5 block">
                        Galpones, corrales y ficha QR
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#e7cf9e] block">
                        Producción
                      </span>
                      <span className="font-semibold text-white mt-0.5 block">
                        Huevos, peso, cría y abono
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#e7cf9e] block">
                        Cuentas
                      </span>
                      <span className="font-semibold text-white mt-0.5 block">
                        Costos separados por especie
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="land-section land-func py-14 sm:py-16">
            <div className="land-wrap">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <h2 id="modulos-heading" className="land-h2">
                    Qué incluye el sistema
                  </h2>
                  <p className="land-section-sub" style={{ marginBottom: 0 }}>
                    Seis áreas claras que se activan según el tamaño de tu granja.
                  </p>
                </div>
                <Link
                  href="/guia"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--forest)] hover:underline shrink-0"
                >
                  <BookOpen className="w-4 h-4" />
                  Ver guía completa (14 módulos)
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {ESSENTIAL_MODULES.map((mod) => (
                  <article
                    key={mod.name}
                    className="land-reveal rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
                  >
                    <h3 className="font-display text-base sm:text-lg font-bold text-[var(--ink)]">
                      {mod.name}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-[var(--moss)] leading-relaxed">
                      {mod.summary}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="planes"
          className="land-section bg-[var(--cream)] border-t border-[var(--line)] py-14 sm:py-18"
          aria-labelledby="planes-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-8">
              <p className="land-eyebrow">4 · Planes por ciclo productivo</p>
              <h2 id="planes-heading" className="land-h2">
                Paga por cosecha o usa 1 lote gratis, sin secuestro de tus datos
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Inicias gratis 30 días sin tarjeta. Después renuevas solo cuando tengas ciclo activo con Nequi, Daviplata o PSE, o sigues gratis con 1 lote activo.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {CYCLE_PLANS_SHOWCASE.map((plan) => (
                <article
                  key={plan.id}
                  className={`land-reveal rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4 ${
                    plan.featured
                      ? "border-[var(--forest)] bg-white shadow-sm"
                      : "border-[var(--line)] bg-[var(--paper)]"
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

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <p className="font-semibold text-[var(--ink)]">
                  Pagos locales sin tarjeta de crédito
                </p>
                <p className="mt-1 text-[var(--moss)] leading-relaxed">
                  Renueva en segundos por Nequi, Daviplata o PSE (vía Wompi) según tu ciclo de producción. {PLAN_PROMISES.noAutoCharge}
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--ink)]">
                  Respeto total por tu trabajo e historial
                </p>
                <p className="mt-1 text-[var(--moss)] leading-relaxed">
                  {PLAN_PROMISES.expiry}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="acceso"
          className="land-section land-cierre py-14 sm:py-18"
          aria-labelledby="acceso-heading"
        >
          <div className="land-wrap">
            <div className="max-w-2xl mb-8">
              <p className="land-eyebrow">5 · Comienza hoy</p>
              <h2 id="acceso-heading" className="land-h2">
                Tu granja configurada hoy en 3 pasos simples
              </h2>
              <ol className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 list-none p-0">
                {[
                  "Crea tu granja aislada, sin tarjeta",
                  "Carga solo tus animales vivos y los bultos en bodega",
                  "Registra en el galpón, con o sin señal",
                ].map((step, i) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3.5 py-3 text-sm text-[var(--ink)]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-xs font-bold text-white"
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 flex flex-col justify-between gap-5">
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--forest)]">
                    Acceso directo · 30 días gratis
                  </span>
                  <h3 className="font-display text-xl font-bold text-[var(--ink)] mt-1">
                    Crea tu granja gratis o entra a tu cuenta
                  </h3>
                  <p className="mt-2 text-sm text-[var(--moss)] leading-relaxed">
                    Empieza tu prueba Semilla de 30 días en 3 minutos, recibe el plan sanitario ICA precargado para tu lote y consulta tu utilidad neta desde la primera jornada.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/registro"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--forest)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--forest-deep)] transition"
                  >
                    Crear mi granja gratis (30 días)
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--forest)] px-5 py-2.5 text-sm font-semibold text-[var(--forest)] hover:bg-[var(--paper)] transition"
                  >
                    Ya tengo cuenta · Entrar
                  </Link>
                  <Link
                    href="/guia"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] transition"
                  >
                    Leer manual de uso
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 flex flex-col justify-between gap-5">
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--moss)]">
                    Código abierto
                  </span>
                  <h3 className="font-display text-xl font-bold text-[var(--ink)] mt-1">
                    Código abierto y autohospedaje libre
                  </h3>
                  <p className="mt-2 text-sm text-[var(--moss)] leading-relaxed">
                    ¿Administrarás el servidor propio de tu asociación, universidad o granja? Descarga el código completo, esquemas multi-tenant e instalador técnico en GitHub.
                  </p>
                </div>
                <div>
                  <a
                    href="https://github.com/Camilosal/El-Gallinero"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] transition"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 fill-current shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2.14c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15v3.19c0 .31.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                    </svg>
                    Ver repositorio en GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="land-footer py-8 border-t border-[var(--line)]">
          <div className="land-wrap flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--moss)]">
            <div className="space-y-1">
              <div>
                <span className="font-semibold text-[var(--ink)]">
                  El Gallinero · Iwagé Granja
                </span>
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                <span>Gestión para granjas mixtas en Colombia</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Desarrollado por</span>
                <a
                  href={APP_DEVELOPER.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--ink)] hover:text-[var(--forest)] underline underline-offset-2"
                >
                  {APP_DEVELOPER.name}
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href={APP_DEVELOPER.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--ink)]"
                >
                  {APP_DEVELOPER.domain}
                </a>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 font-medium">
              <Link href="/registro" className="hover:text-[var(--ink)]">
                Crear granja gratis
              </Link>
              <Link href="/login" className="hover:text-[var(--ink)]">
                Entrar
              </Link>
              <Link href="/guia" className="hover:text-[var(--ink)]">
                Guía de uso
              </Link>
              <a
                href={APP_DEVELOPER.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--ink)]"
              >
                {APP_DEVELOPER.domain}
              </a>
              <a
                href="https://github.com/Camilosal/El-Gallinero"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--ink)]"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
        <LegalFooter />
      </ScrollReveal>
    </div>
  );
}

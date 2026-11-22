"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Layers,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import {
  GUIDE_WORKFLOWS,
  getGuide,
  getGuidePreviewImage,
  guideModules,
  guides,
  searchGuides,
} from "@/lib/guide-data";

interface GuideIndexViewProps {
  basePath: "/guia" | "/manual";
}

export function GuideIndexView({ basePath }: GuideIndexViewProps) {
  const [query, setQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");

  const visibleGuides = useMemo(
    () => searchGuides(query, selectedModule),
    [query, selectedModule],
  );

  const groupedResults = useMemo(() => {
    const modSource =
      selectedModule === "all"
        ? guideModules
        : guideModules.filter((m) => m.id === selectedModule);

    return modSource
      .map((mod) => ({
        ...mod,
        items: visibleGuides.filter((g) => g.module === mod.id),
      }))
      .filter((mod) => mod.items.length > 0);
  }, [selectedModule, visibleGuides]);

  const activeFilters = Boolean(query.trim()) || selectedModule !== "all";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <HeroBanner
        theme="guia"
        icon={<BookOpen className="h-3.5 w-3.5 text-[var(--iw-color-paper)]" aria-hidden="true" />}
        eyebrow="Centro de aprendizaje · IwaGranja"
        title="Guía completa de uso del sistema"
        description="Recorre cada pantalla con capturas reales, pasos claros y flujos de trabajo alineados con tu barra lateral, escáner QR, modo offline e interfaz actual."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs">
            <Layers className="h-3.5 w-3.5 text-[var(--iw-color-paper)]" aria-hidden="true" />
            {guideModules.filter((m) => m.kind === "modulo").length} módulos de la app + {guideModules.filter((m) => m.kind === "complementario").length} complementarios · {guides.length} guías ilustradas
          </span>
        }
      />

      {/* Buscador y filtros rápidos por categoría */}
      <section aria-label="Filtros del manual" className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4 shadow-2xs sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--iw-semantic-text-secondary)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtra por tema o función: ej. QR, offline, voz, peso, CxC, incubación, soberanía..."
              aria-label="Filtrar guías del manual"
              className="w-full rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] py-2.5 pl-10 pr-9 text-sm text-[var(--iw-semantic-text-primary)] transition-colors focus:border-[var(--iw-semantic-border-strong)] focus:bg-[var(--iw-semantic-bg-surface)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar filtro de búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--iw-semantic-text-secondary)] hover:bg-[var(--iw-semantic-bg-page)] hover:text-[var(--iw-semantic-text-primary)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-[var(--iw-semantic-text-secondary)] sm:justify-end">
            <span>
              <strong className="text-[var(--iw-semantic-text-primary)]">{visibleGuides.length}</strong> de {guides.length} guías
            </span>
            {activeFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedModule("all");
                }}
                className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-1.5 font-medium text-[var(--iw-semantic-text-primary)] transition-colors hover:bg-[var(--iw-semantic-bg-subtle)] cursor-pointer"
              >
                Reiniciar filtros
              </button>
            )}
          </div>
        </div>

        {/* Píldoras de módulo */}
        <div
          role="tablist"
          aria-label="Filtrar por módulo"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedModule === "all"}
            onClick={() => setSelectedModule("all")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              selectedModule === "all"
                ? "border-[var(--iw-semantic-border-strong)] bg-[var(--iw-semantic-action-primary)] text-white shadow-2xs"
                : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-subtle)]"
            }`}
          >
            <span>Todos</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedModule === "all" ? "bg-white/20 text-white" : "bg-[var(--iw-semantic-bg-page)] text-[var(--iw-semantic-text-secondary)]"
              }`}
            >
              {guides.length}
            </span>
          </button>

          {guideModules.map((mod) => {
            const active = selectedModule === mod.id;
            const modCount = guides.filter((g) => g.module === mod.id).length;
            return (
              <button
                key={mod.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedModule(mod.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? "border-[var(--iw-semantic-border-strong)] bg-[var(--iw-semantic-action-primary)] text-white shadow-2xs"
                    : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-subtle)]"
                }`}
              >
                <AppIcon icon={mod.icon} className="h-3.5 w-3.5" />
                <span>{mod.label}</span>
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-[var(--iw-semantic-bg-page)] text-[var(--iw-semantic-text-secondary)]"
                  }`}
                >
                  {modCount}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recorridos guiados recomendados (visibles cuando no hay búsqueda activa) */}
      {!activeFilters && (
        <section aria-labelledby="recorridos-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 id="recorridos-heading" className="flex items-center gap-2 text-lg font-bold text-[var(--iw-semantic-text-primary)]">
                <Sparkles className="h-4 w-4 text-[var(--iw-semantic-status-warning)]" aria-hidden="true" />
                <span>Recorridos recomendados según tu labor</span>
              </h2>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] sm:text-sm">
                Rutas directas que enlazan las pantallas clave para cada rutina del galpón.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {GUIDE_WORKFLOWS.map((flow) => (
              <div
                key={flow.id}
                className="flex flex-col justify-between min-w-0 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3 sm:p-5 shadow-2xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                      <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)] border border-[var(--iw-semantic-border-default)]">
                        <AppIcon icon={flow.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--iw-semantic-status-warning)] border border-[var(--iw-color-ochre)]/45">
                          {flow.badge}
                        </span>
                        <h3 className="mt-1 text-xs sm:text-base font-bold text-[var(--iw-semantic-text-primary)] leading-snug">{flow.title}</h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] sm:text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)] line-clamp-2 sm:line-clamp-none">
                    {flow.description}
                  </p>
                </div>

                <div className="mt-3 sm:mt-4 flex flex-wrap gap-1 sm:gap-1.5 border-t border-[var(--iw-semantic-border-default)] pt-2.5 sm:pt-3">
                  {flow.slugs.map((slug, idx) => {
                    const target = getGuide(slug);
                    if (!target) return null;
                    return (
                      <Link
                        key={slug}
                        href={`${basePath}/${target.slug}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-[var(--iw-semantic-text-primary)] transition-colors hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-feature)] hover:text-[var(--iw-semantic-action-primary-hover)]"
                      >
                        <span className="font-bold text-[var(--iw-semantic-action-primary)]">{idx + 1}.</span>
                        <span className="truncate max-w-[115px] sm:max-w-none">{target.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Listado completo por módulo con previsualización de capturas */}
      {groupedResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-6 py-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-[var(--iw-semantic-border-default)]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-[var(--iw-semantic-text-primary)]">
            No encontramos guías con ese filtro
          </h2>
          <p className="mt-1 text-sm text-[var(--iw-semantic-text-secondary)]">
            Intenta buscar por módulo o limpia la búsqueda para explorar las {guides.length} guías disponibles.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedResults.map((mod) => (
            <section key={mod.id} aria-labelledby={`mod-${mod.id}`} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--iw-semantic-border-default)] pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)] shadow-2xs">
                    <AppIcon icon={mod.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id={`mod-${mod.id}`} className="text-lg font-bold text-[var(--iw-semantic-text-primary)] sm:text-xl">
                        {mod.label}
                      </h2>
                      {mod.kind === "complementario" && (
                        <span className="rounded-full bg-[var(--iw-semantic-bg-page)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-primary)]">
                          Complementario
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--iw-semantic-text-secondary)] sm:text-sm">{mod.description}</p>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--iw-semantic-bg-page)] px-3 py-1 text-xs font-semibold text-[var(--iw-semantic-text-secondary)]">
                  {mod.items.length} {mod.items.length === 1 ? "guía" : "guías"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
                {mod.items.map((guide) => {
                  const preview = getGuidePreviewImage(guide);
                  return (
                    <Link
                      key={guide.slug}
                      href={`${basePath}/${guide.slug}`}
                      className="group flex flex-col min-w-0 overflow-hidden rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-2xs transition-all hover:-translate-y-0.5 hover:border-[var(--iw-semantic-border-strong)] hover:shadow-md"
                    >
                      {preview && (
                        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preview.src}
                            alt={preview.alt}
                            loading="lazy"
                            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                          <span className="absolute right-1.5 sm:right-2.5 top-1.5 sm:top-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--iw-color-ink-strong)]/80 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-[var(--iw-color-white)] backdrop-blur-xs">
                            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                            {guide.estimatedMinutes} min
                          </span>
                        </div>
                      )}

                      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-4 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-start gap-2 sm:gap-2.5">
                            <span className="mt-0.5 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)] border border-[var(--iw-semantic-border-default)] group-hover:bg-[var(--iw-semantic-action-primary)] group-hover:text-white transition-colors">
                              <AppIcon icon={guide.icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </span>
                            <h3 className="text-xs sm:text-base font-bold leading-snug text-[var(--iw-semantic-text-primary)] group-hover:text-[var(--iw-semantic-action-primary)] line-clamp-2">
                              {guide.title}
                            </h3>
                          </div>

                          <p className="mt-1.5 sm:mt-2 line-clamp-2 text-[11px] sm:text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)]">
                            {guide.summary}
                          </p>
                        </div>

                        <div className="mt-2.5 sm:mt-4 flex items-center justify-between gap-1.5 sm:gap-2 border-t border-[var(--iw-semantic-border-default)] pt-2 sm:pt-3">
                          <div className="hidden sm:flex flex-wrap gap-1">
                            {guide.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-[var(--iw-semantic-bg-page)] px-2 py-0.5 text-[10px] font-medium text-[var(--iw-semantic-text-secondary)]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] sm:text-xs font-semibold text-[var(--iw-semantic-action-primary)] group-hover:translate-x-0.5 transition-transform ml-auto sm:ml-0">
                            <span>Leer</span>
                            <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}


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
  basePath: "/guia" | "/dashboard/guia";
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
        icon={<BookOpen className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />}
        eyebrow="Centro de aprendizaje · El Gallinero"
        title="Guía completa de uso del sistema"
        description="Recorre cada pantalla con capturas reales, pasos claros y flujos de trabajo alineados con tu barra lateral, escáner QR, modo offline e interfaz actual."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs">
            <Layers className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
            {guideModules.length} módulos · {guides.length} guías ilustradas
          </span>
        }
      />

      {/* Buscador y filtros rápidos por categoría */}
      <section aria-label="Filtros del manual" className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtra por tema o función: ej. QR, offline, voz, peso, CxC, incubación, soberanía..."
              aria-label="Filtrar guías del manual"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-900 transition-colors focus:border-green-600 focus:bg-white focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar filtro de búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-slate-500 sm:justify-end">
            <span>
              <strong className="text-slate-800">{visibleGuides.length}</strong> de {guides.length} guías
            </span>
            {activeFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedModule("all");
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
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
                ? "border-green-700 bg-green-700 text-white shadow-2xs"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>Todos</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedModule === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
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
                    ? "border-green-700 bg-green-700 text-white shadow-2xs"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <AppIcon icon={mod.icon} className="h-3.5 w-3.5" />
                <span>{mod.label}</span>
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
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
              <h2 id="recorridos-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <span>Recorridos recomendados según tu labor</span>
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Rutas directas que enlazan las pantallas clave para cada rutina del galpón.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {GUIDE_WORKFLOWS.map((flow) => (
              <div
                key={flow.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-800 border border-green-100">
                        <AppIcon icon={flow.icon} className="h-5 w-5" />
                      </span>
                      <div>
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                          {flow.badge}
                        </span>
                        <h3 className="mt-1 text-base font-bold text-slate-900">{flow.title}</h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                    {flow.description}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                  {flow.slugs.map((slug, idx) => {
                    const target = getGuide(slug);
                    if (!target) return null;
                    return (
                      <Link
                        key={slug}
                        href={`${basePath}/${target.slug}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-900"
                      >
                        <span className="font-bold text-green-700">{idx + 1}.</span>
                        <span>{target.title}</span>
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-slate-800">
            No encontramos guías con ese filtro
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Intenta buscar por módulo o limpia la búsqueda para explorar las {guides.length} guías disponibles.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedResults.map((mod) => (
            <section key={mod.id} aria-labelledby={`mod-${mod.id}`} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-800 text-amber-200 shadow-2xs">
                    <AppIcon icon={mod.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 id={`mod-${mod.id}`} className="text-lg font-bold text-slate-900 sm:text-xl">
                      {mod.label}
                    </h2>
                    <p className="text-xs text-slate-500 sm:text-sm">{mod.description}</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {mod.items.length} {mod.items.length === 1 ? "guía" : "guías"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {mod.items.map((guide) => {
                  const preview = getGuidePreviewImage(guide);
                  return (
                    <Link
                      key={guide.slug}
                      href={`${basePath}/${guide.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition-all hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
                    >
                      {preview && (
                        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-slate-100 bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preview.src}
                            alt={preview.alt}
                            loading="lazy"
                            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/75 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                            {guide.estimatedMinutes} min
                          </span>
                        </div>
                      )}

                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-800 border border-green-100 group-hover:bg-green-700 group-hover:text-white transition-colors">
                              <AppIcon icon={guide.icon} className="h-4 w-4" />
                            </span>
                            <h3 className="text-sm font-bold leading-snug text-slate-900 group-hover:text-green-800 sm:text-base">
                              {guide.title}
                            </h3>
                          </div>

                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                            {guide.summary}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <div className="flex flex-wrap gap-1">
                            {guide.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-green-700 group-hover:translate-x-0.5 transition-transform">
                            <span>Leer</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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


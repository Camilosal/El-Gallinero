"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Info,
  Lightbulb,
  ListChecks,
  Maximize2,
  Monitor,
  Tag,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import { GuideDiagram } from "@/components/guide/GuideDiagram";
import {
  GuideScreenshotLightbox,
  type LightboxImage,
} from "@/components/guide/GuideScreenshotLightbox";
import {
  getAdjacentGuides,
  getGuide,
  guideModules,
  type GuideSection,
} from "@/lib/guide-data";
import { getGuideHeroTheme } from "@/lib/hero-themes";

interface GuideArticleViewProps {
  slug: string;
  basePath: "/guia" | "/dashboard/guia";
}

function sectionAnchorLabel(section: GuideSection, index: number): string {
  if (section.title) return section.title;
  switch (section.type) {
    case "intro":
      return "Resumen general";
    case "screenshot":
      return "Captura de pantalla";
    case "steps":
      return "Paso a paso";
    case "diagram":
      return "Flujo del módulo";
    case "tip":
      return "Consejo práctico";
    case "warning":
      return "Precaución importante";
    case "note":
      return "Nota de alcance";
    default:
      return `Sección ${index + 1}`;
  }
}

export function GuideArticleView({ slug, basePath }: GuideArticleViewProps) {
  const guide = getGuide(slug);
  const [zoomImage, setZoomImage] = useState<LightboxImage | null>(null);

  if (!guide) {
    notFound();
  }

  const mod = guideModules.find((m) => m.id === guide.module);
  const { prev, next } = getAdjacentGuides(slug);
  const heroTheme = getGuideHeroTheme(guide.module);

  const tocItems = useMemo(
    () =>
      guide.sections.map((section, idx) => ({
        id: `sec-${idx + 1}`,
        label: sectionAnchorLabel(section, idx),
        type: section.type,
      })),
    [guide.sections],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Miga de pan */}
      <nav aria-label="Ruta actual en el manual" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href={basePath} className="font-medium transition-colors hover:text-green-700">
          Manual de Uso
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <span className="font-medium text-slate-600">{mod?.label || guide.module}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <span className="font-semibold text-slate-900">{guide.title}</span>
      </nav>

      <HeroBanner
        theme={heroTheme}
        compact
        icon={<AppIcon icon={guide.icon} className="h-3.5 w-3.5 text-amber-200" />}
        eyebrow={`${mod?.label || guide.module} · Guía ilustrada`}
        title={guide.title}
        description={guide.summary}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs">
            <Clock className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
            Lectura: {guide.estimatedMinutes} min
          </span>
        }
      />

      {/* Accesos directos al módulo dentro del sistema */}
      {guide.relatedHrefs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200/80 bg-green-50/70 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-900">
            <Monitor className="h-4 w-4 text-green-700 shrink-0" aria-hidden="true" />
            <span>Ir directo en la aplicación:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {guide.relatedHrefs.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-xl border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-800 shadow-2xs transition-colors hover:bg-green-700 hover:text-white hover:border-green-700"
              >
                <span>{link.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Cuerpo en dos columnas en escritorio amplio: contenido + TOC fijo */}
      <div className="flex items-start gap-8">
        <article className="min-w-0 flex-1 space-y-6">
          {guide.sections.map((section, idx) => {
            const anchorId = `sec-${idx + 1}`;
            return (
              <section key={anchorId} id={anchorId} className="scroll-mt-24">
                {section.type === "intro" && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
                    <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                      {section.text}
                    </p>
                  </div>
                )}

                {section.type === "screenshot" && section.image && (
                  <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex items-center gap-1" aria-hidden="true">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
                          {section.title || "Vista real en la aplicación"}
                        </span>
                        {section.badge && (
                          <span className="hidden sm:inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                            {section.badge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {section.targetHref && (
                          <Link
                            href={section.targetHref}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-green-300 hover:text-green-800"
                          >
                            <span>{section.targetLabel || "Abrir"}</span>
                            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setZoomImage({
                              src: section.image!,
                              alt: section.alt || section.title || guide.title,
                              title: section.title || guide.title,
                              caption: section.caption || "",
                              badge: section.badge,
                              targetHref: section.targetHref,
                              targetLabel: section.targetLabel,
                            })
                          }
                          aria-label={`Ampliar captura: ${section.title || guide.title}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-green-800 cursor-pointer"
                        >
                          <Maximize2 className="h-3 w-3" aria-hidden="true" />
                          <span>Ampliar</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setZoomImage({
                          src: section.image!,
                          alt: section.alt || section.title || guide.title,
                          title: section.title || guide.title,
                          caption: section.caption || "",
                          badge: section.badge,
                          targetHref: section.targetHref,
                          targetLabel: section.targetLabel,
                        })
                      }
                      className="group relative block w-full bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={section.image}
                        alt={section.alt || section.title || guide.title}
                        className="block h-auto w-full object-cover transition-opacity group-hover:opacity-95"
                      />
                    </button>

                    {section.caption && (
                      <figcaption className="border-t border-slate-100 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600 sm:text-sm">
                        {section.caption}
                      </figcaption>
                    )}
                  </figure>
                )}

                {section.type === "diagram" && section.nodes && section.connections && (
                  <GuideDiagram
                    title={section.title}
                    nodes={section.nodes}
                    connections={section.connections}
                  />
                )}

                {section.type === "steps" && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
                    {section.title && (
                      <h2 className="mb-4 flex items-center gap-2.5 text-base font-bold text-slate-900 sm:text-lg">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-green-800">
                          <ListChecks className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>{section.title}</span>
                      </h2>
                    )}
                    <ol className="space-y-3">
                      {section.items?.map((item, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-3.5 rounded-xl bg-slate-50/80 p-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white shadow-2xs">
                            {sIdx + 1}
                          </span>
                          <span className="text-sm leading-relaxed text-slate-700">{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {section.type === "tip" && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                      <div>
                        {section.title && (
                          <h3 className="mb-1 text-sm font-bold text-amber-950">{section.title}</h3>
                        )}
                        <p className="text-sm leading-relaxed text-amber-900">{section.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                {section.type === "warning" && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                      <div>
                        {section.title && (
                          <h3 className="mb-1 text-sm font-bold text-rose-950">{section.title}</h3>
                        )}
                        <p className="text-sm leading-relaxed text-rose-900">{section.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                {section.type === "note" && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/85 p-5">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
                      <div>
                        {section.title && (
                          <h3 className="mb-1 text-sm font-bold text-sky-950">{section.title}</h3>
                        )}
                        <p className="text-sm leading-relaxed text-sky-900">{section.text}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {/* Etiquetas temáticas al pie */}
          {guide.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              <Tag className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="font-semibold text-slate-700">Temas clave:</span>
              {guide.tags.map((tag) => (
                <span key={tag} className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Navegación anterior / siguiente */}
          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`${basePath}/${prev.slug}`}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-green-300 hover:bg-green-50/40"
              >
                <ArrowLeft
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5 group-hover:text-green-700"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Guía anterior
                  </p>
                  <p className="truncate text-sm font-bold text-slate-800 group-hover:text-green-800">
                    {prev.title}
                  </p>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {next && (
              <Link
                href={`${basePath}/${next.slug}`}
                className="group flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-2xs transition-all hover:border-green-300 hover:bg-green-50/40"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Siguiente guía
                  </p>
                  <p className="truncate text-sm font-bold text-slate-800 group-hover:text-green-800">
                    {next.title}
                  </p>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-green-700"
                  aria-hidden="true"
                />
              </Link>
            )}
          </div>
        </article>

        {/* Tabla de contenidos lateral en escritorio amplio */}
        <aside className="hidden w-64 shrink-0 xl:block">
          <div className="guide-scroll-pane sticky top-20 max-h-[calc(100dvh-6rem)] space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <nav aria-label="Contenido de esta guía" className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                En esta guía
              </p>
              <ul className="space-y-1 border-l border-slate-200 pl-3 text-xs">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block rounded-md py-1 text-slate-600 transition-colors hover:text-green-800"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {guide.relatedHrefs.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Módulos relacionados
                </p>
                <div className="space-y-1.5">
                  {guide.relatedHrefs.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-green-200 hover:bg-green-50 hover:text-green-900"
                    >
                      <span className="truncate">{link.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <GuideScreenshotLightbox image={zoomImage} onClose={() => setZoomImage(null)} />
    </div>
  );
}


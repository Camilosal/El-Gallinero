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
  basePath: "/guia" | "/manual";
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

  const isDashboard = basePath.startsWith("/manual");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Miga de pan (en ruta pública; el dashboard ya muestra DashboardBreadcrumb superior) */}
      {!isDashboard && (
        <nav aria-label="Ruta actual en el manual" className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--iw-semantic-text-secondary)]">
          <Link href={basePath} className="font-medium transition-colors hover:text-[var(--iw-semantic-action-primary-hover)]">
            Manual de Uso
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
          <span className="font-medium text-[var(--iw-semantic-text-secondary)]">{mod?.label || guide.module}</span>
          <ChevronRight className="h-3.5 w-3.5 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
          <span className="font-semibold text-[var(--iw-semantic-text-primary)]">{guide.title}</span>
        </nav>
      )}

      <HeroBanner
        theme={heroTheme}
        compact
        icon={<AppIcon icon={guide.icon} className="h-3.5 w-3.5 text-[var(--iw-color-paper)]" />}
        eyebrow={`${mod?.label || guide.module} · Guía ilustrada`}
        title={guide.title}
        description={guide.summary}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs">
            <Clock className="h-3.5 w-3.5 text-[var(--iw-color-paper)]" aria-hidden="true" />
            Lectura: {guide.estimatedMinutes} min
          </span>
        }
      />

      {/* Accesos directos al módulo dentro del sistema */}
      {guide.relatedHrefs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
            <Monitor className="h-4 w-4 text-[var(--iw-semantic-action-primary)] shrink-0" aria-hidden="true" />
            <span>Ir directo en la aplicación:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {guide.relatedHrefs.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--iw-semantic-action-primary)] shadow-2xs transition-colors hover:bg-[var(--iw-semantic-action-primary)] hover:text-white hover:border-[var(--iw-semantic-border-strong)]"
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
                  <div className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-2xs sm:p-6">
                    <p className="text-sm leading-relaxed text-[var(--iw-semantic-text-primary)] sm:text-base">
                      {section.text}
                    </p>
                  </div>
                )}

                {section.type === "screenshot" && section.image && (
                  <figure className="overflow-hidden rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex items-center gap-1" aria-hidden="true">
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--iw-color-terracotta)]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--iw-color-ochre)]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--iw-color-forest)]" />
                        </span>
                        <span className="truncate text-xs font-semibold text-[var(--iw-semantic-text-primary)] sm:text-sm">
                          {section.title || "Vista real en la aplicación"}
                        </span>
                        {section.badge && (
                          <span className="hidden sm:inline-flex rounded-full bg-[var(--iw-semantic-bg-feature)] px-2 py-0.5 text-[10px] font-semibold text-[var(--iw-semantic-action-primary)]">
                            {section.badge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {section.targetHref && (
                          <Link
                            href={section.targetHref}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--iw-semantic-text-primary)] transition-colors hover:border-[var(--iw-semantic-border-strong)] hover:text-[var(--iw-semantic-action-primary-hover)]"
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
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--iw-semantic-action-primary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--iw-semantic-action-primary-text)] transition-colors hover:bg-[var(--iw-semantic-action-primary-hover)] cursor-pointer"
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
                      className="group relative block w-full bg-[var(--iw-semantic-bg-page)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iw-semantic-focus-ring)] cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={section.image}
                        alt={section.alt || section.title || guide.title}
                        className="block h-auto w-full object-cover transition-opacity group-hover:opacity-95"
                      />
                    </button>

                    {section.caption && (
                      <figcaption className="border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-4 py-3 text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)] sm:text-sm">
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
                  <div className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-2xs sm:p-6">
                    {section.title && (
                      <h2 className="mb-4 flex items-center gap-2.5 text-base font-bold text-[var(--iw-semantic-text-primary)] sm:text-lg">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)]">
                          <ListChecks className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>{section.title}</span>
                      </h2>
                    )}
                    <ol className="space-y-3">
                      {section.items?.map((item, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-3.5 rounded-xl bg-[var(--iw-semantic-bg-subtle)] p-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--iw-semantic-action-primary)] text-xs font-bold text-white shadow-2xs">
                            {sIdx + 1}
                          </span>
                          <span className="text-sm leading-relaxed text-[var(--iw-semantic-text-primary)]">{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {section.type === "tip" && (
                  <div className="rounded-2xl border border-[var(--iw-color-ochre)]/45 bg-[var(--iw-semantic-bg-subtle)] p-5">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--iw-semantic-status-warning)]" aria-hidden="true" />
                      <div>
                        {section.title && (
                          <h3 className="mb-1 text-sm font-bold text-[var(--iw-semantic-text-primary)]">{section.title}</h3>
                        )}
                        <p className="text-sm leading-relaxed text-[var(--iw-semantic-text-primary)]">{section.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                {section.type === "warning" && (
                  <div className="rounded-2xl border border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-semantic-bg-subtle)] p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--iw-semantic-status-danger)]" aria-hidden="true" />
                      <div>
                        {section.title && (
                          <h3 className="mb-1 text-sm font-bold text-[var(--iw-semantic-text-primary)]">{section.title}</h3>
                        )}
                        <p className="text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">{section.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                {section.type === "note" && (
                  <div className="rounded-2xl border border-[var(--iw-semantic-status-info)]/40 bg-[var(--iw-semantic-bg-subtle)] p-5">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--iw-semantic-status-info)]" aria-hidden="true" />
                      <div>
                        {section.title && (
                          <h3 className="mb-1 text-sm font-bold text-[var(--iw-semantic-text-primary)]">{section.title}</h3>
                        )}
                        <p className="text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">{section.text}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {/* Etiquetas temáticas al pie */}
          {guide.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-4 py-3 text-xs text-[var(--iw-semantic-text-secondary)]">
              <Tag className="h-3.5 w-3.5 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
              <span className="font-semibold text-[var(--iw-semantic-text-primary)]">Temas clave:</span>
              {guide.tags.map((tag) => (
                <span key={tag} className="rounded-lg bg-[var(--iw-semantic-bg-page)] px-2.5 py-0.5 font-medium text-[var(--iw-semantic-text-secondary)]">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Navegación anterior / siguiente */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 border-t border-[var(--iw-semantic-border-default)] pt-6">
            {prev ? (
              <Link
                href={`${basePath}/${prev.slug}`}
                className="group flex items-center gap-2 sm:gap-3 min-w-0 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3 sm:p-4 shadow-2xs transition-all hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-feature)]"
              >
                <ArrowLeft
                  className="h-4 w-4 shrink-0 text-[var(--iw-semantic-text-secondary)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--iw-semantic-action-primary)]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">
                    Anterior
                  </p>
                  <p className="truncate text-xs sm:text-sm font-bold text-[var(--iw-semantic-text-primary)] group-hover:text-[var(--iw-semantic-action-primary)]">
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
                className="group flex items-center justify-end gap-2 sm:gap-3 min-w-0 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3 sm:p-4 text-right shadow-2xs transition-all hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-feature)]"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">
                    Siguiente guía
                  </p>
                  <p className="truncate text-sm font-bold text-[var(--iw-semantic-text-primary)] group-hover:text-[var(--iw-semantic-action-primary)]">
                    {next.title}
                  </p>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-[var(--iw-semantic-text-secondary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--iw-semantic-action-primary)]"
                  aria-hidden="true"
                />
              </Link>
            )}
          </div>
        </article>

        {/* Tabla de contenidos lateral en escritorio amplio */}
        <aside className="hidden w-64 shrink-0 xl:block">
          <div className="guide-scroll-pane sticky top-20 max-h-[calc(100dvh-6rem)] space-y-5 overflow-y-auto rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4 shadow-2xs">
            <nav aria-label="Contenido de esta guía" className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]">
                En esta guía
              </p>
              <ul className="space-y-1 border-l border-[var(--iw-semantic-border-default)] pl-3 text-xs">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block rounded-md py-1 text-[var(--iw-semantic-text-secondary)] transition-colors hover:text-[var(--iw-semantic-action-primary-hover)]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {guide.relatedHrefs.length > 0 && (
              <div className="border-t border-[var(--iw-semantic-border-default)] pt-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]">
                  Módulos relacionados
                </p>
                <div className="space-y-1.5">
                  {guide.relatedHrefs.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-2 text-xs font-medium text-[var(--iw-semantic-text-primary)] transition-colors hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-feature)] hover:text-[var(--iw-semantic-action-primary-hover)]"
                    >
                      <span className="truncate">{link.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
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


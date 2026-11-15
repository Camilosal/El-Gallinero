"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SectorStandardItem, StandardDiagramType } from "@/lib/landing-showcase";

function StandardDiagram({
  type,
  steps,
}: {
  type: StandardDiagramType;
  steps: [string, string, string];
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[#fbf7ee] p-4 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--forest)]">
          Flujo en El Corral
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-900">
          Regla automática
        </span>
      </div>

      {/* Visual SVG schematic tailored per normative domain */}
      <div className="rounded-lg border border-[var(--line)] bg-white p-3">
        <svg
          viewBox="0 0 360 112"
          className="w-full h-auto"
          role="img"
          aria-label={`Diagrama de flujo: ${steps.join(" → ")}`}
        >
          {/* Connection arrows */}
          <line x1="108" y1="42" x2="128" y2="42" stroke="#132a1e" strokeWidth="1.75" strokeDasharray="3 2" />
          <polygon points="126,38 133,42 126,46" fill="#132a1e" />
          <line x1="232" y1="42" x2="252" y2="42" stroke="#132a1e" strokeWidth="1.75" strokeDasharray="3 2" />
          <polygon points="250,38 257,42 250,46" fill="#132a1e" />

          {/* Step 1 box */}
          <rect x="6" y="12" width="102" height="60" rx="8" fill="#f7f4eb" stroke="#d5ccb8" strokeWidth="1.2" />
          <circle cx="22" cy="28" r="8" fill="#132a1e" />
          <text x="22" y="31.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="monospace">
            1
          </text>
          <text x="36" y="31" fill="#132a1e" fontSize="9.5" fontWeight="700">
            {type === "egg-peps" && "Recolección"}
            {type === "biosecurity" && "Acceso"}
            {type === "welfare" && "Condición"}
            {type === "withdrawal" && "Tratamiento"}
            {type === "compost" && "Pila C/N"}
            {type === "finance" && "Gastos"}
          </text>
          <text x="14" y="50" fill="#4a5340" fontSize="8.5">
            {type === "egg-peps" && "Sin rotos a bodega"}
            {type === "biosecurity" && "Arco + visitantes"}
            {type === "welfare" && "Agua y espacio"}
            {type === "withdrawal" && "Dosis registrada"}
            {type === "compost" && "Mortalidad + cama"}
            {type === "finance" && "Directo + común"}
          </text>

          {/* Step 2 box */}
          <rect x="133" y="12" width="99" height="60" rx="8" fill="#fef8e8" stroke="#c8922d" strokeWidth="1.4" />
          <circle cx="149" cy="28" r="8" fill="#b47b19" />
          <text x="149" y="31.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="monospace">
            2
          </text>
          <text x="163" y="31" fill="#5c3d08" fontSize="9.5" fontWeight="700">
            {type === "egg-peps" && "NTC 1240"}
            {type === "biosecurity" && "Aislamiento"}
            {type === "welfare" && "Evaluación"}
            {type === "withdrawal" && "Retiro activo"}
            {type === "compost" && "8 semanas"}
            {type === "finance" && "Prorrateo"}
          </text>
          <text x="141" y="50" fill="#6b4e16" fontSize="8.5">
            {type === "egg-peps" && "Jumbo → C · 30u"}
            {type === "biosecurity" && "Separa especies"}
            {type === "welfare" && "POE por especie"}
            {type === "withdrawal" && "Cuenta regresiva"}
            {type === "compost" && "Volteos y T°"}
            {type === "finance" && "Costo / unidad"}
          </text>

          {/* Step 3 box */}
          <rect x="257" y="12" width="97" height="60" rx="8" fill="#edf5ef" stroke="#2d6a4f" strokeWidth="1.4" />
          <circle cx="273" cy="28" r="8" fill="#1b4332" />
          <text x="273" y="31.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="monospace">
            3
          </text>
          <text x="287" y="31" fill="#132a1e" fontSize="9.5" fontWeight="700">
            {type === "egg-peps" && "PEPS"}
            {type === "biosecurity" && "Vacío"}
            {type === "welfare" && "Alerta"}
            {type === "withdrawal" && "Bloqueo"}
            {type === "compost" && "Abono"}
            {type === "finance" && "Equilibrio"}
          </text>
          <text x="265" y="50" fill="#1b4332" fontSize="8.5">
            {type === "egg-peps" && "Sale lote antiguo"}
            {type === "biosecurity" && "Descanso previo"}
            {type === "welfare" && "Brecha visible"}
            {type === "withdrawal" && "Cero venta antes"}
            {type === "compost" && "Lote liberado"}
            {type === "finance" && "Excel / PDF DIAN"}
          </text>

          {/* Bottom summary bar */}
          <rect x="6" y="82" width="348" height="22" rx="5" fill="#132a1e" />
          <text x="180" y="96" textAnchor="middle" fill="#f2e2bd" fontSize="9" fontFamily="monospace">
            {steps[0]} → {steps[1]} → {steps[2]}
          </text>
        </svg>
      </div>
    </div>
  );
}

export function SectorStandardsCarousel({
  standards,
}: {
  standards: SectorStandardItem[];
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const total = standards.length;

  const syncFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const idx = Math.round(track.scrollLeft / (track.clientWidth + 16));
    const clamped = Math.max(0, Math.min(total - 1, idx));
    setActiveIndex(clamped);
  }, [total]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(syncFromScroll, 110);
    };

    if ("onscrollend" in window) {
      track.addEventListener("scrollend", syncFromScroll, { passive: true });
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scrollend", syncFromScroll);
      track.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [syncFromScroll]);

  const goToSlide = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = (idx + total) % total;
    const stepWidth = track.clientWidth + 16;
    track.scrollTo({ left: clamped * stepWidth });
    setActiveIndex(clamped);
  };

  const current = standards[activeIndex] ?? standards[0];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Normas del sector integradas"
      className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-6 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--line)]">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--forest)]">
            Normas del sector integradas ({activeIndex + 1} de {total})
          </p>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">
            Cada regla técnica tiene su fuente oficial y un flujo visual de validación dentro de la app.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => goToSlide(activeIndex - 1)}
            aria-label="Norma anterior"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] transition"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => goToSlide(activeIndex + 1)}
            aria-label="Siguiente norma"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] transition"
          >
            →
          </button>
        </div>
      </div>

      {/* Live region for screen readers */}
      <div role="status" aria-live="polite" className="visually-hidden">
        Norma {activeIndex + 1} de {total}: {current.code} — {current.title}
      </div>

      {/* Scroll-snap horizontal track */}
      <div ref={trackRef} className="land-standards-track mt-4">
        {standards.map((std, index) => (
          <article
            key={std.code}
            role="group"
            aria-roledescription="slide"
            aria-label={`Norma ${index + 1} de ${total}: ${std.code}`}
            className="land-standards-slide grid gap-4 lg:grid-cols-12 items-stretch"
          >
            <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[var(--forest)] px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                    {std.code}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--moss)]">{std.authority}</span>
                </div>
                <h3 className="mt-2.5 text-lg font-semibold text-[var(--ink)] leading-snug">
                  {std.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{std.summary}</p>
                <p className="mt-3 rounded-lg border border-[var(--line)] bg-[#fbf7ee] px-3 py-2 text-xs text-[var(--ink)]">
                  <strong className="text-[var(--forest)]">En la app:</strong> {std.enforcement}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {std.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[var(--line)] bg-[var(--cream)] px-2.5 py-0.5 font-mono text-[10px] text-[var(--moss)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <a
                  href={std.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[var(--forest)] underline underline-offset-4 hover:text-[var(--forest-deep)]"
                >
                  {std.sourceLabel} ↗
                </a>
              </div>
            </div>

            <div className="lg:col-span-6 flex">
              <StandardDiagram type={std.diagramType} steps={std.diagramSteps} />
            </div>
          </article>
        ))}
      </div>

      {/* Slide marker controls */}
      <nav aria-label="Selector de normas" className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {standards.map((std, index) => {
          const isCurrent = index === activeIndex;
          return (
            <button
              key={std.code}
              type="button"
              onClick={() => goToSlide(index)}
              aria-current={isCurrent ? "true" : undefined}
              className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold transition border ${
                isCurrent
                  ? "bg-[var(--forest)] text-white border-[var(--forest)]"
                  : "bg-white text-[var(--moss)] border-[var(--line)] hover:border-[var(--forest)]"
              }`}
            >
              {std.code}
            </button>
          );
        })}
      </nav>
    </section>
  );
}

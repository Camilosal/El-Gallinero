import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ExtraLandingModuleItem, LandingModuleItem } from "@/lib/landing-showcase";

export function ModulesAccordionShowcase({
  coreModules,
  extraModules,
}: {
  coreModules: LandingModuleItem[];
  extraModules: ExtraLandingModuleItem[];
}) {
  const totalCount = coreModules.length + extraModules.length;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3 content-start">
        {coreModules.map((mod) => (
          <div
            key={mod.id}
            className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4 shadow-[var(--iw-shadow-card)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center text-[var(--iw-semantic-action-primary)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Módulo esencial desde el primer día</span>
              </span>
              <span className="rounded-full bg-[var(--iw-semantic-bg-feature)] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--iw-semantic-action-primary)]">
                Día 1
              </span>
            </div>
            <h3 className="mt-1.5 font-display text-base font-semibold text-[var(--iw-semantic-text-primary)]">{mod.name}</h3>
            <p className="mt-1 text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">{mod.summary}</p>
          </div>
        ))}
      </div>

      <details className="land-accordion rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-bg-subtle)] rounded-2xl transition-colors">
          <span>
            Explorar los {totalCount} frentes operativos (incluye {extraModules.length} herramientas avanzadas)
          </span>
          <span className="rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--iw-semantic-text-primary)]">
            +{extraModules.length} herramientas
          </span>
        </summary>

        <div className="border-t border-[var(--iw-semantic-border-default)] p-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {extraModules.map((mod, idx) => (
              <div
                key={mod.id}
                className="flex flex-col justify-between rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3.5"
              >
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]">
                    {String(coreModules.length + idx + 1).padStart(2, "0")} · Progresivo
                  </span>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--iw-semantic-text-primary)]">{mod.name}</h3>
                  <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                    {mod.summary}
                  </p>
                </div>
                <Link
                  href={mod.guideHash}
                  className="mt-2.5 inline-block text-xs font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
                >
                  Ver en la guía →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

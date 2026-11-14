import Link from "next/link";
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
        {coreModules.map((mod, idx) => (
          <div
            key={mod.id}
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--forest)]">
                0{idx + 1} · Esencial
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-900">
                Día 1
              </span>
            </div>
            <h3 className="mt-1.5 text-base font-semibold text-[var(--ink)]">{mod.name}</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)] leading-relaxed">{mod.summary}</p>
          </div>
        ))}
      </div>

      <details className="land-accordion rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--forest)] hover:bg-[#f4ede0] rounded-xl transition-colors">
          <span>
            Ver los {totalCount} módulos completos (incluye los {extraModules.length} módulos avanzados)
          </span>
          <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--ink)]">
            +{extraModules.length} módulos
          </span>
        </summary>

        <div className="border-t border-[var(--line)] p-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {extraModules.map((mod, idx) => (
              <div
                key={mod.id}
                className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-white p-3.5"
              >
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--moss)]">
                    {String(coreModules.length + idx + 1).padStart(2, "0")} · Progresivo
                  </span>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">{mod.name}</h3>
                  <p className="mt-1 text-xs text-[var(--ink-soft)] leading-relaxed">
                    {mod.summary}
                  </p>
                </div>
                <Link
                  href={mod.guideHash}
                  className="mt-2.5 inline-block text-xs font-semibold text-[var(--forest)] underline underline-offset-4 hover:text-[var(--forest-deep)]"
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

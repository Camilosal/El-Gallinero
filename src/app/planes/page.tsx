import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { CYCLE_PLANS_SHOWCASE } from "@/lib/landing-showcase";
import { PLAN_PROMISES } from "@/lib/legal";
import { buildPageMetadata, buildSoftwareNode } from "@/lib/seo";

const TITLE = "Planes y precios por ciclo productivo · IwaGranja";
const DESCRIPTION =
  "Compara el plan gratuito Semilla y los ciclos pagos de IwaGranja en pesos colombianos (IVA incluido), sin tarjeta ni cobros automáticos.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/planes",
  ogImage: "/images/guia/finanzas-presupuestos.webp",
  ogImageAlt: "Planes por ciclo productivo en IwaGranja",
});

export default function PlanesIndexPage() {
  const softwareWithAggregateOffer = {
    ...buildSoftwareNode(),
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "149000",
      priceCurrency: "COP",
      offerCount: CYCLE_PLANS_SHOWCASE.length,
      description: `${PLAN_PROMISES.pricesCop} ${PLAN_PROMISES.noAutoCharge}`,
    },
  };

  return (
    <PublicPageShell
      title="Planes por ciclo productivo"
      intro="Paga por cosecha o usa 1 lote gratis para siempre. Sin tarjeta, sin permanencia y sin cobros automáticos."
      path="/planes"
      description={DESCRIPTION}
      extraJsonLdNodes={[softwareWithAggregateOffer]}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {CYCLE_PLANS_SHOWCASE.map((plan) => (
          <article
            key={plan.id}
            className={`flex flex-col justify-between rounded-2xl border p-6 ${
              plan.featured
                ? "border-emerald-700 bg-white shadow-sm"
                : "border-slate-200 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {plan.badge}
                </span>
                <span className="font-mono text-xs text-slate-500">{plan.durationLabel}</span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900">{plan.name}</h2>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{plan.priceLabel}</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{plan.detailSummary}</p>

              <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-700">
                {plan.highlights.map((hl) => (
                  <li key={hl} className="flex items-start gap-2">
                    <span className="text-emerald-700 font-bold">✓</span>
                    <span>{hl}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5 pt-3 border-t border-slate-100">
              <Link
                href={`/planes/${plan.slug}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Ver detalle de {plan.name} →
              </Link>
              <Link
                href="/registro"
                className="inline-flex items-center justify-center rounded-lg bg-[#132a1e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3d2b]"
              >
                Crear granja gratis
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 space-y-2">
        <p className="font-semibold text-slate-900">Garantías en todos los planes</p>
        <p>{PLAN_PROMISES.expiry}</p>
        <p>{PLAN_PROMISES.noAutoCharge}</p>
      </div>
    </PublicPageShell>
  );
}

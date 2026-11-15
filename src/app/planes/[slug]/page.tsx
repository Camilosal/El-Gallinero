import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageShell } from "@/components/LegalPage";
import { CYCLE_PLANS_SHOWCASE, getCyclePlanBySlug } from "@/lib/landing-showcase";
import { PLAN_PROMISES, priceNote } from "@/lib/legal";
import {
  buildPageMetadata,
  buildSoftwareNode,
  fitSeoDescription,
  fitSeoTitle,
} from "@/lib/seo";

const PLAN_PRICES_COP: Record<string, string> = {
  FREEMIUM_SEMILLA: "0",
  CICLO_60D: "45000",
  SEMESTRAL_PONEDORA: "120000",
  MEDIANO_MENSUAL: "149000",
};

export function generateStaticParams() {
  return CYCLE_PLANS_SHOWCASE.map((plan) => ({ slug: plan.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = getCyclePlanBySlug(slug);
  if (!plan) {
    return { title: "Plan no encontrado · El Corral" };
  }
  return buildPageMetadata({
    title: fitSeoTitle(`${plan.name} (${plan.priceLabel})`),
    description: fitSeoDescription(plan.detailSummary),
    path: `/planes/${plan.slug}`,
    ogImage: "/images/guia/finanzas-presupuestos.webp",
    ogImageAlt: `${plan.name} de El Corral`,
  });
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const plan = getCyclePlanBySlug(slug);
  if (!plan) {
    notFound();
  }

  const otherPlans = CYCLE_PLANS_SHOWCASE.filter((p) => p.slug !== plan.slug);
  const priceCop = PLAN_PRICES_COP[plan.id] ?? "0";
  const planSoftwareNode = {
    ...buildSoftwareNode(),
    offers: {
      "@type": "Offer",
      name: plan.name,
      price: priceCop,
      priceCurrency: "COP",
      description: `${plan.durationLabel}. ${plan.detailSummary}`,
    },
  };

  return (
    <PublicPageShell
      title={`${plan.name} · ${plan.priceLabel}`}
      intro={plan.detailSummary}
      path={`/planes/${plan.slug}`}
      description={fitSeoDescription(plan.detailSummary)}
      breadcrumbs={[
        { name: "Planes", path: "/planes" },
        { name: plan.name, path: `/planes/${plan.slug}` },
      ]}
      extraJsonLdNodes={[planSoftwareNode]}
    >
      <div className="space-y-8 text-slate-700">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-900/15 bg-emerald-50/50 p-5 justify-between">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-800">
              {plan.badge} · {plan.durationLabel}
            </span>
            <p className="mt-1 text-2xl font-bold text-slate-900">{plan.priceLabel}</p>
            <p className="mt-1 text-xs text-slate-600">{priceNote()}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-lg bg-[#132a1e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3d2b]"
            >
              Empezar 30 días gratis →
            </Link>
            <Link
              href="/planes"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Comparar todos los planes
            </Link>
          </div>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-900">¿Para quién está pensado?</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {plan.idealFor.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-900">Qué incluye en operación</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {plan.includedFeatures.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold">✓</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Alcance y límites del plan</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Lotes activos
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">{plan.limits.lotes}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Usuarios / equipo
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">{plan.limits.usuarios}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Especies
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">{plan.limits.especies}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Respaldo y datos
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">{plan.limits.almacenamiento}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2 text-sm">
          <h2 className="text-base font-bold text-slate-900">Pago y vencimiento sin sorpresas</h2>
          <p>{plan.billingNote}</p>
          <p className="text-slate-600">{PLAN_PROMISES.expiry}</p>
          <p className="text-slate-600">{PLAN_PROMISES.noAutoCharge}</p>
          <p className="pt-1 text-xs">
            Consulta{" "}
            <Link href="/terminos" className="underline underline-offset-2 font-semibold">
              Términos y condiciones
            </Link>{" "}
            y{" "}
            <Link href="/retracto" className="underline underline-offset-2 font-semibold">
              Retracto y reembolsos
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="otros-planes">
          <h2 id="otros-planes" className="text-base font-bold text-slate-900">
            Explorar otros planes
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {otherPlans.map((other) => (
              <Link
                key={other.slug}
                href={`/planes/${other.slug}`}
                className="rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-700 transition"
              >
                <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  {other.badge}
                </p>
                <p className="mt-1 font-bold text-slate-900">{other.name}</p>
                <p className="text-sm font-semibold text-emerald-900">{other.priceLabel}</p>
                <span className="mt-2 inline-block text-xs font-semibold text-emerald-800 underline underline-offset-2">
                  Ver detalle →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}

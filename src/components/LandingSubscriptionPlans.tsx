"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Leaf, Users } from "lucide-react";
import type { PricingPlanKey, PublicPricingOffer } from "@/lib/pricing/types";
import { getPricingPlanCardBenefits } from "@/lib/pricing/plan-card-benefits";

type PlanGroup = "farm" | "organization";

const PRICE = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function money(value: number) {
  return `$${PRICE.format(value)}`;
}

function termSummary(months: number[]) {
  const labels = months.map((month) => `${month} ${month === 1 ? "mes" : "meses"}`);
  if (labels.length < 2) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

function PlanCard({
  offer,
  plan,
  eyebrow,
  title,
  description,
  price,
  unit,
  href,
  action,
  recommended = false,
  highlightsOverride,
}: {
  offer: PublicPricingOffer;
  plan: PricingPlanKey;
  eyebrow: string;
  title: string;
  description: string;
  price: string;
  unit: string;
  href: string;
  action: string;
  recommended?: boolean;
  highlightsOverride?: string[];
}) {
  const highlights = highlightsOverride ?? getPricingPlanCardBenefits(offer, plan);
  return (
    <article className={`land-plan-card ${recommended ? "land-plan-card-featured" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="land-plan-eyebrow">{eyebrow}</p>
        {recommended && <span className="land-plan-badge">Recomendado</span>}
      </div>
      <h3 className="land-plan-title">{title}</h3>
      <p className="land-plan-description">{description}</p>
      <div className="land-plan-price">
        <strong>{price}</strong>
        <span>{unit}</span>
      </div>
      <Link href={href} className={`land-plan-action ${recommended ? "land-plan-action-primary" : ""}`}>
        {action}<ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <ul className="land-plan-highlights">
        {highlights.map((highlight) => (
          <li key={highlight}>
            <Check aria-hidden="true" className="h-4 w-4" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function LandingSubscriptionPlans({ offer }: { offer: PublicPricingOffer }) {
  const [activeGroup, setActiveGroup] = useState<PlanGroup>("farm");

  const isFarm = activeGroup === "farm";
  const producerPrice = offer.producer.userTiers.find((tier) => tier.from === 1)?.priceCop ?? 0;
  const organizationPrice = offer.aggregator.beneficiaryTiers[0]?.priceCop ?? 0;
  const organizationHref = "/planes?restorePlan=1&segment=aggregator#calculadora";

  return (
    <div>
      <div className="land-plan-switch" role="group" aria-label="Elige el tipo de suscripción">
        <button type="button" aria-pressed={isFarm} onClick={() => setActiveGroup("farm")}>
          <Leaf aria-hidden="true" className="h-4 w-4" /> Mi granja
        </button>
        <button type="button" aria-pressed={!isFarm} onClick={() => setActiveGroup("organization")}>
          <Users aria-hidden="true" className="h-4 w-4" /> Organizaciones y proyectos
        </button>
      </div>

      {isFarm ? (
        <div className="land-plan-grid">
          <PlanCard
            offer={offer}
            plan="free"
            eyebrow="Para empezar"
            title="Gratis"
            description="Organiza tus primeros registros y descubre IwaGranja."
            price="$0"
            unit="para siempre"
            href="/registro"
            action="Empezar gratis"
          />
          <PlanCard
            offer={offer}
            plan="producer"
            eyebrow="La opción completa"
            title="Productor"
            description="Tu operación, tu equipo y tus registros en un solo lugar."
            price={money(producerPrice)}
            unit="por usuario / mes · desde 1 usuario"
            href="/planes?restorePlan=1&segment=producer#calculadora"
            action="Calcular mi plan"
            recommended
          />
        </div>
      ) : (
        <div className="land-plan-grid">
          <PlanCard
            offer={offer}
            plan="aggregator"
            eyebrow="Redes productivas"
            title="Organización"
            description="Conecta, forma y acompaña a todos tus beneficiarios."
            price={money(organizationPrice)}
            unit={`por beneficiario / mes · desde ${offer.aggregator.minPaidBeneficiaries}`}
            href={organizationHref}
            action="Calcular un proyecto"
            recommended
          />
          <PlanCard
            offer={offer}
            plan="aggregator"
            eyebrow="Programas especiales"
            title="A la medida"
            description="Para instituciones que necesitan una operación diseñada para su proyecto."
            price="Hablemos"
            unit="de tu proyecto"
            href="/contacto"
            action="Diseñar una propuesta"
            highlightsOverride={[
              "Diseñamos el plan según las necesidades de tu organización",
              "Acompañamiento durante la puesta en marcha",
              "Formación e indicadores acordes al proyecto",
              "Integraciones según los objetivos acordados",
            ]}
          />
        </div>
      )}

      <p className="land-plan-note">
        {isFarm
          ? `Productor se contrata por ${termSummary(offer.producer.terms.map((term) => term.months))}. El kit inicial se incluye desde ${offer.producer.physicalKitMinMonths} meses, según las localizaciones elegibles.`
          : `Organización se contrata por ${termSummary(offer.aggregator.terms.map((term) => term.months))}. La implementación y la logística se detallan antes de contratar.`}
      </p>
    </div>
  );
}

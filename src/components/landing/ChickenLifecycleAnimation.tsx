import { Fragment } from "react";
import { ArrowRight, Egg } from "lucide-react";
import { LifecycleStageIllustration } from "@/components/illustrations/SpeciesFieldIllustrations";

const stages = [
  { id: "hatch", code: "Etapa 01", label: "Pollito · Cría" },
  { id: "grow", code: "Etapa 02", label: "Levante joven" },
  { id: "hen", code: "Etapa 03", label: "Gallina en postura" },
] as const;

export function ChickenLifecycleAnimation() {
  return (
    <div
      role="img"
      aria-label="Lámina ilustrativa del ciclo productivo de una gallina ponedora: etapa 01 pollito en cría, etapa 02 levante joven, etapa 03 gallina en postura y recolección de huevos."
      className="land-lifecycle"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="land-lifecycle-kicker mb-0">
          Lámina técnica · Del nacimiento a la postura
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--iw-color-ochre)]">
          Ciclo ponedora
        </span>
      </div>

      <div className="land-lifecycle-track" aria-hidden="true">
        {stages.map((stage, index) => (
          <Fragment key={stage.id}>
            <div className="land-lifecycle-step">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--iw-color-ochre)]">
                {stage.code}
              </span>
              <div className={`land-lifecycle-illustration land-lifecycle-${stage.id}`}>
                <LifecycleStageIllustration
                  stage={stage.id}
                  className="h-14 w-14 text-[var(--iw-color-forest)]"
                />
              </div>
              <span className="land-lifecycle-label">{stage.label}</span>
            </div>
            {index < stages.length - 1 && (
              <ArrowRight className="land-lifecycle-arrow" strokeWidth={1.75} />
            )}
          </Fragment>
        ))}

        <div className="land-lifecycle-eggs">
          <div className="flex items-center gap-1">
            <Egg className="land-lifecycle-egg" strokeWidth={1.75} />
            <Egg
              className="land-lifecycle-egg land-lifecycle-egg-second"
              strokeWidth={1.75}
            />
          </div>
          <span>Huevos · NTC 1240</span>
        </div>
      </div>

      <p className="land-lifecycle-caption">
        El registro de postura corresponde a aves en etapa productiva y controla salidas PEPS.
      </p>
    </div>
  );
}

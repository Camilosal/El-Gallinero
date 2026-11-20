import { Fragment } from "react";
import { ArrowRight, Egg } from "lucide-react";

const stages = [
  { id: "hatch", label: "Pollito", emoji: "🐣" },
  { id: "grow", label: "Pollo joven", emoji: "🐤" },
  { id: "hen", label: "Gallina ponedora", emoji: "🐔" },
] as const;

export function ChickenLifecycleAnimation() {
  return (
    <div
      role="img"
      aria-label="Animación ilustrativa del ciclo de una gallina: nace como pollito, crece, llega a etapa productiva y pone huevos."
      className="land-lifecycle"
    >
      <p className="land-lifecycle-kicker">Del nacimiento a la postura</p>
      <div className="land-lifecycle-track" aria-hidden="true">
        {stages.map((stage, index) => (
          <Fragment key={stage.id}>
            <div className="land-lifecycle-step">
              <div className={`land-lifecycle-illustration land-lifecycle-${stage.id}`}>
                <span>{stage.emoji}</span>
              </div>
              <span className="land-lifecycle-label">{stage.label}</span>
            </div>
            {index < stages.length - 1 && (
              <ArrowRight className="land-lifecycle-arrow" strokeWidth={1.8} />
            )}
          </Fragment>
        ))}
        <div className="land-lifecycle-eggs">
          <Egg className="land-lifecycle-egg" />
          <Egg className="land-lifecycle-egg land-lifecycle-egg-second" />
          <span>Huevos</span>
        </div>
      </div>
      <p className="land-lifecycle-caption">El registro de producción corresponde a animales en etapa productiva.</p>
    </div>
  );
}

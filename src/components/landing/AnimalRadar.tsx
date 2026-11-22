const animals = [
  { id: "gallina", label: "Gallinas", emoji: "🐔", position: "animal-radar-gallina" },
  { id: "pollo", label: "Pollos", emoji: "🐣", position: "animal-radar-pollo" },
  { id: "pato", label: "Patos", emoji: "🦆", position: "animal-radar-pato" },
  { id: "curi", label: "Curíes", emoji: "🐹", position: "animal-radar-curi" },
  { id: "conejo", label: "Conejos", emoji: "🐇", position: "animal-radar-conejo" },
] as const;

export function AnimalRadar() {
  return (
    <div
      role="img"
      aria-label="Vista conceptual de un radar para ubicar y gestionar gallinas, pollos, patos, curíes y conejos."
      className="land-animal-radar"
    >
      <div className="land-animal-radar-copy">
        <span className="land-animal-radar-status"><i aria-hidden="true" /> Seguimiento por especie</span>
        <strong>Animales de tu granja</strong>
        <span>Ubicación · grupo · estado</span>
      </div>
      <div className="land-animal-radar-screen" aria-hidden="true">
        <span className="land-radar-ring land-radar-ring-outer" />
        <span className="land-radar-ring land-radar-ring-middle" />
        <span className="land-radar-ring land-radar-ring-inner" />
        <span className="land-radar-cross land-radar-cross-x" />
        <span className="land-radar-cross land-radar-cross-y" />
        <span className="land-radar-sweep" />
        <span className="land-radar-center" />
        {animals.map((animal) => (
          <span className={`land-radar-animal ${animal.position}`} key={animal.id}>
            <i>{animal.emoji}</i>
            <b>{animal.label}</b>
          </span>
        ))}
      </div>
      <div className="land-animal-radar-footer">
        <span><i className="land-radar-online-dot" aria-hidden="true" /> 5 especies ilustradas</span>
        <span>Vista conceptual</span>
      </div>
    </div>
  );
}

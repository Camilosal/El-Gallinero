import {
  CANONICAL_SPECIES,
  SpeciesIllustration,
} from "@/components/illustrations/SpeciesFieldIllustrations";

/**
 * Lámina de campo agroeditorial de las 6 especies canónicas del sistema.
 * Reemplaza la metáfora anterior de radar/emojis por fichas naturalistas documentadas.
 */
export function AnimalRadar() {
  return (
    <div
      role="img"
      aria-label="Lámina ilustrativa de campo con seis especies pecuarias gestionadas en IwaGranja: gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes o curíes."
      className="land-field-sheet"
    >
      <div className="land-field-sheet-head">
        <span className="land-field-sheet-kicker">
          Lámina de campo · 6 especies
        </span>
        <span className="land-field-sheet-sub">
          Ubicación · grupo · estado
        </span>
      </div>

      <div className="land-field-sheet-grid" aria-hidden="true">
        {CANONICAL_SPECIES.map((item) => (
          <div key={item.id} className="land-field-specimen">
            <div className="land-field-specimen-meta">
              <span className="land-field-specimen-code">{item.code}</span>
            </div>
            <div className="land-field-specimen-art">
              <SpeciesIllustration
                species={item.id}
                variant="specimen"
                className="h-14 w-14 text-[var(--iw-color-forest)]"
              />
            </div>
            <div className="land-field-specimen-text">
              <strong>{item.name}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="land-field-sheet-footer">
        <span className="land-field-sheet-stamp">
          Vista ilustrativa · sistema multiespecie
        </span>
        <span className="font-mono text-[10px] text-[var(--iw-semantic-text-secondary)]">
          Aves + mamíferos
        </span>
      </div>
    </div>
  );
}

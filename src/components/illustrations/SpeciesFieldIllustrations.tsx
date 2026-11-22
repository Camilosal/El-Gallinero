import type { SVGProps } from "react";

export type CanonicalSpeciesId =
  | "gallina"
  | "pollo"
  | "codorniz"
  | "pato"
  | "conejo"
  | "cuy";

export interface CanonicalSpeciesMeta {
  id: CanonicalSpeciesId;
  code: string;
  name: string;
  detail: string;
}

export const CANONICAL_SPECIES: readonly CanonicalSpeciesMeta[] = [
  {
    id: "gallina",
    code: "AVE-01",
    name: "Gallinas ponedoras",
    detail: "Postura · NTC 1240",
  },
  {
    id: "pollo",
    code: "AVE-02",
    name: "Pollos de engorde",
    detail: "Lotes · FCR y pesaje",
  },
  {
    id: "codorniz",
    code: "AVE-03",
    name: "Codornices",
    detail: "Postura e incubación",
  },
  {
    id: "pato",
    code: "AVE-04",
    name: "Patos",
    detail: "Cría y doble propósito",
  },
  {
    id: "conejo",
    code: "MAM-05",
    name: "Conejos",
    detail: "Camadas y engorde",
  },
  {
    id: "cuy",
    code: "MAM-06",
    name: "Cuyes / Curíes",
    detail: "Pozas y reproducción",
  },
] as const;

interface SpeciesIllustrationProps extends SVGProps<SVGSVGElement> {
  species: CanonicalSpeciesId;
  variant?: "specimen" | "glyph";
}

function renderSpecimenBody(species: CanonicalSpeciesId) {
  switch (species) {
    case "gallina":
      return (
        <g>
          {/* Silueta corporal suave con acento de lámina */}
          <path
            d="M25 60 C23 44 35 37 49 41 C54 34 55 24 63 22 C69 20 73 25 72 31 C71 36 74 42 75 50 C76 64 64 73 48 73 C36 73 27 68 25 60Z"
            fill="var(--iw-color-ochre)"
            fillOpacity="0.14"
            stroke="none"
          />
          {/* Cola escalonada */}
          <path d="M26 57 L14 40 Q22 39 29 47" />
          <path d="M24 52 L17 34 Q26 35 32 45" />
          {/* Cuerpo y cuello */}
          <path d="M25 59 C24 44 37 38 50 42 C55 34 56 24 63 22 C69 20 74 26 72 32 C71 38 75 43 75 52 C75 65 63 73 47 73 C35 73 26 67 25 59Z" />
          {/* Cresta y barbilla en terracota editorial */}
          <path
            d="M57 24 Q55 14 61 17 Q63 11 67 17 Q71 14 70 22"
            stroke="var(--iw-color-terracotta)"
          />
          <path
            d="M71 33 Q74 39 69 40 Q67 37 69 34"
            stroke="var(--iw-color-terracotta)"
          />
          {/* Pico y ojo */}
          <path d="M72 28 L83 30 L72 33" />
          <circle cx="66" cy="27" r="1.4" fill="currentColor" stroke="none" />
          {/* Ala y trama grabada */}
          <path d="M40 49 C47 45 58 47 61 55 C57 62 44 63 38 57" />
          <path d="M44 53 L55 54 M43 57 L53 58" strokeOpacity="0.55" />
          {/* Patas y línea de suelo */}
          <path d="M45 73 L43 85 M43 85 L37 88 M43 85 L47 88" />
          <path d="M56 73 L57 85 M57 85 L52 88 M57 85 L63 88" />
          <line x1="20" y1="88" x2="78" y2="88" strokeOpacity="0.28" />
        </g>
      );

    case "pollo":
      return (
        <g>
          <path
            d="M24 58 C23 43 34 36 47 39 C54 31 64 30 69 36 C75 43 75 57 67 66 C58 74 36 74 26 65Z"
            fill="var(--iw-color-sage)"
            fillOpacity="0.45"
            stroke="none"
          />
          {/* Cuerpo robusto de engorde */}
          <path d="M24 59 C23 44 35 37 48 40 C53 31 64 30 70 36 C76 44 75 59 66 67 C56 75 34 74 25 64 L18 57 Z" />
          {/* Cresta baja */}
          <path
            d="M57 32 Q59 26 63 29 Q66 26 67 33"
            stroke="var(--iw-color-terracotta)"
          />
          {/* Pico y ojo */}
          <path d="M71 39 L81 42 L72 45" />
          <circle cx="65" cy="37" r="1.4" fill="currentColor" stroke="none" />
          {/* Ala */}
          <path d="M37 49 C46 46 56 49 58 58 C51 64 39 63 35 56" />
          <path d="M41 54 L52 55" strokeOpacity="0.55" />
          {/* Patas firmes */}
          <path d="M42 72 L40 85 M40 85 L34 88 M40 85 L44 88" />
          <path d="M55 72 L56 85 M56 85 L51 88 M56 85 L62 88" />
          <line x1="20" y1="88" x2="78" y2="88" strokeOpacity="0.28" />
        </g>
      );

    case "codorniz":
      return (
        <g>
          <path
            d="M27 59 C27 45 39 39 52 41 C58 34 67 34 71 41 C75 49 71 62 60 67 C47 72 30 68 27 59Z"
            fill="var(--iw-color-ochre)"
            fillOpacity="0.16"
            stroke="none"
          />
          {/* Cuerpo redondeado y cola corta */}
          <path d="M27 59 C27 45 39 39 52 41 C58 34 67 34 71 41 C75 50 70 63 59 68 C45 73 29 68 27 59 L18 55 L27 52" />
          {/* Penacho característico de codorniz */}
          <path
            d="M64 35 Q67 24 72 23 Q71 27 68 35"
            stroke="var(--iw-color-terracotta)"
          />
          {/* Collar y moteado de plumaje */}
          <path d="M57 42 Q64 46 69 44" strokeOpacity="0.65" />
          <path d="M38 49 L44 48 M42 54 L50 53 M36 58 L43 57" strokeOpacity="0.55" />
          {/* Pico fino y ojo */}
          <path d="M72 41 L80 43 L72 45" />
          <circle cx="66" cy="39" r="1.3" fill="currentColor" stroke="none" />
          {/* Patas finas */}
          <path d="M45 70 L44 84 M44 84 L39 87 M44 84 L48 87" />
          <path d="M55 69 L56 84 M56 84 L52 87 M56 84 L61 87" />
          <line x1="22" y1="87" x2="76" y2="87" strokeOpacity="0.28" />
        </g>
      );

    case "pato":
      return (
        <g>
          <path
            d="M21 61 C24 49 38 46 53 48 C59 42 59 27 66 25 C71 24 74 28 73 34 C72 41 76 51 74 60 C70 69 55 73 38 72 C26 71 20 66 21 61Z"
            fill="var(--iw-color-forest)"
            fillOpacity="0.1"
            stroke="none"
          />
          {/* Silueta horizontal con cuello arqueado */}
          <path d="M21 62 L13 55 C24 53 38 47 52 49 C58 41 58 27 65 25 C71 23 75 28 73 34 C71 42 76 51 73 61 C69 69 53 73 36 72 C27 71 22 67 21 62Z" />
          {/* Pico ancho plano */}
          <path
            d="M73 29 L87 31 Q88 34 85 35 L73 34"
            stroke="var(--iw-color-ochre)"
          />
          <circle cx="67" cy="29" r="1.4" fill="currentColor" stroke="none" />
          {/* Ala larga y líneas de agua/suelo */}
          <path d="M31 56 C41 52 54 53 60 60 C53 65 38 65 29 61" />
          {/* Patas palmeadas */}
          <path d="M44 72 L43 84 M38 87 L43 84 L48 87 Z" />
          <path d="M55 72 L56 84 M51 87 L56 84 L61 87 Z" />
          <line x1="18" y1="88" x2="80" y2="88" strokeOpacity="0.28" />
        </g>
      );

    case "conejo":
      return (
        <g>
          <path
            d="M27 65 C25 50 37 42 52 44 C57 38 66 39 71 45 C75 51 74 61 69 67 C63 72 41 73 27 65Z"
            fill="var(--iw-color-sage)"
            fillOpacity="0.45"
            stroke="none"
          />
          {/* Orejas largas */}
          <path d="M59 40 C55 26 57 16 62 15 C66 15 67 25 65 40" />
          <path d="M64 39 C65 25 70 16 74 17 C78 19 75 30 69 42" />
          {/* Cuerpo agazapado y cabeza */}
          <path d="M27 66 C25 51 36 42 52 45 C58 39 68 39 73 46 C77 51 76 59 69 62 C64 64 60 66 59 71 C53 74 36 74 27 66Z" />
          {/* Cola de algodón */}
          <path d="M27 62 C21 60 19 66 24 70" />
          {/* Pata trasera doblada y delantera */}
          <path d="M37 59 C44 58 49 63 48 70 M40 73 L52 73" />
          <path d="M59 70 L66 74" />
          {/* Ojo, nariz y bigotes sutiles */}
          <circle cx="67" cy="48" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="75" cy="52" r="1.2" fill="var(--iw-color-terracotta)" stroke="none" />
          <path d="M77 54 L83 53 M77 56 L82 57" strokeOpacity="0.45" />
          <line x1="18" y1="76" x2="78" y2="76" strokeOpacity="0.28" />
        </g>
      );

    case "cuy":
      return (
        <g>
          <path
            d="M23 64 C22 48 36 41 53 42 C67 43 77 49 77 59 C77 67 66 72 48 72 C32 72 24 69 23 64Z"
            fill="var(--iw-color-ochre)"
            fillOpacity="0.16"
            stroke="none"
          />
          {/* Cuerpo compacto sin cola */}
          <path d="M23 63 C22 47 36 40 54 41 C67 42 78 49 78 58 C78 66 67 71 49 71 C33 71 24 69 23 63Z" />
          {/* Oreja redondeada característica */}
          <path d="M60 44 C59 38 65 37 66 44" />
          {/* Mancha dorsal suave estilo lámina naturalista */}
          <path d="M36 46 C43 49 46 57 42 64" stroke="var(--iw-color-terracotta)" strokeOpacity="0.7" />
          <path d="M47 48 L55 49 M48 53 L56 54" strokeOpacity="0.45" />
          {/* Ojo y hocico */}
          <circle cx="69" cy="51" r="1.5" fill="currentColor" stroke="none" />
          <path d="M77 58 L74 60" />
          {/* Patas cortas */}
          <path d="M34 71 L32 76 L37 76" />
          <path d="M61 71 L62 76 L67 76" />
          <line x1="18" y1="76" x2="82" y2="76" strokeOpacity="0.28" />
        </g>
      );
  }
}

function renderGlyphBody(species: CanonicalSpeciesId) {
  switch (species) {
    case "gallina":
      return (
        <g>
          <path d="M5 14 L3 10 Q5 10 7 12" />
          <path d="M6 15 C6 11 9 10 12 11 C13 9 14 7 16 7 C18 7 19 9 18 11 C18 14 16 17 12 17 C8 17 6 16 6 15Z" />
          <path d="M18 9 L21 10 L18 11" />
          <path d="M10 17 L9 20 M14 17 L14 20" />
        </g>
      );
    case "pollo":
      return (
        <g>
          <path d="M5 14 C5 10 9 9 12 10 C13 8 16 8 18 10 C19 12 19 15 16 17 C13 18 7 18 5 14Z" />
          <path d="M18 11 L21 12 L18 13" />
          <path d="M10 17 L9 20 M14 17 L15 20" />
        </g>
      );
    case "codorniz":
      return (
        <g>
          <path d="M6 14 C6 11 9 10 13 10 C15 9 17 9 18 11 C19 13 17 16 14 17 C10 18 6 17 6 14Z" />
          <path d="M16 9 Q17 6 19 6" />
          <path d="M18 11 L20 12 L18 13" />
          <path d="M11 17 L11 20 M14 17 L14 20" />
        </g>
      );
    case "pato":
      return (
        <g>
          <path d="M4 15 L3 13 C6 13 9 12 13 12 C14 10 14 7 16 6 C18 6 19 7 18 9 C18 11 19 14 18 16 C16 18 9 18 4 15Z" />
          <path d="M18 8 L22 8.5 L18 9.5" />
          <path d="M11 17 L10 20 M14 17 L15 20" />
        </g>
      );
    case "conejo":
      return (
        <g>
          <path d="M14 10 L13 4 M16 10 L18 5" />
          <path d="M6 16 C6 12 9 10 13 11 C15 10 18 10 19 12 C19 14 17 16 15 17 C13 18 8 18 6 16Z" />
          <path d="M5 15 C4 15 4 17 5 17" />
        </g>
      );
    case "cuy":
      return (
        <g>
          <path d="M5 15 C5 11 9 9 14 10 C17 10 20 12 20 14 C20 16 17 18 12 18 C8 18 5 17 5 15Z" />
          <path d="M15 10 C15 8 17 8 17 10" />
          <circle cx="17.5" cy="12.5" r="0.8" fill="currentColor" stroke="none" />
        </g>
      );
  }
}

export function SpeciesIllustration({
  species,
  variant = "specimen",
  className = "",
  ...props
}: SpeciesIllustrationProps) {
  if (variant === "glyph") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden={props["aria-label"] ? undefined : true}
        {...props}
      >
        {renderGlyphBody(species)}
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    >
      {renderSpecimenBody(species)}
    </svg>
  );
}

/**
 * Viñetas SVG naturalistas para las etapas del ciclo de postura:
 * cría (pollito), levante (pollo joven) y gallina ponedora en producción.
 */
export function LifecycleStageIllustration({
  stage,
  className = "",
}: {
  stage: "hatch" | "grow" | "hen";
  className?: string;
}) {
  if (stage === "hen") {
    return <SpeciesIllustration species="gallina" variant="specimen" className={className} />;
  }

  if (stage === "hatch") {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path
          d="M34 64 C32 52 40 46 50 47 C53 38 62 36 68 41 C72 45 71 54 68 62 C64 70 40 72 34 64Z"
          fill="var(--iw-color-ochre)"
          fillOpacity="0.18"
          stroke="none"
        />
        {/* Pollito de cría en lámina naturalista */}
        <path d="M34 63 C33 52 41 47 50 48 C53 39 62 37 68 42 C72 47 71 56 67 63 C62 71 39 71 34 63Z" />
        <path d="M70 46 L78 48 L70 50" />
        <circle cx="64" cy="44" r="1.4" fill="currentColor" stroke="none" />
        <path d="M44 55 C49 53 54 55 55 59" strokeOpacity="0.6" />
        <path d="M47 70 L46 82 M46 82 L41 85 M46 82 L50 85" />
        <path d="M56 70 L57 82 M57 82 L53 85 M57 82 L62 85" />
        <line x1="26" y1="85" x2="74" y2="85" strokeOpacity="0.28" />
      </svg>
    );
  }

  // stage === "grow" (levante joven)
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M29 61 C28 48 39 42 50 44 C54 35 58 29 65 29 C70 29 73 34 71 39 C70 45 73 53 71 61 C67 70 36 72 29 61Z"
        fill="var(--iw-color-sage)"
        fillOpacity="0.45"
        stroke="none"
      />
      <path d="M29 61 L20 51 Q27 49 32 54 C33 45 42 42 51 44 C55 34 59 29 65 29 C70 29 73 34 71 39 C70 46 73 53 70 62 C66 70 36 72 29 61Z" />
      <path d="M61 29 Q63 24 66 28" stroke="var(--iw-color-terracotta)" />
      <path d="M72 34 L81 36 L71 38" />
      <circle cx="66" cy="34" r="1.4" fill="currentColor" stroke="none" />
      <path d="M43 52 C49 49 57 51 58 58 C53 62 44 62 41 57" />
      <path d="M45 71 L43 84 M43 84 L38 87 M43 84 L47 87" />
      <path d="M56 71 L57 84 M57 84 L52 87 M57 84 L62 87" />
      <line x1="22" y1="87" x2="78" y2="87" strokeOpacity="0.28" />
    </svg>
  );
}

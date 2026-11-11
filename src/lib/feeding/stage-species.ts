export type FeedingSpecies = "gallina" | "gallo" | "pollo" | "codorniz" | "pato" | "conejo";

type StageLike = {
  value?: string | null;
  tipo?: string | null;
};

const knownSpecies = new Set<FeedingSpecies>([
  "gallina",
  "gallo",
  "pollo",
  "codorniz",
  "pato",
  "conejo",
]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

/** Resolve the species saved on a feeding stage, with a name fallback for legacy rows. */
export function getStageSpecies(stage: StageLike): FeedingSpecies {
  const explicitType = normalize(stage.tipo || "");
  for (const species of knownSpecies) {
    if (explicitType === species || explicitType.startsWith(`${species} `)) return species;
  }

  const name = normalize(stage.value || "");
  if (/\bconej[oa]s?\b/.test(name)) return "conejo";
  if (/\bcodorniz(?:es)?\b/.test(name)) return "codorniz";
  if (/\bpat[oa]s?\b/.test(name)) return "pato";
  if (/\bpollos?\b/.test(name)) return "pollo";
  if (/\bgallos?\b/.test(name)) return "gallo";
  if (/\bgallinas?\b/.test(name)) return "gallina";

  // Legacy stages such as "Juvenil" and "Postura" were defined for individual hens.
  return "gallina";
}

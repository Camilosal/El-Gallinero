export interface VaccinationEvent {
  weekNumber: number;
  name: string;
  description: string;
  type: "vacunacion";
  frequencyDays: number | null;
}

export const ISA_BROWN_VACCINATIONS: VaccinationEvent[] = [
  { weekNumber: 1, name: "Marek", description: "Vacuna Marek día 1 (en criadero)", type: "vacunacion", frequencyDays: null },
  { weekNumber: 1, name: "Newcastle + Bronquitis", description: "Newcastle B1 + IB H120, spray", type: "vacunacion", frequencyDays: null },
  { weekNumber: 3, name: "Gumboro intermediaria", description: "IBD intermediaria, agua", type: "vacunacion", frequencyDays: null },
  { weekNumber: 5, name: "Newcastle + Bronquitis refuerzo", description: "ND LaSota + IB H120, agua", type: "vacunacion", frequencyDays: null },
  { weekNumber: 8, name: "Coraza (POX)", description: "Viruela aviar, ala", type: "vacunacion", frequencyDays: null },
  { weekNumber: 10, name: "Gumboro refuerzo", description: "IBD intermediaria+, agua", type: "vacunacion", frequencyDays: null },
  { weekNumber: 12, name: "Newcastle inactivada", description: "ND inactivada, SC", type: "vacunacion", frequencyDays: null },
  { weekNumber: 14, name: "Coraza refuerzo", description: "Viruela aviar refuerzo", type: "vacunacion", frequencyDays: null },
  { weekNumber: 16, name: "Pre-postura completa", description: "ND+IB+EDS inactivada", type: "vacunacion", frequencyDays: null },
  { weekNumber: 28, name: "Newcastle refuerzo", description: "ND LaSota, agua (cada 8-10 sem)", type: "vacunacion", frequencyDays: 63 },
];

export const HY_LINE_W36_VACCINATIONS: VaccinationEvent[] = [
  { weekNumber: 1, name: "Marek", description: "Marek día 1", type: "vacunacion", frequencyDays: null },
  { weekNumber: 1, name: "Newcastle + Bronquitis", description: "B1 + H120 spray", type: "vacunacion", frequencyDays: null },
  { weekNumber: 3, name: "Gumboro", description: "IBD intermediaria", type: "vacunacion", frequencyDays: null },
  { weekNumber: 5, name: "Newcastle refuerzo", description: "LaSota + H120 agua", type: "vacunacion", frequencyDays: null },
  { weekNumber: 8, name: "Viruela", description: "Pox ala", type: "vacunacion", frequencyDays: null },
  { weekNumber: 12, name: "ND inactivada", description: "Newcastle killed", type: "vacunacion", frequencyDays: null },
  { weekNumber: 16, name: "Pre-postura", description: "ND+IB+EDS", type: "vacunacion", frequencyDays: null },
  { weekNumber: 28, name: "Newcastle refuerzo", description: "ND LaSota cada 8-10 sem", type: "vacunacion", frequencyDays: 63 },
];

export const COBB_500_VACCINATIONS: VaccinationEvent[] = [
  { weekNumber: 0, name: "Marek", description: "Marek día 1 en criadero", type: "vacunacion", frequencyDays: null },
  { weekNumber: 1, name: "Newcastle + Bronquitis", description: "B1 + H120 spray", type: "vacunacion", frequencyDays: null },
  { weekNumber: 2, name: "Gumboro", description: "IBD intermediaria", type: "vacunacion", frequencyDays: null },
  { weekNumber: 3, name: "Newcastle refuerzo", description: "LaSota agua", type: "vacunacion", frequencyDays: null },
  { weekNumber: 4, name: "Gumboro refuerzo", description: "IBD intermediaria+", type: "vacunacion", frequencyDays: null },
  { weekNumber: 5, name: "Viruela", description: "Pox ala", type: "vacunacion", frequencyDays: null },
];

export const ROSS_308_VACCINATIONS: VaccinationEvent[] = [
  { weekNumber: 0, name: "Marek + HVT-IBD", description: "Día 1 en incubadora", type: "vacunacion", frequencyDays: null },
  { weekNumber: 1, name: "Newcastle + Bronquitis", description: "ND B1 + IB H120 gota ocular/spray", type: "vacunacion", frequencyDays: null },
  { weekNumber: 2, name: "Gumboro", description: "IBD cepa intermedia en agua de bebida", type: "vacunacion", frequencyDays: null },
  { weekNumber: 3, name: "Newcastle refuerzo", description: "LaSota agua de bebida", type: "vacunacion", frequencyDays: null },
];

export const CUY_SANIDAD_SCHEDULE: VaccinationEvent[] = [
  { weekNumber: 3, name: "Desparasitación destete + Vitamina C", description: "Control antiparasitario al destete y refuerzo Vitamina C 25 mg/día", type: "vacunacion", frequencyDays: 90 },
  { weekNumber: 8, name: "Control ectoparásitos y Salmonella", description: "Inspección de ácaros/piojos y bioseguridad de pozas", type: "vacunacion", frequencyDays: 60 },
];

export const CODORNIZ_SANIDAD_SCHEDULE: VaccinationEvent[] = [
  { weekNumber: 2, name: "Complejo vitamínico + Newcastle ocular", description: "Protección temprana ND gota ocular/spray y electrolitos", type: "vacunacion", frequencyDays: null },
  { weekNumber: 5, name: "Refuerzo pre-postura codorniz", description: "Desparasitación preventiva y revisión de jaulas antes de postura", type: "vacunacion", frequencyDays: 90 },
];

export const PATO_SANIDAD_SCHEDULE: VaccinationEvent[] = [
  { weekNumber: 1, name: "Hepatitis viral / Pasteurella preventiva", description: "Control sanitario inicial en cría y desinfección de bebederos", type: "vacunacion", frequencyDays: null },
  { weekNumber: 4, name: "Refuerzo cólera aviar / desparasitación", description: "Mantenimiento sanitario previo a etapa de engorde final", type: "vacunacion", frequencyDays: 90 },
];

export const CONEJO_SANIDAD_SCHEDULE: VaccinationEvent[] = [
  { weekNumber: 4, name: "Desparasitación destete + coccidiosis", description: "Preventivo coccidiostato y limpieza térmica de jaulas/nidales", type: "vacunacion", frequencyDays: 60 },
  { weekNumber: 8, name: "Control sarna auricular y pasteurelosis", description: "Inspección de oídos, vías respiratorias y desinfección", type: "vacunacion", frequencyDays: 90 },
];

export const VACCINATION_SCHEDULE_SPECIES: Record<string, string> = {
  "ISA Brown": "gallina",
  "Hy-Line W-36": "gallina",
  "Cobb 500": "pollo",
  "Ross 308": "pollo",
  "Cuy Mejorado": "cuy",
  "Codorniz Japónica": "codorniz",
  "Pato Pekín": "pato",
  "Nueva Zelanda / California": "conejo",
};

export const VACCINATION_SCHEDULES: Record<string, VaccinationEvent[]> = {
  "ISA Brown": ISA_BROWN_VACCINATIONS,
  "Hy-Line W-36": HY_LINE_W36_VACCINATIONS,
  "Cobb 500": COBB_500_VACCINATIONS,
  "Ross 308": ROSS_308_VACCINATIONS,
  "Cuy Mejorado": CUY_SANIDAD_SCHEDULE,
  "Codorniz Japónica": CODORNIZ_SANIDAD_SCHEDULE,
  "Pato Pekín": PATO_SANIDAD_SCHEDULE,
  "Nueva Zelanda / California": CONEJO_SANIDAD_SCHEDULE,
};

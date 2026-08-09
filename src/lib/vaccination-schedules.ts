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

export const VACCINATION_SCHEDULES: Record<string, VaccinationEvent[]> = {
  "ISA Brown": ISA_BROWN_VACCINATIONS,
  "Hy-Line W-36": HY_LINE_W36_VACCINATIONS,
  "Cobb 500": COBB_500_VACCINATIONS,
};

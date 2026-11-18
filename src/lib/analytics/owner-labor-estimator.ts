export type OwnerLaborSpeciesKey = "gallina" | "gallo" | "pollo" | "codorniz" | "pato" | "conejo" | "cuy";

export interface OwnerLaborSpeciesRule {
  species: OwnerLaborSpeciesKey;
  label: string;
  animalsPerGroup: number;
  minutesPerGroupPerCareDay: number;
}

export interface OwnerLaborEstimatorSettings {
  minutesPerInstallationPerCareDay: number;
  cleaningMinutesPerInstallationPerWeek: number;
  coordinationMinutesPerWeek: number;
  weeksPerMonth: number;
  speciesRules: OwnerLaborSpeciesRule[];
}

export interface OwnerLaborWorkloadInput {
  installations: number;
  careDaysPerWeek: number;
  ownerSharePct: number;
  animalsBySpecies: Partial<Record<OwnerLaborSpeciesKey, number>>;
  settings: OwnerLaborEstimatorSettings;
}

export interface OwnerLaborWorkloadEstimate {
  installations: number;
  careDaysPerWeek: number;
  ownerSharePct: number;
  routineMinutesPerCareDay: number;
  routineMinutesPerWeek: number;
  cleaningMinutesPerWeek: number;
  coordinationMinutesPerWeek: number;
  ownerMinutesPerWeek: number;
  ownerHoursPerWeek: number;
  ownerHoursPerMonth: number;
  speciesHoursPerMonth: Record<OwnerLaborSpeciesKey, number>;
  unassignedHoursPerMonth: number;
}

/**
 * Initial editable planning assumptions. These are not legal, veterinary, or
 * industry standards; each farm should calibrate them against observed time.
 */
export const DEFAULT_OWNER_LABOR_SPECIES_RULES: OwnerLaborSpeciesRule[] = [
  { species: "gallina", label: "Gallinas", animalsPerGroup: 20, minutesPerGroupPerCareDay: 5 },
  { species: "gallo", label: "Gallos", animalsPerGroup: 10, minutesPerGroupPerCareDay: 5 },
  { species: "pollo", label: "Pollos", animalsPerGroup: 50, minutesPerGroupPerCareDay: 7 },
  { species: "codorniz", label: "Codornices", animalsPerGroup: 50, minutesPerGroupPerCareDay: 4 },
  { species: "pato", label: "Patos", animalsPerGroup: 10, minutesPerGroupPerCareDay: 5 },
  { species: "conejo", label: "Conejos", animalsPerGroup: 5, minutesPerGroupPerCareDay: 6 },
  { species: "cuy", label: "Cuyes", animalsPerGroup: 10, minutesPerGroupPerCareDay: 5 },
];

export const DEFAULT_OWNER_LABOR_ESTIMATOR_SETTINGS: OwnerLaborEstimatorSettings = {
  minutesPerInstallationPerCareDay: 6,
  cleaningMinutesPerInstallationPerWeek: 20,
  coordinationMinutesPerWeek: 30,
  weeksPerMonth: 4.33,
  speciesRules: DEFAULT_OWNER_LABOR_SPECIES_RULES,
};

export function ownerLaborSpeciesSettingKeys(species: OwnerLaborSpeciesKey) {
  return {
    animalsPerGroup: `payroll.owner_labor.${species}.animals_per_group`,
    minutesPerGroupPerCareDay: `payroll.owner_labor.${species}.minutes_per_group_per_care_day`,
  } as const;
}

const nonNegative = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

export function estimateOwnerLaborWorkload(input: OwnerLaborWorkloadInput): OwnerLaborWorkloadEstimate {
  const installations = nonNegative(input.installations);
  const careDaysPerWeek = Math.min(7, nonNegative(input.careDaysPerWeek));
  const ownerSharePct = Math.min(100, nonNegative(input.ownerSharePct));
  const settings = input.settings;

  const speciesMinutesBySpecies = Object.fromEntries(
    DEFAULT_OWNER_LABOR_SPECIES_RULES.map((rule) => [rule.species, 0]),
  ) as Record<OwnerLaborSpeciesKey, number>;

  for (const rule of settings.speciesRules) {
    const count = nonNegative(input.animalsBySpecies[rule.species] || 0);
    const groupSize = Math.max(1, nonNegative(rule.animalsPerGroup));
    const groups = Math.ceil(count / groupSize);
    speciesMinutesBySpecies[rule.species] =
      (speciesMinutesBySpecies[rule.species] || 0) + groups * nonNegative(rule.minutesPerGroupPerCareDay);
  }

  const speciesMinutesPerCareDay = Object.values(speciesMinutesBySpecies).reduce((sum, value) => sum + value, 0);
  const sharedRoutineMinutesPerCareDay = installations * nonNegative(settings.minutesPerInstallationPerCareDay);

  const routineMinutesPerCareDay = sharedRoutineMinutesPerCareDay + speciesMinutesPerCareDay;
  const routineMinutesPerWeek = routineMinutesPerCareDay * careDaysPerWeek;
  const cleaningMinutesPerWeek =
    installations * nonNegative(settings.cleaningMinutesPerInstallationPerWeek);
  const coordinationMinutesPerWeek = nonNegative(settings.coordinationMinutesPerWeek);
  const sharedWeeklyMinutes =
    sharedRoutineMinutesPerCareDay * careDaysPerWeek + cleaningMinutesPerWeek + coordinationMinutesPerWeek;
  const ownerMinutesPerWeek =
    (routineMinutesPerWeek + cleaningMinutesPerWeek + coordinationMinutesPerWeek) * (ownerSharePct / 100);
  const ownerHoursPerWeek = ownerMinutesPerWeek / 60;
  const weeksPerMonth = Math.min(5, Math.max(1, nonNegative(settings.weeksPerMonth) || 4.33));
  const speciesHoursPerMonth = { ...speciesMinutesBySpecies } as Record<OwnerLaborSpeciesKey, number>;

  if (speciesMinutesPerCareDay > 0) {
    for (const rule of settings.speciesRules) {
      const speciesShare = (speciesMinutesBySpecies[rule.species] || 0) / speciesMinutesPerCareDay;
      speciesHoursPerMonth[rule.species] =
        ((speciesMinutesBySpecies[rule.species] || 0) * careDaysPerWeek + sharedWeeklyMinutes * speciesShare) *
        (ownerSharePct / 100) *
        weeksPerMonth /
        60;
    }
  }

  const roundedSpeciesHoursPerMonth = Object.fromEntries(
    Object.entries(speciesHoursPerMonth).map(([species, hours]) => [species, round2(hours)]),
  ) as Record<OwnerLaborSpeciesKey, number>;
  const ownerHoursPerMonth = round2(ownerHoursPerWeek * weeksPerMonth);
  const activeSpeciesRules = settings.speciesRules.filter((rule) => (speciesMinutesBySpecies[rule.species] || 0) > 0);
  let unassignedHoursPerMonth = 0;

  if (activeSpeciesRules.length > 0) {
    const assignedHours = Object.values(roundedSpeciesHoursPerMonth).reduce((sum, value) => sum + value, 0);
    const finalSpecies = activeSpeciesRules[activeSpeciesRules.length - 1].species;
    roundedSpeciesHoursPerMonth[finalSpecies] = round2(
      roundedSpeciesHoursPerMonth[finalSpecies] + (ownerHoursPerMonth - assignedHours),
    );
  } else {
    unassignedHoursPerMonth = ownerHoursPerMonth;
  }

  return {
    installations,
    careDaysPerWeek,
    ownerSharePct,
    routineMinutesPerCareDay: round2(routineMinutesPerCareDay),
    routineMinutesPerWeek: round2(routineMinutesPerWeek),
    cleaningMinutesPerWeek: round2(cleaningMinutesPerWeek),
    coordinationMinutesPerWeek: round2(coordinationMinutesPerWeek),
    ownerMinutesPerWeek: round2(ownerMinutesPerWeek),
    ownerHoursPerWeek: round2(ownerHoursPerWeek),
    ownerHoursPerMonth,
    speciesHoursPerMonth: roundedSpeciesHoursPerMonth,
    unassignedHoursPerMonth,
  };
}

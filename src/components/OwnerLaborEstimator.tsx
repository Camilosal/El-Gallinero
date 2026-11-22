"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Calculator, Clock3, Info, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import {
  estimateOwnerLaborWorkload,
  type OwnerLaborEstimatorSettings,
  type OwnerLaborSpeciesKey,
  type OwnerLaborWorkloadEstimate,
} from "@/lib/analytics/owner-labor-estimator";

const SPECIES: { key: OwnerLaborSpeciesKey; label: string }[] = [
  { key: "gallina", label: "Gallinas" },
  { key: "gallo", label: "Gallos" },
  { key: "pollo", label: "Pollos" },
  { key: "codorniz", label: "Codornices" },
  { key: "pato", label: "Patos" },
  { key: "conejo", label: "Conejos" },
  { key: "cuy", label: "Cuyes" },
];

const EMPTY_COUNTS: Record<OwnerLaborSpeciesKey, number> = {
  gallina: 0,
  gallo: 0,
  pollo: 0,
  codorniz: 0,
  pato: 0,
  conejo: 0,
  cuy: 0,
};

export interface OwnerLaborEstimatorProps {
  dataLoaded: boolean;
  initialInstallations: number;
  initialAnimalCounts: Partial<Record<OwnerLaborSpeciesKey, number>>;
  settings: OwnerLaborEstimatorSettings;
  ownerHourlyRateCop: number | null;
  includeInBreakEven: boolean;
  onConfigureHourlyRate: () => void;
  onUseEstimate: (estimate: OwnerLaborWorkloadEstimate) => void;
}

const fmtMoney = (value: number) =>
  `$${Math.round(value).toLocaleString("es-CO")}`;

const fmtHours = (value: number) =>
  `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;

export default function OwnerLaborEstimator({
  dataLoaded,
  initialInstallations,
  initialAnimalCounts,
  settings,
  ownerHourlyRateCop,
  includeInBreakEven,
  onConfigureHourlyRate,
  onUseEstimate,
}: OwnerLaborEstimatorProps) {
  const initialized = useRef(false);
  const [installations, setInstallations] = useState(0);
  const [careDaysPerWeek, setCareDaysPerWeek] = useState(7);
  const [ownerSharePct, setOwnerSharePct] = useState(100);
  const [animalCounts, setAnimalCounts] = useState(EMPTY_COUNTS);

  useEffect(() => {
    if (!dataLoaded || initialized.current) return;
    const nextCounts = { ...EMPTY_COUNTS };
    for (const species of SPECIES) {
      nextCounts[species.key] = Math.max(0, Number(initialAnimalCounts[species.key] || 0));
    }
    setAnimalCounts(nextCounts);
    setInstallations(Math.max(0, Number(initialInstallations || 0)));
    initialized.current = true;
  }, [dataLoaded, initialAnimalCounts, initialInstallations]);

  const estimate = useMemo(
    () =>
      estimateOwnerLaborWorkload({
        installations,
        careDaysPerWeek,
        ownerSharePct,
        animalsBySpecies: animalCounts,
        settings,
      }),
    [animalCounts, careDaysPerWeek, installations, ownerSharePct, settings],
  );

  const estimatedEconomicValue = ownerHourlyRateCop
    ? estimate.ownerHoursPerMonth * ownerHourlyRateCop
    : null;

  return (
    <Card className="border-sky-200 bg-sky-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-sky-100 p-2 text-sky-800">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">Estimador de dedicación del productor</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
              Toma el inventario y los lugares activos como punto de partida. Ajusta lo que realmente atiendes; el cálculo estima horas parciales, no una jornada completa.
            </p>
          </div>
        </div>
        <Badge color="blue">Estimación editable</Badge>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Instalaciones atendidas"
              help="Se prellenan con los lugares productivos activos. Cuenta aquí jaulas o espacios individuales si varios comparten un solo lugar en la app."
              type="number"
              min="0"
              step="1"
              value={installations}
              onChange={(event) => setInstallations(Math.max(0, Number(event.target.value || 0)))}
            />
            <Input
              label="Días de cuidado por semana"
              help="Incluye los días en que realizas una rutina de cuidado; puedes ajustar la frecuencia según tus apoyos y organización."
              type="number"
              min="0"
              max="7"
              step="1"
              value={careDaysPerWeek}
              onChange={(event) => setCareDaysPerWeek(Math.min(7, Math.max(0, Number(event.target.value || 0))))}
            />
            <Input
              label="Parte que realiza el productor (%)"
              help="Reduce el porcentaje si otras personas del hogar o trabajadores comparten estas tareas."
              type="number"
              min="0"
              max="100"
              step="5"
              value={ownerSharePct}
              onChange={(event) => setOwnerSharePct(Math.min(100, Math.max(0, Number(event.target.value || 0))))}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Animales atendidos</h3>
              <span className="text-[11px] text-slate-500">Prellenado desde inventario; puedes corregirlo para este cálculo.</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SPECIES.map(({ key, label }) => (
                <Input
                  key={key}
                  label={label}
                  type="number"
                  min="0"
                  step="1"
                  value={animalCounts[key]}
                  onChange={(event) =>
                    setAnimalCounts((current) => ({
                      ...current,
                      [key]: Math.max(0, Number(event.target.value || 0)),
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <Link
            href="/configuracion/catalogos?tab=personal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 hover:underline"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Ajustar tiempos de referencia en Catálogos
          </Link>
        </div>

        <div className="space-y-3 lg:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white bg-white p-3 shadow-sm">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Tiempo mensual
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">{fmtHours(estimate.ownerHoursPerMonth)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{fmtHours(estimate.ownerHoursPerWeek)} por semana</p>
            </div>
            <div className="rounded-xl border border-white bg-white p-3 shadow-sm">
              <p className="text-[11px] font-medium text-slate-500">Valor económico posible</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {estimatedEconomicValue == null ? "Por definir" : fmtMoney(estimatedEconomicValue)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {ownerHourlyRateCop ? "Horas estimadas × tarifa por hora" : "Configura una tarifa horaria propia"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-white/80 p-3 text-xs leading-relaxed text-slate-700">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900">No se presume un salario mensual completo.</p>
                <p className="mt-1">
                  {estimatedEconomicValue == null
                    ? "El sistema muestra primero el tiempo. El valor solo se calcula cuando defines una tarifa por hora para tu trabajo."
                    : includeInBreakEven
                      ? "Al confirmar la liquidación, se registra como costo económico sin salida de caja y participa en el punto de equilibrio."
                      : "Al confirmar la liquidación, se registra como costo económico sin salida de caja; el parámetro actual excluye ese valor del punto de equilibrio."}
                </p>
              </div>
            </div>
          </div>

          {ownerHourlyRateCop ? (
            <Button
              className="w-full"
              onClick={() => onUseEstimate(estimate)}
              disabled={estimate.ownerHoursPerMonth <= 0}
            >
              Revisar estimación para este mes
            </Button>
          ) : (
            <Button className="w-full" variant="secondary" onClick={onConfigureHourlyRate}>
              Configurar tarifa horaria del productor
            </Button>
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">
            La estimación no se guarda sola ni genera un pago. El registro se abre para que revises horas, periodo y valor antes de confirmarlo.
          </p>
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Ver cómo se calcula</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>Rutina por día de cuidado = instalaciones atendidas × minutos por instalación + grupos de animales × minutos por grupo.</p>
          <p>Al mes se agregan limpieza semanal por instalación y registro/coordinación semanal; después se aplica la parte que realiza el productor.</p>
          <div>
            <p className="font-semibold text-slate-700">Distribución de horas estimadas por especie</p>
            <ul className="mt-1 grid gap-x-3 sm:grid-cols-2">
              {SPECIES.filter(({ key }) => estimate.speciesHoursPerMonth[key] > 0).map(({ key, label }) => (
                <li key={key} className="flex justify-between gap-3">
                  <span>{label}</span>
                  <span className="font-medium">{fmtHours(estimate.speciesHoursPerMonth[key])}</span>
                </li>
              ))}
              {estimate.unassignedHoursPerMonth > 0 && (
                <li className="flex justify-between gap-3">
                  <span>Trabajo general sin animales registrados</span>
                  <span className="font-medium">{fmtHours(estimate.unassignedHoursPerMonth)}</span>
                </li>
              )}
            </ul>
          </div>
          <p className="rounded-md bg-amber-50 px-2.5 py-2 text-amber-900">
            Los minutos iniciales son supuestos editables, no estándares de productividad. Calíbralos con tiempos observados en la granja y conserva por separado el trabajo pagado a terceros.
          </p>
        </div>
      </details>
    </Card>
  );
}

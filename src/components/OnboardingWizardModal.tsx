"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wheat,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { todayColombiaIso } from "@/lib/date-validation";
import {
  FEATURE_FLAG_BY_KEY,
  buildScaleDefaultFlags,
  evaluateProgressiveTriggers,
  exportDay1StarterCsvTemplate,
  parseDay1StarterCsv,
  type ProducerScale,
} from "@/lib/onboarding";
import { broadcastOnboardingState, useOnboardingState } from "@/lib/useOnboardingState";
import { openQuickCapture } from "@/lib/quick-capture-events";

type AgeUnit = "dias" | "semanas" | "meses";

interface UnitDraft {
  id: string;
  nombreInstalacion: string;
  tipoInstalacion: string;
  especie: string;
  codigoLote: string;
  lineaGenetica: string;
  edadValor: string;
  edadUnidad: AgeUnit;
  edadActualDias: string;
  cantidadVivaHoy: string;
  saldoConcentradoBultos40kg: string;
  proposito: "engorde_carne" | "postura_huevo" | "pie_cria" | "mixto";
}

interface CompletedSummary {
  locationsCreated: number;
  animalsCreated: number;
  feedEntriesCreated: number;
  totalFeedKg: number;
  milestonesCreated: number;
  sanitaryEventsCreated: number;
  costPerKg: number;
}

const AGE_UNIT_MULTIPLIER: Record<AgeUnit, number> = {
  dias: 1,
  semanas: 7,
  meses: 30,
};

function computeAgeDays(valor: string, unidad: AgeUnit): string {
  const num = Number(valor);
  if (!Number.isFinite(num) || num < 0) return "0";
  return String(Math.min(3650, Math.round(num * AGE_UNIT_MULTIPLIER[unidad])));
}

const BREED_SUGGESTIONS_BY_SPECIES: Record<string, string[]> = {
  gallina: ["Hy-Line Brown", "ISA Brown", "Lohmann Brown", "Criolla / Campesina"],
  pollo: ["Ross 308", "Cobb 500", "Semicriollo"],
  codorniz: ["Japónica", "Faraón"],
  pato: ["Pekín", "Criollo / Muscovy"],
  conejo: ["Nueva Zelanda", "Californiano", "Chinchilla"],
  cuy: ["Andino Mejorado", "Perú", "Criollo"],
};

const SPECIES_CHOICES = [
  { key: "gallina", label: "Gallinas ponedoras", defaultUnitName: "Galpón Ponedoras", defaultLocType: "galpon", defaultPurpose: "postura_huevo" as const, defaultAgeVal: "20", defaultAgeUnit: "semanas" as AgeUnit, defaultBreed: "Hy-Line Brown" },
  { key: "pollo", label: "Pollos de engorde", defaultUnitName: "Galpón Engorde", defaultLocType: "galpon", defaultPurpose: "engorde_carne" as const, defaultAgeVal: "14", defaultAgeUnit: "dias" as AgeUnit, defaultBreed: "Ross 308" },
  { key: "codorniz", label: "Codornices", defaultUnitName: "Módulo Codornices", defaultLocType: "jaula", defaultPurpose: "postura_huevo" as const, defaultAgeVal: "6", defaultAgeUnit: "semanas" as AgeUnit, defaultBreed: "Japónica" },
  { key: "pato", label: "Patos", defaultUnitName: "Corral Patos", defaultLocType: "corral", defaultPurpose: "engorde_carne" as const, defaultAgeVal: "4", defaultAgeUnit: "semanas" as AgeUnit, defaultBreed: "Pekín" },
  { key: "conejo", label: "Conejos", defaultUnitName: "Jaulas Cunícolas", defaultLocType: "jaula", defaultPurpose: "engorde_carne" as const, defaultAgeVal: "6", defaultAgeUnit: "semanas" as AgeUnit, defaultBreed: "Nueva Zelanda" },
  { key: "cuy", label: "Cuyes", defaultUnitName: "Cuyera Pozas", defaultLocType: "corral", defaultPurpose: "engorde_carne" as const, defaultAgeVal: "6", defaultAgeUnit: "semanas" as AgeUnit, defaultBreed: "Andino Mejorado" },
];

function makeUnitDraftForSpecies(speciesKey: string, idx: number): UnitDraft {
  const info = SPECIES_CHOICES.find((s) => s.key === speciesKey) ?? SPECIES_CHOICES[0];
  return {
    id: `${speciesKey}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    nombreInstalacion: info.defaultUnitName,
    tipoInstalacion: info.defaultLocType,
    especie: info.key,
    codigoLote: "",
    lineaGenetica: info.defaultBreed,
    edadValor: info.defaultAgeVal,
    edadUnidad: info.defaultAgeUnit,
    edadActualDias: computeAgeDays(info.defaultAgeVal, info.defaultAgeUnit),
    cantidadVivaHoy: info.key === "gallina" ? "30" : "25",
    saldoConcentradoBultos40kg: "0",
    proposito: info.defaultPurpose,
  };
}

interface OnboardingWizardModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export default function OnboardingWizardModal({
  open,
  onClose,
  onCompleted,
}: OnboardingWizardModalProps) {
  const { state } = useOnboardingState();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = "";
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="onboarding-wizard-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClose={() => {
        const dialog = dialogRef.current;
        if (dialog) dialog.returnValue = "";
        if (open) onClose();
      }}
      className="m-auto w-[min(100vw-1rem,48rem)] max-h-[92dvh] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs"
    >
      {open && (
        <WizardBody
          initialFarmName={state?.farmProfile.name || ""}
          initialCity={state?.farmProfile.city || ""}
          initialAltitude={state?.farmProfile.altitudeMeters || ""}
          initialAdminName={state?.farmProfile.adminName || ""}
          initialScale={state?.config.scale || "PEQUENO"}
          initialSpecies={state?.config.selectedSpecies?.length ? state.config.selectedSpecies : ["gallina"]}
          initialFormalReport={Boolean(state?.config.solicitaReporteFormal)}
          onClose={handleClose}
          onCompleted={() => {
            handleClose();
            onCompleted?.();
          }}
        />
      )}
    </dialog>
  );
}

function WizardBody({
  initialFarmName,
  initialCity,
  initialAltitude,
  initialAdminName,
  initialScale,
  initialSpecies,
  initialFormalReport,
  onClose,
  onCompleted,
}: {
  initialFarmName: string;
  initialCity: string;
  initialAltitude: string;
  initialAdminName: string;
  initialScale: ProducerScale;
  initialSpecies: string[];
  initialFormalReport: boolean;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const wizardOpenedAtRef = useRef<number>(0);

  useEffect(() => {
    wizardOpenedAtRef.current = Date.now();
  }, []);

  // Paso 1 (sincroniza con lo cargado en useOnboardingState sin repetir captura)
  const [nombrePredioOverride, setNombrePredioOverride] = useState<string | null>(null);
  const [ciudadOverride, setCiudadOverride] = useState<string | null>(null);
  const [altitudOverride, setAltitudOverride] = useState<string | null>(null);
  const [administradorOverride, setAdministradorOverride] = useState<string | null>(null);
  const [showPredioDetails, setShowPredioDetails] = useState(false);

  const nombrePredio = nombrePredioOverride ?? initialFarmName;
  const ciudad = ciudadOverride ?? initialCity;
  const altitudMsnm = altitudOverride ?? initialAltitude;
  const administrador = administradorOverride ?? initialAdminName;

  const [escala, setEscala] = useState<ProducerScale>(initialScale);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(initialSpecies);
  const [solicitaReporteFormal, setSolicitaReporteFormal] = useState(initialFormalReport);
  const [fechaInicio, setFechaInicio] = useState(todayColombiaIso());

  // Paso 2
  const [inputMode, setInputMode] = useState<"manual" | "csv">("manual");
  const [unidades, setUnidades] = useState<UnitDraft[]>(() =>
    initialSpecies.map((sp, i) => makeUnitDraftForSpecies(sp, i)),
  );
  const [csvText, setCsvText] = useState("");
  const [csvNotice, setCsvNotice] = useState<string | null>(null);

  // Paso 3
  const [nombreAlimento, setNombreAlimento] = useState("Concentrado Inicial en Bodega");
  const [bultos40kg, setBultos40kg] = useState("2");
  const [kgAdicional, setKgAdicional] = useState("0");
  const [costoPorBulto40kg, setCostoPorBulto40kg] = useState("78000");

  // Envío, confirmación y errores
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<CompletedSummary | null>(null);

  const moveToStep = (nextStep: 1 | 2 | 3) => {
    setError("");
    setStep(nextStep);
    window.requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
  };

  const toggleSpecies = (key: string) => {
    setSelectedSpecies((prev) => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter((s) => s !== key) : [...prev, key];
      if (!exists && !unidades.some((u) => u.especie === key)) {
        setUnidades((current) => [...current, makeUnitDraftForSpecies(key, current.length)]);
      }
      return next.length > 0 ? next : [key];
    });
  };

  const handleImportCsvText = (raw: string) => {
    setCsvText(raw);
    if (!raw.trim()) {
      setCsvNotice(null);
      return;
    }
    const parsed = parseDay1StarterCsv(raw);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      setError(parsed.errors[0]);
      setCsvNotice(null);
      return;
    }
    setError("");
    const totalBultos = parsed.rows.reduce((sum, r) => sum + r.saldoConcentradoBultos40kg, 0);
    setUnidades(
      parsed.rows.map((r, i) => ({
        id: `csv-${i}-${Math.random().toString(36).slice(2, 6)}`,
        nombreInstalacion: r.nombreInstalacion,
        tipoInstalacion: r.tipoInstalacion,
        especie: r.especie,
        codigoLote: r.codigoLote,
        lineaGenetica: r.lineaGenetica,
        edadValor: String(r.edadActualDias),
        edadUnidad: "dias" as AgeUnit,
        edadActualDias: String(r.edadActualDias),
        cantidadVivaHoy: String(r.cantidadVivaHoy),
        saldoConcentradoBultos40kg: String(r.saldoConcentradoBultos40kg),
        proposito: r.especie === "gallina" || r.especie === "codorniz" ? "postura_huevo" : "engorde_carne",
      })),
    );
    const spList = Array.from(new Set(parsed.rows.map((r) => r.especie)));
    if (spList.length > 0) setSelectedSpecies(spList);
    if (totalBultos > 0) setBultos40kg(String(totalBultos));
    setCsvNotice(
      `Se cargaron ${parsed.rows.length} unidades activas y ${totalBultos} bultos de concentrado${parsed.errors.length > 0 ? ` (${parsed.errors.length} advertencia/s)` : ""}.`,
    );
  };

  const handleCsvFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleImportCsvText(String(reader.result || ""));
    };
    reader.readAsText(file, "utf-8");
  };

  const downloadTemplate = () => {
    const content = exportDay1StarterCsvTemplate();
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_arranque_dia1.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Simulación en vivo de auto-triggers según datos actuales del wizard
  const previewEvaluation = useMemo(() => {
    const validUnits = unidades.filter((u) => Number(u.cantidadVivaHoy) > 0);
    let birds = 0;
    let hensCount = 0;
    let mammals = 0;
    const spSet = new Set<string>();
    for (const u of validUnits) {
      const qty = Math.max(0, Math.round(Number(u.cantidadVivaHoy) || 0));
      spSet.add(u.especie === "gallo" ? "gallina" : u.especie);
      if (["conejo", "cuy"].includes(u.especie)) {
        mammals += qty;
      } else {
        birds += qty;
        if (u.especie === "gallina") hensCount += qty;
      }
    }
    const baseFlags = buildScaleDefaultFlags(escala);
    return evaluateProgressiveTriggers(
      {
        scale: escala,
        onboardingCompleted: true,
        wizardDismissed: true,
        operationStartDate: fechaInicio,
        selectedSpecies: Array.from(spSet),
        solicitaReporteFormal,
        flags: baseFlags,
        manualOverrides: {},
        updatedAt: new Date().toISOString(),
      },
      {
        avesActivasTotales: birds,
        gallinasPonedorasActivas: hensCount,
        reproductoresMamiferos: mammals,
        especiesActivas: spSet.size,
        especiesList: Array.from(spSet),
        locationsCount: validUnits.length,
        animalsTotal: birds + mammals,
        feedInventoryCount: 1,
        feedStockKg: Number(bultos40kg || 0) * 40 + Number(kgAdicional || 0),
        hasExistingOperation: false,
      },
    );
  }, [unidades, escala, fechaInicio, solicitaReporteFormal, bultos40kg, kgAdicional]);

  const validateStep1 = (): boolean => {
    if (!nombrePredio.trim()) {
      setError("Ingresa el nombre del predio o finca para continuar.");
      return false;
    }
    if (altitudMsnm.trim() !== "") {
      const alt = Number(altitudMsnm);
      if (!Number.isInteger(alt) || alt < 0 || alt > 5500) {
        setError("La altitud debe ser un número entero entre 0 y 5500 msnm.");
        return false;
      }
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    for (const unit of unidades) {
      if (!unit.nombreInstalacion.trim()) {
        setError("Todas las unidades activas necesitan un nombre de instalación.");
        return false;
      }
      const qty = Number(unit.cantidadVivaHoy);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError(`La cantidad viva hoy en "${unit.nombreInstalacion}" debe ser un entero mayor a 0.`);
        return false;
      }
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const bags = bultos40kg.trim() === "" ? 0 : Number(bultos40kg);
    const extraKg = kgAdicional.trim() === "" ? 0 : Number(kgAdicional);
    if (!Number.isFinite(bags) || bags < 0 || !Number.isFinite(extraKg) || extraKg < 0) {
      setError("Los bultos y kilogramos iniciales deben ser números iguales o mayores a 0.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) moveToStep(2);
      return;
    }
    if (step === 2) {
      if (validateStep2()) moveToStep(3);
      return;
    }
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!validateStep3()) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombrePredio: nombrePredio.trim(),
          ciudad: ciudad.trim(),
          altitudMsnm: altitudMsnm.trim() === "" ? null : Number(altitudMsnm),
          administrador: administrador.trim(),
          escala,
          especies: selectedSpecies,
          fechaInicioOperacion: fechaInicio,
          solicitaReporteFormal,
          unidades: unidades.map((u) => ({
            nombreInstalacion: u.nombreInstalacion.trim(),
            tipoInstalacion: u.tipoInstalacion,
            especie: u.especie,
            codigoLote: u.codigoLote.trim(),
            lineaGenetica: u.lineaGenetica.trim(),
            edadActualDias: Math.max(0, Math.round(Number(u.edadActualDias) || 0)),
            cantidadVivaHoy: Math.round(Number(u.cantidadVivaHoy)),
            saldoConcentradoBultos40kg: Math.max(0, Number(u.saldoConcentradoBultos40kg) || 0),
            proposito: u.proposito,
          })),
          bultosConcentrado40kg: Math.max(0, Number(bultos40kg) || 0),
          kgConcentradoAdicional: Math.max(0, Number(kgAdicional) || 0),
          costoPorBulto40kg: Math.max(0, Number(costoPorBulto40kg) || 0),
          nombreAlimentoInicial: nombreAlimento.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo guardar la configuración inicial.");
        return;
      }
      if (json.state) {
        broadcastOnboardingState(json.state);
      }
      const startMs = wizardOpenedAtRef.current || Date.now();
      const durationSec = Math.max(1, Math.min(3600, Math.round((Date.now() - startMs) / 1000)));
      void apiFetch("/api/analisis/kpis-adopcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "onboarding", durationSec }),
      }).catch(() => {});

      const validBagCost = Math.max(0, Number(costoPorBulto40kg) || 0);
      setCompletedSummary({
        locationsCreated: Number(json.created?.locationsCreated ?? unidades.length),
        animalsCreated: Number(json.created?.animalsCreated ?? 0),
        feedEntriesCreated: Number(json.created?.feedEntriesCreated ?? 0),
        totalFeedKg: Number(json.created?.totalFeedKg ?? 0),
        milestonesCreated: Number(json.created?.milestonesCreated ?? 0),
        sanitaryEventsCreated: Number(json.created?.sanitaryEventsCreated ?? 0),
        costPerKg: Math.round(validBagCost / 40),
      });
    } catch {
      setError("Error de red al guardar el arranque Día 1.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalFeedKg = Math.max(0, Number(bultos40kg || 0) * 40 + Number(kgAdicional || 0));
  const totalLiveAnimals = unidades.reduce(
    (sum, u) => sum + Math.max(0, Math.round(Number(u.cantidadVivaHoy) || 0)),
    0,
  );
  const canCompactPredio = initialFarmName.trim().length > 0 && !showPredioDetails;
  const hasLayingSpecies = selectedSpecies.includes("gallina") || selectedSpecies.includes("codorniz");
  const estimatedCostPerKg = Math.round((Math.max(0, Number(costoPorBulto40kg) || 0) / 40));

  return (
    <div className="flex flex-col max-h-[92dvh]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-green-950 px-5 py-4 text-white rounded-t-2xl">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Arranque Día 1 sin Fricción · &lt; 3 min</span>
          </p>
          <h2 id="onboarding-wizard-title" className="text-lg sm:text-xl font-bold mt-0.5">
            {completedSummary
              ? "¡Tu granja está lista para operar!"
              : "Configura tu granja sin llenar historial pasado"}
          </h2>
        </div>
        <button
          type="button"
          onClick={completedSummary ? onCompleted : onClose}
          className="rounded-lg p-2 text-emerald-200 hover:bg-green-900 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Cerrar asistente de arranque"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {completedSummary ? (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-emerald-950">
                {nombrePredio || "Tu granja"} quedó configurada con los datos de hoy
              </p>
              <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                Ya no tienes que transcribir cuadernos viejos. Desde este momento cada huevo o bulto de concentrado que registres actualizará tu bodega y tu utilidad neta del día.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                Inventario vivo
              </span>
              <strong className="text-lg font-bold text-slate-900 mt-1 block">
                {completedSummary.animalsCreated} animales
              </strong>
              <span className="text-xs text-slate-600">
                En {completedSummary.locationsCreated || unidades.length} galpón(es) o corral(es)
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                Bodega inicial
              </span>
              <strong className="text-lg font-bold text-slate-900 mt-1 block">
                {completedSummary.totalFeedKg.toLocaleString("es-CO")} kg
              </strong>
              <span className="text-xs text-slate-600">
                {completedSummary.costPerKg > 0
                  ? `Costo base: $${completedSummary.costPerKg.toLocaleString("es-CO")}/kg`
                  : "Listo para medir días de cobertura"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                Plan ICA y curvas
              </span>
              <strong className="text-lg font-bold text-emerald-800 mt-1 block">
                {completedSummary.sanitaryEventsCreated} vacunas · {completedSummary.milestonesCreated} metas
              </strong>
              <span className="text-xs text-slate-600">
                Ajustadas automáticamente a la edad actual
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-800">
              Da el primer paso ahora mismo (toma 15 segundos):
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onCompleted();
                  openQuickCapture({ mode: hasLayingSpecies ? "huevos" : "alimentacion" });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 min-h-[48px] text-sm font-semibold text-white hover:bg-green-800 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Hacer mi primer registro de hoy (15 seg)</span>
              </button>
              <button
                type="button"
                onClick={onCompleted}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 min-h-[48px] text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <span>Ir al tablero principal</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>

      {/* Stepper semantic nav */}
      <nav aria-label="Progreso de arranque" className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <ol className="grid grid-cols-3 gap-2 text-xs">
          {[
            { num: 1 as const, label: "1. Predio y Escala" },
            { num: 2 as const, label: "2. Animales Hoy" },
            { num: 3 as const, label: "3. Bodega y Listo" },
          ].map((item) => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <li
                key={item.num}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 font-semibold border ${
                  active
                    ? "bg-green-50 border-green-500 text-green-900"
                    : done
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                      : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${
                    active
                      ? "bg-green-700 text-white"
                      : done
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {done ? "✓" : item.num}
                </span>
                <span className="truncate">{item.label}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Form body */}
      <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {error && (
          <div role="status" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* PASO 1 */}
        <section hidden={step !== 1} className="space-y-4">
          <h3 ref={step === 1 ? stepHeadingRef : undefined} tabIndex={-1} className="text-base font-bold text-slate-900 outline-none">
            Paso 1 · Tu finca, animales y forma de trabajo
          </h3>
          <p className="text-xs text-slate-600">
            No necesitas cargar facturas pasadas ni bajas anteriores. Empezamos desde la fotografía viva de hoy.
          </p>

          {canCompactPredio ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm">
                <p className="font-bold text-slate-900">
                  {nombrePredio}
                  {administrador ? <span className="font-normal text-slate-600"> · {administrador}</span> : null}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {ciudad || altitudMsnm
                    ? `${ciudad || "Municipio por definir"}${altitudMsnm ? ` · ${altitudMsnm} msnm` : ""}`
                    : "Datos base tomados de tu registro inicial"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPredioDetails(true)}
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Editar ubicación / altitud (opcional)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ob-farm-name" className="block text-sm font-semibold text-slate-800 mb-1">
                  Nombre de la granja o predio <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="ob-farm-name"
                  name="nombrePredio"
                  type="text"
                  required
                  autoFocus
                  enterKeyHint="next"
                  value={nombrePredio}
                  onChange={(e) => setNombrePredioOverride(e.target.value)}
                  placeholder="Ej: Finca La Esperanza"
                  className="w-full min-h-[48px] rounded-lg border border-slate-400 px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label htmlFor="ob-city" className="block text-sm font-semibold text-slate-800 mb-1">
                  Municipio / ciudad (opcional)
                </label>
                <input
                  id="ob-city"
                  name="ciudad"
                  type="text"
                  enterKeyHint="next"
                  value={ciudad}
                  onChange={(e) => setCiudadOverride(e.target.value)}
                  placeholder="Ej: Rionegro, Antioquia"
                  className="w-full min-h-[48px] rounded-lg border border-slate-400 px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label htmlFor="ob-altitude" className="block text-sm font-semibold text-slate-800 mb-1">
                  Altitud aproximada (msnm)
                </label>
                <input
                  id="ob-altitude"
                  name="altitudMsnm"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={5500}
                  value={altitudMsnm}
                  onChange={(e) => setAltitudOverride(e.target.value)}
                  placeholder="Ej: 2100"
                  aria-describedby="ob-altitude-help"
                  className="w-full min-h-[48px] rounded-lg border border-slate-400 px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
                <span id="ob-altitude-help" className="block text-[11px] text-slate-500 mt-0.5">
                  Opcional: ajusta alertas térmicas según el clima de tu finca.
                </span>
              </div>

              <div>
                <label htmlFor="ob-admin" className="block text-sm font-semibold text-slate-800 mb-1">
                  Responsable o administrador
                </label>
                <input
                  id="ob-admin"
                  name="administrador"
                  type="text"
                  value={administrador}
                  onChange={(e) => setAdministradorOverride(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full min-h-[48px] rounded-lg border border-slate-400 px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>
          )}

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3.5 bg-slate-50/70">
            <legend className="px-1 text-sm font-bold text-slate-800">
              ¿Cómo prefieres empezar? (puedes cambiarlo después sin perder datos)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  value: "PEQUENO" as const,
                  title: "Pequeño Productor (Simple y rápido)",
                  desc: "Ideal para empezar: recoger huevos, dar alimento, anotar bajas, vacunas y ver tu ganancia del día.",
                },
                {
                  value: "MEDIANO" as const,
                  title: "Mediano / Comercial (Varios galpones)",
                  desc: "Activa clasificación de huevo por peso, costos separados por lote, cuadrillas con QR y reportes contables.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer min-h-[48px] transition-colors ${
                    escala === opt.value
                      ? "bg-green-50 border-green-600 ring-1 ring-green-600"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="escala"
                    value={opt.value}
                    checked={escala === opt.value}
                    onChange={() => setEscala(opt.value)}
                    className="mt-1 h-4 w-4 accent-green-700 shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{opt.title}</span>
                    <span className="block text-xs text-slate-600 mt-0.5">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3.5">
            <legend className="px-1 text-sm font-bold text-slate-800">
              Especies presentes hoy en la finca
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPECIES_CHOICES.map((sp) => {
                const checked = selectedSpecies.includes(sp.key);
                return (
                  <label
                    key={sp.key}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 min-h-[48px] text-sm font-medium cursor-pointer ${
                      checked ? "bg-emerald-50 border-emerald-500 text-emerald-950" : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSpecies(sp.key)}
                      className="h-4 w-4 accent-green-700"
                    />
                    <span>{sp.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 min-h-[48px]">
            <input
              type="checkbox"
              checked={solicitaReporteFormal}
              onChange={(e) => setSolicitaReporteFormal(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-green-700"
            />
            <span className="text-xs sm:text-sm text-slate-700">
              <strong className="text-slate-900">Necesito soportes para contabilidad (DIAN) o solicitud de crédito agropecuario</strong>
              <span className="block text-slate-500 mt-0.5">Habilita presupuestos y reportes financieros listos para descargar.</span>
            </span>
          </label>
        </section>

        {/* PASO 2 */}
        <section hidden={step !== 2} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 ref={step === 2 ? stepHeadingRef : undefined} tabIndex={-1} className="text-base font-bold text-slate-900 outline-none">
                Paso 2 · Inventario vivo actual por unidad
              </h3>
              <p className="text-xs text-slate-600">Registra solo los animales vivos al día de hoy o carga la plantilla CSV Día 1.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputMode("manual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${inputMode === "manual" ? "bg-green-700 text-white border-green-700" : "bg-white text-slate-700 border-slate-300"}`}
              >
                Captura rápida
              </button>
              <button
                type="button"
                onClick={() => setInputMode("csv")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${inputMode === "csv" ? "bg-green-700 text-white border-green-700" : "bg-white text-slate-700 border-slate-300"}`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Importar CSV</span>
              </button>
            </div>
          </div>

          {inputMode === "csv" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">
                  Usa la plantilla estándar sin histórico (`plantilla_arranque_dia1.csv`)
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-700 bg-white px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-50"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Descargar plantilla CSV</span>
                </button>
              </div>
              <div>
                <label htmlFor="ob-csv-file" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-100">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Seleccionar archivo .csv</span>
                </label>
                <input
                  id="ob-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleCsvFileUpload(e.target.files?.[0])}
                  className="sr-only"
                />
              </div>
              <div>
                <label htmlFor="ob-csv-text" className="block text-xs font-medium text-slate-700 mb-1">
                  O pega aquí las filas del CSV:
                </label>
                <textarea
                  id="ob-csv-text"
                  rows={5}
                  value={csvText}
                  onChange={(e) => handleImportCsvText(e.target.value)}
                  placeholder="nombre_instalacion,tipo_instalacion,especie,codigo_lote,linea_genetica,edad_actual_dias,cantidad_viva_hoy,saldo_concentrado_bultos_40kg"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs font-mono text-slate-800"
                />
              </div>
              {csvNotice && (
                <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {csvNotice}
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-3">
            {unidades.map((u, idx) => (
              <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Unidad activa #{idx + 1}
                  </span>
                  {unidades.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setUnidades((prev) => prev.filter((item) => item.id !== u.id))}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label htmlFor={`unit-loc-${u.id}`} className="block text-xs font-semibold text-slate-700 mb-1">
                      Galpón / Corral / Poza
                    </label>
                    <input
                      id={`unit-loc-${u.id}`}
                      type="text"
                      value={u.nombreInstalacion}
                      onChange={(e) =>
                        setUnidades((prev) =>
                          prev.map((row) => (row.id === u.id ? { ...row, nombreInstalacion: e.target.value } : row)),
                        )
                      }
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor={`unit-sp-${u.id}`} className="block text-xs font-semibold text-slate-700 mb-1">
                      Especie
                    </label>
                    <select
                      id={`unit-sp-${u.id}`}
                      value={u.especie}
                      onChange={(e) => {
                        const nextSp = e.target.value;
                        const info = SPECIES_CHOICES.find((s) => s.key === nextSp);
                        setUnidades((prev) =>
                          prev.map((row) =>
                            row.id === u.id
                              ? {
                                  ...row,
                                  especie: nextSp,
                                  nombreInstalacion: info?.defaultUnitName ?? row.nombreInstalacion,
                                  tipoInstalacion: info?.defaultLocType ?? row.tipoInstalacion,
                                  lineaGenetica: info?.defaultBreed ?? row.lineaGenetica,
                                  edadValor: info?.defaultAgeVal ?? row.edadValor,
                                  edadUnidad: info?.defaultAgeUnit ?? row.edadUnidad,
                                  edadActualDias: info
                                    ? computeAgeDays(info.defaultAgeVal, info.defaultAgeUnit)
                                    : row.edadActualDias,
                                  proposito: info?.defaultPurpose ?? row.proposito,
                                }
                              : row,
                          ),
                        );
                      }}
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                    >
                      {SPECIES_CHOICES.map((sp) => (
                        <option key={sp.key} value={sp.key}>{sp.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`unit-type-${u.id}`} className="block text-xs font-semibold text-slate-700 mb-1">
                      Tipo instalación
                    </label>
                    <select
                      id={`unit-type-${u.id}`}
                      value={u.tipoInstalacion}
                      onChange={(e) =>
                        setUnidades((prev) =>
                          prev.map((row) => (row.id === u.id ? { ...row, tipoInstalacion: e.target.value } : row)),
                        )
                      }
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                    >
                      <option value="galpon">Galpón en piso</option>
                      <option value="jaula">Jaulas elevadas</option>
                      <option value="corral">Corral / Poza</option>
                      <option value="potrero">Potrero / Pastoreo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label htmlFor={`unit-qty-${u.id}`} className="block text-xs font-semibold text-slate-700 mb-1">
                      Vivos hoy
                    </label>
                    <input
                      id={`unit-qty-${u.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={u.cantidadVivaHoy}
                      onChange={(e) =>
                        setUnidades((prev) =>
                          prev.map((row) => (row.id === u.id ? { ...row, cantidadVivaHoy: e.target.value } : row)),
                        )
                      }
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label htmlFor={`unit-age-${u.id}`} className="block text-xs font-semibold text-slate-700 mb-1">
                      Edad aprox. ({u.edadActualDias} días)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id={`unit-age-${u.id}`}
                        type="number"
                        min={0}
                        max={3650}
                        value={u.edadValor}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUnidades((prev) =>
                            prev.map((row) =>
                              row.id === u.id
                                ? {
                                    ...row,
                                    edadValor: val,
                                    edadActualDias: computeAgeDays(val, row.edadUnidad),
                                  }
                                : row,
                            ),
                          );
                        }}
                        className="w-20 min-h-[44px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                      />
                      <select
                        aria-label={`Unidad de edad para ${u.nombreInstalacion}`}
                        value={u.edadUnidad}
                        onChange={(e) => {
                          const unit = e.target.value as AgeUnit;
                          setUnidades((prev) =>
                            prev.map((row) =>
                              row.id === u.id
                                ? {
                                    ...row,
                                    edadUnidad: unit,
                                    edadActualDias: computeAgeDays(row.edadValor, unit),
                                  }
                                : row,
                            ),
                          );
                        }}
                        className="flex-1 min-h-[44px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white font-medium"
                      >
                        <option value="semanas">semanas</option>
                        <option value="dias">días</option>
                        <option value="meses">meses</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`unit-breed-${u.id}`} className="block text-xs font-semibold text-slate-700 mb-1">
                      Línea / raza
                    </label>
                    <input
                      id={`unit-breed-${u.id}`}
                      type="text"
                      value={u.lineaGenetica}
                      onChange={(e) =>
                        setUnidades((prev) =>
                          prev.map((row) => (row.id === u.id ? { ...row, lineaGenetica: e.target.value } : row)),
                        )
                      }
                      placeholder="Ej: Hy-Line Brown"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>

                {(BREED_SUGGESTIONS_BY_SPECIES[u.especie] ?? []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-slate-500">Sugeridas:</span>
                    {(BREED_SUGGESTIONS_BY_SPECIES[u.especie] ?? []).map((breedOption) => (
                      <button
                        key={breedOption}
                        type="button"
                        onClick={() =>
                          setUnidades((prev) =>
                            prev.map((row) =>
                              row.id === u.id ? { ...row, lineaGenetica: breedOption } : row,
                            ),
                          )
                        }
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                          u.lineaGenetica === breedOption
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {breedOption}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setUnidades((prev) => [
                  ...prev,
                  makeUnitDraftForSpecies(selectedSpecies[0] || "gallina", prev.length + 1),
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-green-600 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Agregar otra instalación o lote vivo</span>
            </button>
          </div>
        </section>

        {/* PASO 3 */}
        <section hidden={step !== 3} className="space-y-4">
          <h3 ref={step === 3 ? stepHeadingRef : undefined} tabIndex={-1} className="text-base font-bold text-slate-900 outline-none">
            Paso 3 · Bodega actual de alimento y despegue inmediato
          </h3>
          <p className="text-xs text-slate-600">
            Indica cuántos bultos o kilogramos tienes hoy en bodega para calcular de inmediato tus días de cobertura y activar el tablero.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="ob-feed-name" className="block text-xs font-semibold text-slate-800 mb-1">
                Alimento en bodega
              </label>
              <input
                id="ob-feed-name"
                type="text"
                value={nombreAlimento}
                onChange={(e) => setNombreAlimento(e.target.value)}
                className="w-full min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ob-feed-bags" className="block text-xs font-semibold text-slate-800 mb-1">
                Bultos de 40 kg hoy
              </label>
              <input
                id="ob-feed-bags"
                type="number"
                min={0}
                step="any"
                value={bultos40kg}
                onChange={(e) => setBultos40kg(e.target.value)}
                className="w-full min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div>
              <label htmlFor="ob-feed-kg" className="block text-xs font-semibold text-slate-800 mb-1">
                Kg sueltos adicionales
              </label>
              <input
                id="ob-feed-kg"
                type="number"
                min={0}
                step="any"
                value={kgAdicional}
                onChange={(e) => setKgAdicional(e.target.value)}
                className="w-full min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ob-feed-bag-cost" className="block text-xs font-semibold text-slate-800 mb-1">
                Valor aprox. bulto 40 kg ($ COP)
              </label>
              <input
                id="ob-feed-bag-cost"
                type="number"
                min={0}
                step={500}
                value={costoPorBulto40kg}
                onChange={(e) => setCostoPorBulto40kg(e.target.value)}
                placeholder="Ej: 78000"
                className="w-full min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Wheat className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Saldo inicial: {totalFeedKg.toLocaleString("es-CO")} kg</span>
              </span>
              <span className="text-[11px] text-amber-900">
                Costo para Utilidad Neta diaria: ${estimatedCostPerKg.toLocaleString("es-CO")}/kg
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Resumen Día 1 · Todo listo sin deuda histórica
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                <span className="text-slate-500 block">Predio</span>
                <strong className="text-slate-900 truncate block">{nombrePredio || "—"}</strong>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                <span className="text-slate-500 block">Animales vivos</span>
                <strong className="text-slate-900">{totalLiveAnimals}</strong>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                <span className="text-slate-500 block">Unidades</span>
                <strong className="text-slate-900">{unidades.length}</strong>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                <span className="text-slate-500 block">Fecha corte</span>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-transparent border-0 p-0 focus:outline-none"
                  aria-label="Fecha de inicio de operación"
                />
              </div>
            </div>

            {previewEvaluation.triggeredFlags.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Disparadores inteligentes que se activarán automáticamente:</span>
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {previewEvaluation.triggeredFlags.map((flagKey) => (
                    <li key={flagKey}>{FEATURE_FLAG_BY_KEY[flagKey]?.name ?? flagKey}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          {step > 1 ? (
            <button
              key="wizard-prev"
              type="button"
              onClick={() => moveToStep(step === 3 ? 2 : 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 min-h-[48px] text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Anterior</span>
            </button>
          ) : (
            <button
              key="wizard-later"
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 min-h-[48px] text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Hacerlo después
            </button>
          )}

          {step < 3 ? (
            <button
              key="wizard-next"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (step === 1 && validateStep1()) moveToStep(2);
                else if (step === 2 && validateStep2()) moveToStep(3);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 min-h-[48px] text-sm font-semibold text-white hover:bg-green-800"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              key="wizard-submit"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 min-h-[48px] text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? "Configurando granja..." : "Iniciar operación hoy"}</span>
            </button>
          )}
        </div>
      </form>
        </>
      )}
    </div>
  );
}


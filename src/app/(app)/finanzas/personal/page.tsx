"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  HeroActionButton,
  HeroActionLink,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Table,
  Textarea,
} from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { ANIMAL_SPECIES, SPECIES_LABELS } from "@/lib/species";
import { todayColombiaIso } from "@/lib/date-validation";
import { useOnboardingState } from "@/lib/useOnboardingState";
import { useActionQuery } from "@/lib/useActionQuery";
import { calculateTransportAllowanceCop, computePayrollLiquidation } from "@/lib/analytics/payroll-tax-supplies";
import OwnerLaborEstimator from "@/components/OwnerLaborEstimator";
import {
  DEFAULT_OWNER_LABOR_ESTIMATOR_SETTINGS,
  type OwnerLaborEstimatorSettings,
  type OwnerLaborSpeciesKey,
  type OwnerLaborWorkloadEstimate,
} from "@/lib/analytics/owner-labor-estimator";

interface StaffProfile {
  id: string;
  fullName: string;
  documentId: string | null;
  workerKind: "productor" | "apoyo";
  contractType: "propio" | "jornal" | "salario_fijo" | "prestacion_servicios";
  payPeriod: "hora" | "dia" | "semana" | "quincena" | "mes";
  baseRateCop: string;
  roleLabel: string | null;
  defaultSpecies: string | null;
  defaultLocationId: string | null;
  applySocialSecurity: boolean;
  includeTransportAllowance: boolean;
  employerBurdenPct: string;
  workerDeductionPct: string;
  arlRiskRatePct: string;
  isActive: boolean;
  notes: string | null;
}

interface PayrollEntry {
  id: string;
  staffId: string;
  staffName: string;
  workerKind: string;
  contractType: string;
  payPeriod: string;
  roleLabel: string | null;
  date: string;
  unitsWorked: string;
  unitRateCop: string;
  grossPayCop: string;
  bonusesCop: string;
  employerBurdenCop: string;
  workerDeductionsCop: string;
  reteFuenteCop: string;
  netPayableCop: string;
  totalEmployerCostCop: string;
  accountingMode: "cash_expense" | "imputed_economic";
  paymentStatus: "pagado" | "pendiente" | "calculado";
  dueDate: string | null;
  species: string | null;
  locationId: string | null;
  locationName: string | null;
  prorationBasis: string | null;
  notes: string | null;
}

interface TaxConfigSummary {
  smlmvCop: number;
  dailySmlmvCop: number;
  transportAllowanceCop: number;
  employerBurdenPct: number;
  workerDeductionPct: number;
  reteServiciosPct: number;
  transportAllowanceMaxSmlmv: number;
  daysPerMonth: number;
  hoursPerDay: number;
  ordinaryHoursPerMonth: number;
  ownerReferenceHourlyRateCop: number;
  weeksPerMonth: number;
  quincenasPerMonth: number;
  includeImputedOwnerLabor: boolean;
  ownerLabor: OwnerLaborEstimatorSettings;
}

interface FarmLocationOption {
  id: string;
  name: string;
  type?: string;
  status?: string;
  operationalStatus?: string;
  allowedSpecies?: string[];
  animals?: number;
}

const OWNER_CARE_LOCATION_TYPES = new Set(["corral", "jaula", "galpon", "potrero", "jardin", "patio"]);

function emptyOwnerLaborCounts(): Partial<Record<OwnerLaborSpeciesKey, number>> {
  return {
    gallina: 0,
    gallo: 0,
    pollo: 0,
    codorniz: 0,
    pato: 0,
    conejo: 0,
    cuy: 0,
  };
}

const fmt = (v: number | string) => `$${Math.round(Number(v || 0)).toLocaleString("es-CO")}`;

const CONTRACT_LABELS: Record<string, string> = {
  propio: "Trabajo propio (productor)",
  jornal: "Jornalero / día",
  salario_fijo: "Contrato fijo mensual",
  prestacion_servicios: "Prestación de servicios",
};

const PRORATION_LABELS: Record<string, string> = {
  "": "Directo (según perfil o sin asignar)",
  head_count: "Repartir por cabezas vivas",
  biomass: "Repartir por biomasa (kg)",
  feed_kg: "Repartir por consumo de alimento",
  area_m2: "Repartir por área (m²)",
  manual: "Prorrateo por tiempo estimado",
};

export default function PersonalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando personal...</div>}>
      <PersonalPageInner />
    </Suspense>
  );
}

function PersonalPageInner() {
  const searchParams = useSearchParams();
  const { config, isFlagEnabled } = useOnboardingState();
  const isMediano = config?.scale === "MEDIANO";
  const prorationEnabled = isFlagEnabled("centros_costo_prorrateo");

  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [locations, setLocations] = useState<FarmLocationOption[]>([]);
  const [animalCounts, setAnimalCounts] = useState<Partial<Record<OwnerLaborSpeciesKey, number>>>(emptyOwnerLaborCounts);
  const [taxConfig, setTaxConfig] = useState<TaxConfigSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState({
    ownerImputedMonthCop: 0,
    ownerCashMonthCop: 0,
    supportCashMonthCop: 0,
    pendingPayablesMonthCop: 0,
  });
  const [loading, setLoading] = useState(true);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [staffError, setStaffError] = useState("");

  const [liqModalOpen, setLiqModalOpen] = useState(false);
  const [isEstimatedOwnerLabor, setIsEstimatedOwnerLabor] = useState(false);
  const [ownerLaborAllocationHours, setOwnerLaborAllocationHours] = useState<Partial<Record<OwnerLaborSpeciesKey, number>>>({});
  const [liqError, setLiqError] = useState("");
  const [savingLiquidation, setSavingLiquidation] = useState(false);
  const savingLiquidationRef = useRef(false);
  const liquidationMutationIdRef = useRef<string | null>(null);

  const [staffForm, setStaffForm] = useState({
    fullName: "",
    documentId: "",
    workerKind: "productor" as "productor" | "apoyo",
    contractType: "propio" as StaffProfile["contractType"],
    payPeriod: "dia" as StaffProfile["payPeriod"],
    baseRateCop: "",
    roleLabel: "Productor principal",
    defaultSpecies: "",
    defaultLocationId: "",
    applySocialSecurity: false,
    includeTransportAllowance: false,
    employerBurdenPct: "",
    workerDeductionPct: "",
    notes: "",
  });

  const [liqForm, setLiqForm] = useState({
    staffId: "",
    date: todayColombiaIso(),
    periodFrom: "",
    periodTo: "",
    unitsWorked: "1",
    unitRateCop: "",
    bonusesCop: "0",
    accountingMode: "imputed_economic" as "cash_expense" | "imputed_economic",
    isCredit: false,
    dueDate: "",
    applySocialSecurity: false,
    employerBurdenPct: "0",
    workerDeductionPct: "0",
    reteFuenteRatePct: "0",
    species: "",
    locationId: "",
    prorationBasis: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayColombiaIso();
      const yearStart = `${today.slice(0, 4)}-01-01`;
      const [staffRes, liqRes, locRes, inventoryRes] = await Promise.all([
        apiFetch("/api/finanzas/personal").then((r) => r.json()),
        apiFetch(`/api/finanzas/personal/liquidaciones?from=${yearStart}&to=${today}`).then((r) => r.json()),
        apiFetch("/api/ubicaciones?active=true").then((r) => r.json()),
        apiFetch("/api/inventarios/animales").then((r) => r.json()),
      ]);
      let profList: StaffProfile[] = Array.isArray(staffRes?.profiles) ? staffRes.profiles : [];
      if (!profList.some((profile) => profile.workerKind === "productor" && profile.isActive)) {
        const defaultProducerRes = await apiFetch("/api/finanzas/personal/default-producer", { method: "POST" });
        if (defaultProducerRes.ok) {
          const defaultProducerData = await defaultProducerRes.json().catch(() => null);
          const defaultProducer = defaultProducerData?.profile as StaffProfile | undefined;
          if (defaultProducer && !profList.some((profile) => profile.id === defaultProducer.id)) {
            profList = [...profList, defaultProducer];
          }
        }
      }
      setProfiles(profList);
      if (staffRes?.taxConfig) setTaxConfig(staffRes.taxConfig);
      if (staffRes?.monthSummary) setMonthSummary(staffRes.monthSummary);
      setEntries(Array.isArray(liqRes?.entries) ? liqRes.entries : []);
      setLocations(Array.isArray(locRes) ? locRes : []);
      const nextAnimalCounts = emptyOwnerLaborCounts();
      if (Array.isArray(inventoryRes?.species)) {
        for (const row of inventoryRes.species) {
          const key = String(row?.species || "") as OwnerLaborSpeciesKey;
          if (key in nextAnimalCounts) nextAnimalCounts[key] = Math.max(0, Number(row?.count || 0));
        }
      }
      setAnimalCounts(nextAnimalCounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openNewStaff = useCallback(
    (presetKind?: "productor" | "apoyo", hourlyOwnerEstimateProfile = false) => {
      setEditingStaff(null);
      setStaffError("");
      const kind = presetKind || (profiles.some((p) => p.workerKind === "productor") ? "apoyo" : "productor");
      setStaffForm({
        fullName: kind === "productor"
          ? hourlyOwnerEstimateProfile
            ? "Trabajo propio · valoración horaria"
            : "Mi trabajo (Productor)"
          : "",
        documentId: "",
        workerKind: kind,
        contractType: kind === "productor" ? "propio" : isMediano ? "salario_fijo" : "jornal",
        payPeriod: kind === "productor" ? "hora" : isMediano ? "mes" : "dia",
        baseRateCop: kind === "productor"
          ? String(taxConfig?.ownerReferenceHourlyRateCop ?? "")
          : isMediano
            ? String(taxConfig?.smlmvCop ?? "")
            : String(taxConfig?.dailySmlmvCop ?? ""),
        roleLabel: kind === "productor"
          ? hourlyOwnerEstimateProfile
            ? "Trabajo propio · valoración económica"
            : "Propietario / Productor"
          : "Galponero / Apoyo",
        defaultSpecies: "",
        defaultLocationId: "",
        applySocialSecurity: kind === "apoyo" && isMediano,
        includeTransportAllowance: false,
        employerBurdenPct: String(taxConfig?.employerBurdenPct ?? ""),
        workerDeductionPct: String(taxConfig?.workerDeductionPct ?? ""),
        notes: "",
      });
      setStaffModalOpen(true);
    },
    [isMediano, profiles, taxConfig],
  );

  const openEditStaff = (p: StaffProfile) => {
    setEditingStaff(p);
    setStaffError("");
    setStaffForm({
      fullName: p.fullName,
      documentId: p.documentId || "",
      workerKind: p.workerKind,
      contractType: p.contractType,
      payPeriod: p.payPeriod,
      baseRateCop: p.baseRateCop,
      roleLabel: p.roleLabel || "",
      defaultSpecies: p.defaultSpecies || "",
      defaultLocationId: p.defaultLocationId || "",
      applySocialSecurity: p.workerKind === "productor" && p.payPeriod === "hora" ? false : p.applySocialSecurity,
      includeTransportAllowance: p.includeTransportAllowance,
      employerBurdenPct: String(taxConfig?.employerBurdenPct ?? ""),
      workerDeductionPct: String(taxConfig?.workerDeductionPct ?? ""),
      notes: p.notes || "",
    });
    setStaffModalOpen(true);
  };

  const openLiquidationFor = useCallback(
    (staff?: StaffProfile) => {
      setIsEstimatedOwnerLabor(false);
      setLiqError("");
      liquidationMutationIdRef.current = null;
      const target = staff || profiles.find((p) => p.isActive) || profiles[0];
      if (!target) {
        openNewStaff("productor");
        return;
      }
      const defaultMode = target.workerKind === "productor" ? "imputed_economic" : "cash_expense";
      setLiqForm({
        staffId: target.id,
        date: todayColombiaIso(),
        periodFrom: "",
        periodTo: "",
        unitsWorked: "1",
        unitRateCop: target.baseRateCop,
        bonusesCop: "0",
        accountingMode: defaultMode,
        isCredit: false,
        dueDate: "",
        applySocialSecurity: target.applySocialSecurity,
        employerBurdenPct: String(taxConfig?.employerBurdenPct ?? "0"),
        workerDeductionPct: String(taxConfig?.workerDeductionPct ?? "0"),
        reteFuenteRatePct: target.contractType === "prestacion_servicios" ? String(taxConfig?.reteServiciosPct ?? 0) : "0",
        species: target.defaultSpecies || "",
        locationId: target.defaultLocationId || "",
        prorationBasis: "",
        notes: "",
      });
      setLiqModalOpen(true);
    },
    [openNewStaff, profiles, taxConfig],
  );

  useActionQuery(searchParams.get("nuevo"), { "1": () => openLiquidationFor() });

  const onSelectLiquidationStaff = (staffId: string) => {
    const s = profiles.find((p) => p.id === staffId);
    if (!s) return;
    setLiqForm((prev) => ({
      ...prev,
      staffId,
      unitRateCop: s.baseRateCop,
      accountingMode: s.workerKind === "productor" ? "imputed_economic" : "cash_expense",
      applySocialSecurity: s.applySocialSecurity,
      employerBurdenPct: String(taxConfig?.employerBurdenPct ?? "0"),
      workerDeductionPct: String(taxConfig?.workerDeductionPct ?? "0"),
      reteFuenteRatePct: s.contractType === "prestacion_servicios" ? String(taxConfig?.reteServiciosPct ?? 0) : "0",
      species: s.defaultSpecies || "",
      locationId: s.defaultLocationId || "",
    }));
  };

  const liqPreview = useMemo(
    () => {
      const selectedStaff = profiles.find((profile) => profile.id === liqForm.staffId);
      const transportAllowanceCop = selectedStaff && taxConfig
        ? calculateTransportAllowanceCop({
            eligible: selectedStaff.includeTransportAllowance,
            workerKind: selectedStaff.workerKind,
            contractType: selectedStaff.contractType,
            payPeriod: selectedStaff.payPeriod,
            unitsWorked: Number(liqForm.unitsWorked || 0),
            unitRateCop: Number(selectedStaff.baseRateCop || 0),
            smlmvCop: taxConfig.smlmvCop,
            allowanceMonthlyCop: taxConfig.transportAllowanceCop,
            maximumMonthlySmlmv: taxConfig.transportAllowanceMaxSmlmv,
            daysPerMonth: taxConfig.daysPerMonth,
            hoursPerDay: taxConfig.hoursPerDay,
            weeksPerMonth: taxConfig.weeksPerMonth,
            quincenasPerMonth: taxConfig.quincenasPerMonth,
          })
        : 0;
      return computePayrollLiquidation({
        unitsWorked: Number(liqForm.unitsWorked || 0),
        unitRateCop: Number(liqForm.unitRateCop || 0),
        bonusesCop: Number(liqForm.bonusesCop || 0),
        transportAllowanceCop,
        applySocialSecurity: liqForm.applySocialSecurity,
        employerBurdenPct: Number(liqForm.employerBurdenPct || 0),
        workerDeductionPct: Number(liqForm.workerDeductionPct || 0),
        reteFuenteRatePct: Number(liqForm.reteFuenteRatePct || 0),
      });
    },
    [liqForm, profiles, taxConfig],
  );

  const saveStaff = async () => {
    setStaffError("");
    const res = await apiFetch("/api/finanzas/personal", {
      method: editingStaff ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingStaff ? { id: editingStaff.id } : {}),
        ...staffForm,
        baseRateCop: Number(staffForm.baseRateCop),
        employerBurdenPct: Number(staffForm.employerBurdenPct || 0),
        workerDeductionPct: Number(staffForm.workerDeductionPct || 0),
        defaultSpecies: staffForm.defaultSpecies || null,
        defaultLocationId: staffForm.defaultLocationId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStaffError(data.error || "No se pudo guardar el perfil");
      return;
    }
    setStaffModalOpen(false);
    await load();
  };

  const deleteStaff = async (id: string) => {
    if (!confirm("¿Eliminar o archivar esta persona?")) return;
    await apiFetch(`/api/finanzas/personal?id=${id}`, { method: "DELETE" });
    await load();
  };

  const saveLiquidation = async () => {
    if (savingLiquidationRef.current) return;
    setLiqError("");
    const ownerAllocationRows = Object.entries(ownerLaborAllocationHours)
      .filter(([, hours]) => Number(hours || 0) > 0);
    const ownerAllocationHoursTotal = ownerAllocationRows.reduce((sum, [, hours]) => sum + Number(hours || 0), 0);
    const ownerLaborAllocations = isEstimatedOwnerLabor && ownerAllocationHoursTotal > 0
      ? ownerAllocationRows.map(([species, hours]) => ({
          species,
          percentage: Number(((Number(hours) / ownerAllocationHoursTotal) * 100).toFixed(4)),
        }))
      : undefined;
    savingLiquidationRef.current = true;
    setSavingLiquidation(true);
    liquidationMutationIdRef.current ||= crypto.randomUUID();
    let res: Response;
    try {
      res = await apiFetch("/api/finanzas/personal/liquidaciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Mutation-Id": liquidationMutationIdRef.current,
        },
        body: JSON.stringify({
          ...liqForm,
          unitsWorked: Number(liqForm.unitsWorked),
          unitRateCop: Number(liqForm.unitRateCop),
          bonusesCop: Number(liqForm.bonusesCop || 0),
          employerBurdenPct: Number(liqForm.employerBurdenPct || 0),
          workerDeductionPct: Number(liqForm.workerDeductionPct || 0),
          reteFuenteRatePct: Number(liqForm.reteFuenteRatePct || 0),
          species: liqForm.species || null,
          locationId: liqForm.locationId || null,
          prorationBasis: liqForm.prorationBasis || null,
          ownerLaborAllocations,
          ownerLaborEstimate: isEstimatedOwnerLabor,
        }),
      });
    } catch (err) {
      savingLiquidationRef.current = false;
      setSavingLiquidation(false);
      throw err;
    }
    savingLiquidationRef.current = false;
    setSavingLiquidation(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLiqError(data.error || "No se pudo registrar la liquidación");
      return;
    }
    liquidationMutationIdRef.current = null;
    setLiqModalOpen(false);
    await load();
  };

  const convertToCash = async (entryId: string) => {
    if (!confirm("¿Registrar este trabajo propio calculado como un pago real salido de caja?")) return;
    const res = await apiFetch("/api/finanzas/personal/liquidaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entryId, action: "convert_to_cash" }),
    });
    if (res.ok) await load();
  };

  const deleteEntry = async (entryId: string) => {
    if (!confirm("¿Eliminar esta liquidación?")) return;
    const res = await apiFetch(`/api/finanzas/personal/liquidaciones?id=${entryId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "No se pudo eliminar");
      return;
    }
    await load();
  };

  const ownerProfiles = profiles.filter((p) => p.workerKind === "productor" && p.isActive);
  const supportProfiles = profiles.filter((p) => p.workerKind === "apoyo");
  const ownerHourlyProfile = ownerProfiles.find((profile) => profile.payPeriod === "hora") || null;
  const activeCareLocations = locations.filter((location) => {
    if (location.status === "inactiva" || location.operationalStatus === "fuera_servicio") return false;
    if (location.type && OWNER_CARE_LOCATION_TYPES.has(location.type)) return true;
    return location.type === "otro" && Boolean(location.allowedSpecies?.length);
  }).length;
  const activeAnimalCount = Object.values(animalCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const initialCareLocations = activeCareLocations || (activeAnimalCount > 0 ? 1 : 0);
  const ownerLaborSettings = taxConfig?.ownerLabor || DEFAULT_OWNER_LABOR_ESTIMATOR_SETTINGS;

  const configureOwnerHourlyRate = () => {
    openNewStaff("productor", ownerProfiles.length > 0);
  };

  const prepareEstimatedOwnerLiquidation = (estimate: OwnerLaborWorkloadEstimate) => {
    if (!ownerHourlyProfile) {
      configureOwnerHourlyRate();
      return;
    }
    setIsEstimatedOwnerLabor(true);
    setLiqError("");
    liquidationMutationIdRef.current = null;
    setOwnerLaborAllocationHours(estimate.speciesHoursPerMonth);
    const today = todayColombiaIso();
    const [year, month] = today.split("-").map(Number);
    const periodFrom = `${today.slice(0, 7)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodTo = `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
    setLiqForm({
      staffId: ownerHourlyProfile.id,
      date: periodFrom,
      periodFrom,
      periodTo,
      unitsWorked: String(estimate.ownerHoursPerMonth),
      unitRateCop: ownerHourlyProfile.baseRateCop,
      bonusesCop: "0",
      accountingMode: "imputed_economic",
      isCredit: false,
      dueDate: "",
      applySocialSecurity: false,
      employerBurdenPct: "0",
      workerDeductionPct: "0",
      reteFuenteRatePct: "0",
      species: "",
      locationId: "",
      prorationBasis: Object.values(estimate.speciesHoursPerMonth).some((hours) => hours > 0) ? "manual" : "",
      notes: "Estimación mensual de trabajo propio según instalaciones, inventario por especie y tiempos de referencia. Revisar antes de confirmar.",
    });
    setLiqModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal, Trabajo Propio y Nómina"
        description={
          isMediano
            ? "Gestiona personal de apoyo, jornales, seguridad social, retenciones y reparto entre especies o galpones."
            : "Registra los pagos reales y estima el tiempo que sí dedicas a la granja. El trabajo propio no se presume como una jornada completa."
        }
        help={`• Nómina y jornales contratados se calculan con la tarifa y condiciones de cada perfil.\n• El estimador de trabajo propio usa instalaciones, cantidades por especie, días de cuidado y participación del productor.\n• La tarifa horaria inicial equivale a una hora de SMMLV más el costo patronal y el auxilio de transporte configurados; puedes ajustarla a las condiciones reales de tu territorio.\n• La estimación no se registra sola: al confirmarla queda como costo económico, sin salida de caja.\n• Si está activado «Incluir trabajo propio en punto de equilibrio», el costo confirmado entra al análisis unitario; revisa y calibra los minutos de referencia en Catálogos.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <HeroActionButton
              tone="solid"
              onClick={() => ownerHourlyProfile ? openLiquidationFor(ownerHourlyProfile) : configureOwnerHourlyRate()}
            >
              <Plus className="w-4 h-4" />
              <span>{ownerHourlyProfile ? "Registrar horas propias" : ownerProfiles.length > 0 ? "Configurar tarifa por hora" : "Configurar mi trabajo"}</span>
            </HeroActionButton>
            <HeroActionButton tone="glass" onClick={() => openNewStaff("apoyo")}>
              <UserPlus className="w-4 h-4" />
              <span>Agregar personal</span>
            </HeroActionButton>
            <HeroActionLink href="/configuracion/catalogos?tab=personal" tone="glass">
              <span>Parámetros SMLMV / Aportes</span>
            </HeroActionLink>
          </div>
        }
      />

      <Card className={isMediano ? "border-sky-200 bg-sky-50/40" : "border-emerald-200 bg-emerald-50/50"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>{isMediano ? "Modo Mediano: Nómina, Aportes y Prorrateo" : "Modo Pequeño: Valora el tiempo que sí trabajas"}</span>
            </p>
            <p className="text-sm text-slate-700 max-w-3xl">
              {isMediano
                ? `Referencias configuradas: SMLMV ${fmt(taxConfig?.smlmvCop ?? 0)} · Auxilio ${fmt(taxConfig?.transportAllowanceCop ?? 0)} · Aporte empleador ${taxConfig?.employerBurdenPct ?? 0}% · Deducción trabajador ${taxConfig?.workerDeductionPct ?? 0}%.`
                : "El cálculo parte de las tareas y animales que atiendes. Solo registra horas y una tarifa por hora cuando quieras valorar ese aporte; un costo imputado no es un pago ni una obligación de retirar un salario mensual."}
            </p>
          </div>
          <Badge color={taxConfig?.includeImputedOwnerLabor ? "green" : "gray"}>
            {taxConfig?.includeImputedOwnerLabor
              ? "Trabajo propio incluido en punto de equilibrio"
              : "Solo pagos en caja"}
          </Badge>
        </div>
      </Card>

      <OwnerLaborEstimator
        dataLoaded={!loading}
        initialInstallations={initialCareLocations}
        initialAnimalCounts={animalCounts}
        settings={ownerLaborSettings}
        ownerHourlyRateCop={ownerHourlyProfile ? Number(ownerHourlyProfile.baseRateCop) : null}
        includeInBreakEven={Boolean(taxConfig?.includeImputedOwnerLabor)}
        onConfigureHourlyRate={configureOwnerHourlyRate}
        onUseEstimate={prepareEstimatedOwnerLiquidation}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon="sparkles"
          label="Trabajo propio valorado (mes)"
          value={fmt(monthSummary.ownerImputedMonthCop)}
          color="green"
        />
        <StatCard
          icon="banknote"
          label="Retiros sueldo propio (caja)"
          value={fmt(monthSummary.ownerCashMonthCop)}
          color="blue"
        />
        <StatCard
          icon="users"
          label="Personal de apoyo (mes)"
          value={fmt(monthSummary.supportCashMonthCop)}
          color="purple"
        />
        <StatCard
          icon="card"
          label="Nómina por pagar (CxP)"
          value={fmt(monthSummary.pendingPayablesMonthCop)}
          color="yellow"
        />
      </div>

      {/* Perfiles de personal */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>Equipo de trabajo y tarifas ({profiles.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Regístrate tú primero como productor y añade trabajadores fijos, jornaleros o técnicos.
            </p>
          </div>
          <div className="flex gap-2">
            {ownerProfiles.length === 0 && (
              <Button onClick={() => openNewStaff("productor")}>+ Mi perfil de productor</Button>
            )}
            <Button onClick={() => openNewStaff("apoyo")}>+ Persona de apoyo</Button>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-6 text-slate-400">Cargando personal...</p>
        ) : profiles.length === 0 ? (
          <EmptyState
            icon="users"
            message="Aún no registras tu trabajo propio ni personal de apoyo. Empieza con una tarifa horaria de referencia que tú defines."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-4 space-y-2 ${p.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{p.fullName}</p>
                    <p className="text-xs text-slate-500">{p.roleLabel || CONTRACT_LABELS[p.contractType]}</p>
                  </div>
                  <Badge color={p.workerKind === "productor" ? "green" : "blue"}>
                    {p.workerKind === "productor" ? "Productor" : "Apoyo"}
                  </Badge>
                </div>
                <p className="text-base font-bold text-emerald-800">
                  {fmt(p.baseRateCop)} <span className="text-xs font-normal text-slate-500">/ {p.payPeriod}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                    {CONTRACT_LABELS[p.contractType] || p.contractType}
                  </span>
                  {p.applySocialSecurity && (
                    <span className="rounded bg-sky-100 text-sky-800 px-2 py-0.5 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> +{taxConfig?.employerBurdenPct ?? 0}% / -{taxConfig?.workerDeductionPct ?? 0}%
                    </span>
                  )}
                  {p.includeTransportAllowance && (
                    <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5">
                      Auxilio vigente
                    </span>
                  )}
                  {p.defaultSpecies && (
                    <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 capitalize">
                      {(SPECIES_LABELS as Record<string, { singular: string }>)[p.defaultSpecies]?.singular || p.defaultSpecies}
                    </span>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => openLiquidationFor(p)}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    + Liquidar jornal / pago
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEditStaff(p)} className="text-blue-600 hover:underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => deleteStaff(p.id)} className="text-red-600 hover:underline">
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Historial de liquidaciones */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BadgeDollarSign className="w-4 h-4 text-emerald-700" />
              <span>Registros de jornales y nómina ({entries.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Los registros en modo &quot;Calculado (trabajo propio)&quot; entran al punto de equilibrio y puedes pasarlos a caja cuando te pagues.
            </p>
          </div>
          {profiles.length > 0 && (
            <Button onClick={() => openLiquidationFor()}>+ Nueva liquidación</Button>
          )}
        </div>

        {entries.length === 0 ? (
          <EmptyState icon="banknote" message="Aún no hay liquidaciones registradas en el año." />
        ) : (
          <Table
            headers={[
              "Fecha",
              "Persona",
              "Cantidad",
              "Bruto",
              "Aportes emp.",
              "Deducciones / Rete",
              "Neto trabajador",
              "Costo total",
              "Estado",
              "",
            ]}
          >
            {entries.map((e) => {
              const dedTotal = Number(e.workerDeductionsCop || 0) + Number(e.reteFuenteCop || 0);
              return (
                <tr key={e.id} className="hover:bg-slate-50 text-sm">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {new Date(`${e.date}T12:00:00`).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-slate-900">{e.staffName}</p>
                    <p className="text-[11px] text-slate-500">
                      {e.species || (e.prorationBasis ? `Prorrateo: ${e.prorationBasis}` : "General")}
                      {e.locationName ? ` · ${e.locationName}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {Number(e.unitsWorked)} {e.payPeriod}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmt(e.grossPayCop)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{fmt(e.employerBurdenCop)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-amber-700">
                    {dedTotal > 0 ? `-${fmt(dedTotal)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-emerald-700">
                    {fmt(e.netPayableCop)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-bold text-slate-900">
                    {fmt(e.totalEmployerCostCop)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {e.accountingMode === "imputed_economic" ? (
                      <Badge color="purple">Calculado (equilibrio)</Badge>
                    ) : e.paymentStatus === "pendiente" ? (
                      <Badge color="yellow">Por pagar (CxP)</Badge>
                    ) : (
                      <Badge color="green">Pagado en caja</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {e.accountingMode === "imputed_economic" && (
                        <button
                          type="button"
                          onClick={() => convertToCash(e.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                          title="Registrar retiro real de caja"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" /> Retirar en caja
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteEntry(e.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Eliminar liquidación"
                        aria-label="Eliminar liquidación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {supportProfiles.length === 0 && !isMediano && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span>
            ¿Necesitas gestionar contratos mensuales, ARL, aportes parafiscales y prorrateo avanzado?
          </span>
          <Link href="/configuracion/modulos" className="font-semibold text-emerald-700 underline">
            Cambiar a escala Mediano →
          </Link>
        </div>
      )}

      {/* Modal Perfil de Personal */}
      <Modal
        open={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        title={editingStaff ? "Editar perfil de trabajo" : "Nuevo perfil de productor o personal"}
      >
        <div className="space-y-4">
          {staffError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{staffError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nombre completo"
              value={staffForm.fullName}
              onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
              placeholder="Ej: Mi trabajo / Carlos Pérez"
              required
            />
            <Input
              label="Cédula / NIT (opcional)"
              value={staffForm.documentId}
              onChange={(e) => setStaffForm({ ...staffForm, documentId: e.target.value })}
              placeholder="Ej: 93.456.789"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Tipo"
              value={staffForm.workerKind}
              onChange={(e) => {
                const kind = e.target.value as "productor" | "apoyo";
                setStaffForm({
                  ...staffForm,
                  workerKind: kind,
                  contractType: kind === "productor" ? "propio" : "jornal",
                  applySocialSecurity: kind === "productor" && staffForm.payPeriod === "hora" ? false : staffForm.applySocialSecurity,
                  includeTransportAllowance: kind === "apoyo" ? staffForm.includeTransportAllowance : false,
                });
              }}
            >
              <option value="productor">Trabajo propio (productor)</option>
              <option value="apoyo">Personal de apoyo</option>
            </Select>
            <Select
              label="Vínculo / contrato"
              value={staffForm.contractType}
              onChange={(e) => {
                const ct = e.target.value as StaffProfile["contractType"];
                setStaffForm({
                  ...staffForm,
                  contractType: ct,
                  applySocialSecurity: ct === "salario_fijo" ? true : staffForm.applySocialSecurity,
                  includeTransportAllowance: ct === "prestacion_servicios" ? false : staffForm.includeTransportAllowance,
                });
              }}
            >
              <option value="propio">Trabajo propio</option>
              <option value="jornal">Jornal / por día</option>
              <option value="salario_fijo">Contrato laboral fijo</option>
              <option value="prestacion_servicios">Prestación de servicios</option>
            </Select>
            <Select
              label="Periodo tarifa"
              value={staffForm.payPeriod}
              onChange={(e) => {
                const payPeriod = e.target.value as StaffProfile["payPeriod"];
                setStaffForm({
                  ...staffForm,
                  payPeriod,
                  applySocialSecurity: staffForm.workerKind === "productor" && payPeriod === "hora"
                    ? false
                    : staffForm.applySocialSecurity,
                });
              }}
            >
              <option value="dia">Día / jornal</option>
              <option value="hora">Hora</option>
              <option value="semana">Semana</option>
              <option value="quincena">Quincena</option>
              <option value="mes">Mes</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={staffForm.workerKind === "productor" && staffForm.payPeriod === "hora"
                ? "Tarifa horaria de referencia (COP/h)"
                : `Tarifa base (COP/${staffForm.payPeriod})`}
              help={staffForm.workerKind === "productor" && staffForm.payPeriod === "hora"
                ? `Referencia inicial: (SMLMV + ${taxConfig?.employerBurdenPct ?? 0}% de costo patronal + auxilio de transporte configurado) ÷ ${taxConfig?.ordinaryHoursPerMonth ?? 210} horas. Puedes modificarla por territorio. La valoración no crea un pago y las horas se confirman por periodo.`
                : undefined}
              type="number"
              min="1"
              step="100"
              value={staffForm.baseRateCop}
              onChange={(e) => setStaffForm({ ...staffForm, baseRateCop: e.target.value })}
              required
            />
            <Input
              label="Cargo / labor"
              value={staffForm.roleLabel}
              onChange={(e) => setStaffForm({ ...staffForm, roleLabel: e.target.value })}
              placeholder="Ej: Productor / Galponero"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Especie principal (opcional)"
              value={staffForm.defaultSpecies}
              onChange={(e) => setStaffForm({ ...staffForm, defaultSpecies: e.target.value })}
            >
              <option value="">Compartido / todas</option>
              {ANIMAL_SPECIES.map((sp) => (
                <option key={sp} value={sp}>
                  {(SPECIES_LABELS as Record<string, { singular: string }>)[sp]?.singular || sp}
                </option>
              ))}
            </Select>
            <Select
              label="Galpón / lugar asignado (opcional)"
              value={staffForm.defaultLocationId}
              onChange={(e) => setStaffForm({ ...staffForm, defaultLocationId: e.target.value })}
            >
              <option value="">General / varios lugares</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={staffForm.applySocialSecurity}
                disabled={staffForm.workerKind === "productor" && staffForm.payPeriod === "hora"}
                onChange={(e) => setStaffForm({ ...staffForm, applySocialSecurity: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>{staffForm.workerKind === "productor" && staffForm.payPeriod === "hora"
                ? "La tarifa de referencia ya incluye los costos patronales configurados"
                : "Aplicar seguridad social, prestaciones y deducciones por defecto"}</span>
            </label>
            {staffForm.applySocialSecurity && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="% Aporte empleador"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={taxConfig?.employerBurdenPct ?? ""}
                  disabled
                />
                <Input
                  label="% Deducción trabajador"
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={taxConfig?.workerDeductionPct ?? ""}
                  disabled
                />
              </div>
            )}
            {staffForm.workerKind === "apoyo" && staffForm.contractType !== "prestacion_servicios" && (
              <label className="inline-flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={staffForm.includeTransportAllowance}
                  onChange={(e) => setStaffForm({ ...staffForm, includeTransportAllowance: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  Aplica auxilio de transporte según su perfil. Cada liquidación tomará el valor vigente y validará el tope de SMLMV configurado.
                </span>
              </label>
            )}
          </div>

          <Textarea
            label="Notas"
            value={staffForm.notes}
            onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStaffModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveStaff}>Guardar perfil</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Liquidación */}
      <Modal
        open={liqModalOpen}
        onClose={() => setLiqModalOpen(false)}
        title={isEstimatedOwnerLabor ? "Revisar estimación del trabajo propio" : "Registrar jornal, sueldo propio o nómina"}
      >
        <div className="space-y-4">
          {liqError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{liqError}</p>}
          {isEstimatedOwnerLabor && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950">
              <p className="font-semibold">Periodo estimado: {liqForm.periodFrom} a {liqForm.periodTo}</p>
              <p className="mt-1">Las horas se reparten entre especies según el tiempo calculado. Al guardar, queda un costo económico; no crea egreso ni cuenta por pagar.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Persona"
              value={liqForm.staffId}
              disabled={isEstimatedOwnerLabor}
              onChange={(e) => onSelectLiquidationStaff(e.target.value)}
            >
              {profiles
                .filter((p) => p.isActive && (!isEstimatedOwnerLabor || (p.workerKind === "productor" && p.payPeriod === "hora")))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({fmt(p.baseRateCop)}/{p.payPeriod})
                  </option>
                ))}
            </Select>
            <Input
              label="Fecha"
              type="date"
              value={liqForm.date}
              onChange={(e) => setLiqForm({ ...liqForm, date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label={isEstimatedOwnerLabor ? "Horas estimadas del mes" : `Unidades (${profiles.find((p) => p.id === liqForm.staffId)?.payPeriod || "días/h/mes"})`}
              type="number"
              step="0.25"
              min="0.1"
              value={liqForm.unitsWorked}
              onChange={(e) => setLiqForm({ ...liqForm, unitsWorked: e.target.value })}
            />
            <Input
              label="Tarifa (COP)"
              type="number"
              step="100"
              min="0"
              value={liqForm.unitRateCop}
              disabled
            />
            <Input
              label="Bonificaciones / extras ($)"
              type="number"
              step="100"
              min="0"
              value={liqForm.bonusesCop}
              disabled={isEstimatedOwnerLabor}
              onChange={(e) => setLiqForm({ ...liqForm, bonusesCop: e.target.value })}
            />
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
            <p className="text-xs font-bold text-emerald-900">Cómo afecta tus finanzas:</p>
            <Select
              label="Modo contable"
              value={liqForm.accountingMode}
              disabled={isEstimatedOwnerLabor}
              onChange={(e) =>
                setLiqForm({
                  ...liqForm,
                  accountingMode: e.target.value as "cash_expense" | "imputed_economic",
                  isCredit: e.target.value === "imputed_economic" ? false : liqForm.isCredit,
                })
              }
            >
              <option value="imputed_economic">
                Costo económico calculado (sin salida real de caja — ideal trabajo propio)
              </option>
              <option value="cash_expense">
                Egreso real pagado o por pagar (sale de caja o genera CxP)
              </option>
            </Select>

            {liqForm.accountingMode === "cash_expense" && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={liqForm.isCredit}
                    onChange={(e) => setLiqForm({ ...liqForm, isCredit: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span>Queda pendiente por pagar (generar Cuenta por Pagar)</span>
                </label>
                {liqForm.isCredit && (
                  <Input
                    label="Fecha límite de pago"
                    type="date"
                    value={liqForm.dueDate}
                    onChange={(e) => setLiqForm({ ...liqForm, dueDate: e.target.value })}
                  />
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={liqForm.applySocialSecurity}
                disabled
                className="rounded border-slate-300"
              />
              <span>Incluir seguridad social, prestaciones y retención</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <Input
                label="% Empleador"
                type="number"
                step="0.1"
                min="0"
                disabled
                value={liqForm.employerBurdenPct}
              />
              <Input
                label="% Deducc. trab."
                type="number"
                step="0.1"
                min="0"
                disabled
                value={liqForm.workerDeductionPct}
              />
              <Input
                label="ReteFuente %"
                type="number"
                step="0.1"
                min="0"
                value={liqForm.reteFuenteRatePct}
                disabled
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Especie (opcional)"
              value={liqForm.species}
              onChange={(e) =>
                setLiqForm({ ...liqForm, species: e.target.value, prorationBasis: e.target.value ? "" : liqForm.prorationBasis })
              }
            >
              <option value="">Compartido / sin especie fija</option>
              {ANIMAL_SPECIES.map((sp) => (
                <option key={sp} value={sp}>
                  {(SPECIES_LABELS as Record<string, { singular: string }>)[sp]?.singular || sp}
                </option>
              ))}
            </Select>
            <Select
              label="Galpón / lugar (opcional)"
              value={liqForm.locationId}
              onChange={(e) =>
                setLiqForm({ ...liqForm, locationId: e.target.value, prorationBasis: e.target.value ? "" : liqForm.prorationBasis })
              }
            >
              <option value="">General / varios lugares</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>

          {prorationEnabled && liqForm.accountingMode === "cash_expense" && !liqForm.species && !liqForm.locationId && (
            <Select
              label="Prorratear automáticamente entre especies/lugares"
              value={liqForm.prorationBasis}
              onChange={(e) => setLiqForm({ ...liqForm, prorationBasis: e.target.value })}
            >
              {Object.entries(PRORATION_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </Select>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <div>
              <p className="text-slate-400">Bruto</p>
              <p className="font-semibold text-slate-800">{fmt(liqPreview.grossPayCop)}</p>
            </div>
            <div>
              <p className="text-slate-400">Aportes empleador</p>
              <p className="font-semibold text-slate-800">{fmt(liqPreview.employerBurdenCop)}</p>
            </div>
            <div>
              <p className="text-slate-400">Deducc. + Rete</p>
              <p className="font-semibold text-amber-700">
                -{fmt(liqPreview.workerDeductionsCop + liqPreview.reteFuenteCop)}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Neto a pagar / Costo</p>
              <p className="font-bold text-emerald-700">
                {fmt(liqPreview.netPayableCop)} / {fmt(liqPreview.totalEmployerCostCop)}
              </p>
            </div>
          </div>
          {liqPreview.transportAllowanceCop > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Auxilio de transporte tomado del valor maestro vigente: <strong>{fmt(liqPreview.transportAllowanceCop)}</strong>.
            </p>
          )}

          <Textarea
            label="Notas"
            value={liqForm.notes}
            onChange={(e) => setLiqForm({ ...liqForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLiqModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveLiquidation} disabled={savingLiquidation}>
              <CheckCircle2 className="w-4 h-4 mr-1 inline" /> {savingLiquidation ? "Guardando..." : "Guardar liquidación"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

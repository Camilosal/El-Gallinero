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
  weeksPerMonth: number;
  quincenasPerMonth: number;
  includeImputedOwnerLabor: boolean;
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
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
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
      const [staffRes, liqRes, locRes] = await Promise.all([
        apiFetch("/api/finanzas/personal").then((r) => r.json()),
        apiFetch(`/api/finanzas/personal/liquidaciones?from=${yearStart}&to=${today}`).then((r) => r.json()),
        apiFetch("/api/ubicaciones?active=true").then((r) => r.json()),
      ]);
      const profList: StaffProfile[] = Array.isArray(staffRes?.profiles) ? staffRes.profiles : [];
      setProfiles(profList);
      if (staffRes?.taxConfig) setTaxConfig(staffRes.taxConfig);
      if (staffRes?.monthSummary) setMonthSummary(staffRes.monthSummary);
      setEntries(Array.isArray(liqRes?.entries) ? liqRes.entries : []);
      setLocations(Array.isArray(locRes) ? locRes : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openNewStaff = useCallback(
    (presetKind?: "productor" | "apoyo") => {
      setEditingStaff(null);
      setStaffError("");
      const kind = presetKind || (profiles.some((p) => p.workerKind === "productor") ? "apoyo" : "productor");
      setStaffForm({
        fullName: kind === "productor" ? "Mi trabajo (Productor)" : "",
        documentId: "",
        workerKind: kind,
        contractType: kind === "productor" ? "propio" : isMediano ? "salario_fijo" : "jornal",
        payPeriod: kind === "apoyo" && isMediano ? "mes" : "dia",
        baseRateCop:
          kind === "apoyo" && isMediano
            ? String(taxConfig?.smlmvCop ?? "")
            : String(taxConfig?.dailySmlmvCop ?? ""),
        roleLabel: kind === "productor" ? "Propietario / Productor" : "Galponero / Apoyo",
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
      applySocialSecurity: p.applySocialSecurity,
      includeTransportAllowance: p.includeTransportAllowance,
      employerBurdenPct: String(taxConfig?.employerBurdenPct ?? ""),
      workerDeductionPct: String(taxConfig?.workerDeductionPct ?? ""),
      notes: p.notes || "",
    });
    setStaffModalOpen(true);
  };

  const openLiquidationFor = useCallback(
    (staff?: StaffProfile) => {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal, Trabajo Propio y Nómina"
        description={
          isMediano
            ? "Gestiona personal de apoyo, jornales, seguridad social, retenciones y reparto entre especies o galpones."
            : "Crea el hábito de valorar tu trabajo diario en los costos reales, sin distorsionar la caja cuando aún no retiras sueldo."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <HeroActionButton tone="solid" onClick={() => openLiquidationFor(ownerProfiles[0])}>
              <Plus className="w-4 h-4" />
              <span>{ownerProfiles.length > 0 ? "Registrar mi jornal" : "Configurar mi trabajo"}</span>
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
              <span>{isMediano ? "Modo Mediano: Nómina, Aportes y Prorrateo" : "Modo Pequeño: Págate tu propio trabajo"}</span>
            </p>
            <p className="text-sm text-slate-700 max-w-3xl">
              {isMediano
                ? `Referencias configuradas: SMLMV ${fmt(taxConfig?.smlmvCop ?? 0)} · Auxilio ${fmt(taxConfig?.transportAllowanceCop ?? 0)} · Aporte empleador ${taxConfig?.employerBurdenPct ?? 0}% · Deducción trabajador ${taxConfig?.workerDeductionPct ?? 0}%.`
                : `Aunque todavía no retires efectivo del bolsillo, registrar tu tarifa diaria (${fmt(taxConfig?.dailySmlmvCop ?? 0)}/día según el SMLMV configurado) suma tu esfuerzo al costo real por huevo y por kilo. Cuando sí te pagues, conviértelo en retiro de caja con un clic.`}
            </p>
          </div>
          <Badge color={taxConfig?.includeImputedOwnerLabor ? "green" : "gray"}>
            {taxConfig?.includeImputedOwnerLabor
              ? "Trabajo propio incluido en punto de equilibrio"
              : "Solo pagos en caja"}
          </Badge>
        </div>
      </Card>

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
            message="Aún no registras tu tarifa diaria ni personal de apoyo. Empieza creando tu perfil de productor en 20 segundos."
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
              onChange={(e) => setStaffForm({ ...staffForm, payPeriod: e.target.value as StaffProfile["payPeriod"] })}
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
              label="Tarifa base (COP)"
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
                onChange={(e) => setStaffForm({ ...staffForm, applySocialSecurity: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Aplicar seguridad social, prestaciones y deducciones por defecto</span>
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
        title="Registrar jornal, sueldo propio o nómina"
      >
        <div className="space-y-4">
          {liqError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{liqError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Persona"
              value={liqForm.staffId}
              onChange={(e) => onSelectLiquidationStaff(e.target.value)}
            >
              {profiles
                .filter((p) => p.isActive)
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
              label="Unidades (días/h/mes)"
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
              onChange={(e) => setLiqForm({ ...liqForm, bonusesCop: e.target.value })}
            />
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
            <p className="text-xs font-bold text-emerald-900">Cómo afecta tus finanzas:</p>
            <Select
              label="Modo contable"
              value={liqForm.accountingMode}
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

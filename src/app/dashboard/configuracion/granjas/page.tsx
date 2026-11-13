"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CalendarClock,
  Check,
  Copy,
  CreditCard,
  MapPin,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { HeroBanner } from "@/components/HeroBanner";
import TableSearch from "@/components/TableSearch";
import { Input, Modal, Select } from "@/components/ui";
import { matchesTextQuery } from "@/lib/text";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

interface PlanOption {
  code: string;
  name: string;
  durationDays: number;
  amountCop: number;
  maxUsers: number;
  maxActiveBatches: number | null;
}

interface TenantFarmItem {
  id: string;
  slug: string;
  name: string;
  isDefaultFarm: boolean;
  deploymentMode: string;
  qrSource: string | null;
  allyCode: string | null;
  municipality: string | null;
  scale: "PEQUENO" | "MEDIANO";
  onboardingCompleted: boolean;
  owner: {
    id: string;
    name: string;
    username: string;
    role: string;
  } | null;
  usersCount: number;
  locationsCount: number;
  activeBatchesCount: number;
  animalsCount: number;
  subscription: {
    planCode: string;
    planName: string;
    rawStatus: string;
    effectiveStatus: "trial" | "active" | "grace" | "expired" | "freemium";
    maxUsers: number;
    maxActiveBatches: number | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    daysRemaining: number | null;
  };
  billing: {
    approvedPaymentsCop: number;
    paymentsCount: number;
    lastPaymentAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface SuperAdminPayload {
  currentContext: {
    activeFarmId: string;
    homeFarmId: string;
    defaultFarmId: string;
  };
  summary: {
    totalFarms: number;
    activePaidFarms: number;
    trialFarms: number;
    expiredFarms: number;
    freemiumFarms: number;
    totalUsers: number;
    totalAnimals: number;
    totalRevenueCop: number;
  };
  plans: PlanOption[];
  farms: TenantFarmItem[];
}

const STATUS_BADGE: Record<
  TenantFarmItem["subscription"]["effectiveStatus"],
  { label: string; className: string }
> = {
  active: {
    label: "Activa (Al día)",
    className: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  trial: {
    label: "En Prueba (Trial)",
    className: "bg-amber-100 text-amber-900 border-amber-300",
  },
  grace: {
    label: "Período de Gracia",
    className: "bg-orange-100 text-orange-900 border-orange-300",
  },
  expired: {
    label: "Vencida",
    className: "bg-red-100 text-red-900 border-red-300",
  },
  freemium: {
    label: "Freemium Semilla",
    className: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "Sin vencimiento";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function SuperAdminGranjasPage() {
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setFeedback({ message, type });
      setTimeout(() => {
        setFeedback((prev) => (prev?.message === message ? null : prev));
      }, 4000);
    },
    [],
  );
  const [data, setData] = useState<SuperAdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [switchingFarmId, setSwitchingFarmId] = useState<string | null>(null);

  // Modal Nueva Granja
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newMunicipality, setNewMunicipality] = useState("");
  const [newScale, setNewScale] = useState<"PEQUENO" | "MEDIANO">("PEQUENO");
  const [newPlanCode, setNewPlanCode] = useState("FREEMIUM_SEMILLA");
  const [newStatus, setNewStatus] = useState<"trial" | "active">("trial");
  const [newDurationDays, setNewDurationDays] = useState(30);
  const [newMaxUsers, setNewMaxUsers] = useState(2);
  const [newDeploymentMode, setNewDeploymentMode] = useState("saas");
  const [newAllyCode, setNewAllyCode] = useState("");
  const [newQrSource, setNewQrSource] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerUsername, setNewOwnerUsername] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newRegisterPayment, setNewRegisterPayment] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    farmName: string;
    ownerName: string;
    username: string;
    password: string;
    planName: string;
  } | null>(null);
  const [copiedWelcome, setCopiedWelcome] = useState(false);

  // Modal Editar Granja / Suscripción
  const [editingFarm, setEditingFarm] = useState<TenantFarmItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMunicipality, setEditMunicipality] = useState("");
  const [editScale, setEditScale] = useState<"PEQUENO" | "MEDIANO">("PEQUENO");
  const [editDeploymentMode, setEditDeploymentMode] = useState("saas");
  const [editAllyCode, setEditAllyCode] = useState("");
  const [editQrSource, setEditQrSource] = useState("");
  const [editPlanCode, setEditPlanCode] = useState("FREEMIUM_SEMILLA");
  const [editStatus, setEditStatus] = useState("trial");
  const [editMaxUsers, setEditMaxUsers] = useState(2);
  const [editMaxActiveBatches, setEditMaxActiveBatches] = useState<string>("");
  const [editPeriodEndDate, setEditPeriodEndDate] = useState("");
  const [editExtendDays, setEditExtendDays] = useState<number>(0);
  const [editRegisterPayment, setEditRegisterPayment] = useState(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState("transferencia");

  const loadTenants = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setLoading(true);
      }
      setForbiddenMessage(null);
      try {
        const res = await fetch("/api/superadmin/granjas", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            setForbiddenMessage(
              json.error ||
                "Acceso exclusivo para Super-Administración de la plataforma.",
            );
          } else {
            toast(json.error || "Error cargando granjas", "error");
          }
          return;
        }
        setData(json);
      } catch {
        toast("Error de conexión al consultar granjas", "error");
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/superadmin/granjas", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            setForbiddenMessage(
              json.error ||
                "Acceso exclusivo para Super-Administración de la plataforma.",
            );
          } else {
            toast(json.error || "Error cargando granjas", "error");
          }
          return;
        }
        setData(json);
      })
      .catch(() => {
        if (active) {
          toast("Error de conexión al consultar granjas", "error");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const plansByCode = useMemo(() => {
    const map = new Map<string, PlanOption>();
    for (const p of data?.plans || []) {
      map.set(p.code, p);
    }
    return map;
  }, [data]);

  const filteredFarms = useMemo(() => {
    if (!data?.farms) return [];
    return data.farms.filter((f) => {
      if (statusFilter === "ACTIVE" && f.subscription.effectiveStatus !== "active") {
        return false;
      }
      if (statusFilter === "TRIAL" && f.subscription.effectiveStatus !== "trial") {
        return false;
      }
      if (statusFilter === "EXPIRED" && f.subscription.effectiveStatus !== "expired") {
        return false;
      }
      if (statusFilter === "FREEMIUM" && f.subscription.effectiveStatus !== "freemium") {
        return false;
      }
      if (statusFilter === "MEDIANO" && f.scale !== "MEDIANO") {
        return false;
      }
      return matchesTextQuery(search, [
        f.name,
        f.slug,
        f.municipality || "",
        f.owner?.name || "",
        f.owner?.username || "",
        f.allyCode || "",
        f.qrSource || "",
        f.subscription.planName,
        f.subscription.planCode,
      ]);
    });
  }, [data, search, statusFilter]);

  const activeContextFarm = useMemo(() => {
    if (!data) return null;
    return (
      data.farms.find((f) => f.id === data.currentContext.activeFarmId) || null
    );
  }, [data]);

  const handlePlanChangeInCreate = (code: string) => {
    setNewPlanCode(code);
    const meta = plansByCode.get(code);
    if (meta) {
      setNewDurationDays(meta.durationDays);
      setNewMaxUsers(meta.maxUsers);
      setNewStatus(code === "FREEMIUM_SEMILLA" ? "trial" : "active");
      if (code === "MEDIANO_MENSUAL") {
        setNewScale("MEDIANO");
      }
    }
  };

  const openEditModal = (farm: TenantFarmItem) => {
    setEditingFarm(farm);
    setEditName(farm.name);
    setEditMunicipality(farm.municipality || "");
    setEditScale(farm.scale);
    setEditDeploymentMode(farm.deploymentMode || "saas");
    setEditAllyCode(farm.allyCode || "");
    setEditQrSource(farm.qrSource || "");
    setEditPlanCode(farm.subscription.planCode);
    setEditStatus(
      ["trial", "active", "grace", "expired"].includes(farm.subscription.rawStatus)
        ? farm.subscription.rawStatus
        : "active",
    );
    setEditMaxUsers(farm.subscription.maxUsers);
    setEditMaxActiveBatches(
      farm.subscription.maxActiveBatches === null
        ? ""
        : String(farm.subscription.maxActiveBatches),
    );
    setEditPeriodEndDate(
      farm.subscription.currentPeriodEnd
        ? farm.subscription.currentPeriodEnd.slice(0, 10)
        : "",
    );
    setEditExtendDays(0);
    setEditRegisterPayment(false);
    const meta = plansByCode.get(farm.subscription.planCode);
    setEditPaymentAmount(meta?.amountCop || 0);
    setEditPaymentMethod("transferencia");
  };

  const handlePlanChangeInEdit = (code: string) => {
    setEditPlanCode(code);
    const meta = plansByCode.get(code);
    if (meta) {
      setEditMaxUsers(meta.maxUsers);
      setEditMaxActiveBatches(
        meta.maxActiveBatches === null ? "" : String(meta.maxActiveBatches),
      );
      setEditPaymentAmount(meta.amountCop);
      if (code !== "FREEMIUM_SEMILLA") {
        setEditStatus("active");
      }
      if (code === "MEDIANO_MENSUAL") {
        setEditScale("MEDIANO");
      }
    }
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/superadmin/granjas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmName: newFarmName,
          municipality: newMunicipality,
          scale: newScale,
          planCode: newPlanCode,
          status: newStatus,
          durationDays: Number(newDurationDays),
          maxUsers: Number(newMaxUsers),
          deploymentMode: newDeploymentMode,
          allyCode: newAllyCode,
          qrSource: newQrSource,
          ownerName: newOwnerName,
          ownerUsername: newOwnerUsername,
          ownerPassword: newOwnerPassword,
          registerManualPayment: newRegisterPayment,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "No se pudo crear la granja", "error");
        return;
      }

      const planMeta = plansByCode.get(newPlanCode);
      setCreatedCredentials({
        farmName: newFarmName.trim(),
        ownerName: newOwnerName.trim(),
        username: newOwnerUsername.trim().toLowerCase(),
        password: newOwnerPassword,
        planName: planMeta?.name || newPlanCode,
      });
      toast(`Granja "${newFarmName}" creada exitosamente`, "success");
      setNewFarmName("");
      setNewMunicipality("");
      setNewOwnerName("");
      setNewOwnerUsername("");
      setNewOwnerPassword("");
      setNewAllyCode("");
      setNewQrSource("");
      setNewRegisterPayment(false);
      await loadTenants();
    } catch {
      toast("Error de red al crear la granja", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFarm) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, unknown> = {
        farmId: editingFarm.id,
        name: editName,
        municipality: editMunicipality,
        scale: editScale,
        deploymentMode: editDeploymentMode,
        allyCode: editAllyCode,
        qrSource: editQrSource,
        planCode: editPlanCode,
        status: editStatus,
        maxUsers: Number(editMaxUsers),
        maxActiveBatches:
          editMaxActiveBatches.trim() === ""
            ? null
            : Number(editMaxActiveBatches),
        registerManualPayment: editRegisterPayment,
        amountCop: Number(editPaymentAmount),
        paymentMethod: editPaymentMethod,
      };

      if (editExtendDays !== 0) {
        payload.extendDays = editExtendDays;
      } else if (editPeriodEndDate) {
        payload.currentPeriodEnd = `${editPeriodEndDate}T23:59:59.000Z`;
      }

      const res = await fetch("/api/superadmin/granjas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "No se pudo actualizar la granja", "error");
        return;
      }

      toast(`Granja "${editName}" actualizada correctamente`, "success");
      setEditingFarm(null);
      await loadTenants();
    } catch {
      toast("Error de red al guardar cambios", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSwitchContext = async (targetFarmId: string, farmName: string) => {
    setSwitchingFarmId(targetFarmId);
    try {
      const res = await fetch("/api/superadmin/granjas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "switch_context",
          farmId: targetFarmId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "No se pudo cambiar de granja activa", "error");
        return;
      }
      toast(`Contexto activo cambiado a: ${farmName}`, "success");
      await loadTenants();
    } catch {
      toast("Error al cambiar el contexto de granja", "error");
    } finally {
      setSwitchingFarmId(null);
    }
  };

  const copyWelcomeMessage = async () => {
    if (!createdCredentials) return;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://iwage.co";
    const text = [
      `Hola ${createdCredentials.ownerName}, tu finca *${createdCredentials.farmName}* ya está activa en *Iwagé* (${createdCredentials.planName}).`,
      ``,
      `Ingresa desde tu celular o computador en: ${origin}/login`,
      `Usuario: *${createdCredentials.username}*`,
      `Contraseña inicial: *${createdCredentials.password}*`,
      ``,
      `Al entrar verás el Asistente Día 1 de 3 pasos para registrar tus corrales y lotes actuales.`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWelcome(true);
      toast("Mensaje de bienvenida copiado para WhatsApp", "success");
      setTimeout(() => setCopiedWelcome(false), 2500);
    } catch {
      toast("No se pudo copiar automáticamente", "error");
    }
  };

  if (forbiddenMessage) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-red-900">
          <h2 className="text-lg font-bold mb-2">Acceso Restringido</h2>
          <p className="text-sm mb-4">{forbiddenMessage}</p>
          <Link
            href="/dashboard/configuracion"
            className="inline-flex items-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl bg-white border border-red-300 font-semibold text-sm text-red-900 hover:bg-red-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Configuración
          </Link>
        </div>
      </div>
    );
  }

  const isInspectingOtherFarm =
    data &&
    data.currentContext.activeFarmId !== data.currentContext.defaultFarmId;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/dashboard/configuracion"
          className="inline-flex items-center gap-2 min-h-[48px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Configuración
        </Link>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => loadTenants(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatedCredentials(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + Nueva Granja (Alta Llave en Mano)
          </button>
        </div>
      </div>

      <HeroBanner
        theme="guia"
        icon={<ShieldCheck className="w-4 h-4 text-amber-200" aria-hidden="true" />}
        title="Panel Super-Admin de Granjas (Tenants)"
        description="Gobierno central multi-tenant: administra fincas registradas, planes, fechas de vencimiento, cupos de usuarios, activaciones por transferencia y modo soporte."
      />

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            feedback.type === "error"
              ? "bg-red-50 border-red-300 text-red-900"
              : "bg-emerald-50 border-emerald-300 text-emerald-900"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Banner de Contexto Activo / Modo Soporte */}
      {data && (
        <div
          className={`rounded-2xl border-2 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isInspectingOtherFarm
              ? "bg-amber-50 border-amber-300 text-amber-950"
              : "bg-slate-900 border-slate-800 text-white"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <ArrowRightLeft className="w-4 h-4" />
              <span>
                {isInspectingOtherFarm
                  ? "Modo Soporte Multi-Tenant Activo"
                  : "Contexto Operativo Actual"}
              </span>
            </div>
            <p className="text-base sm:text-lg font-bold">
              Granja en sesión:{" "}
              <span className="underline decoration-2">
                {activeContextFarm?.name || data.currentContext.activeFarmId}
              </span>{" "}
              {activeContextFarm?.municipality
                ? `(${activeContextFarm.municipality})`
                : ""}
            </p>
            <p
              className={`text-xs sm:text-sm ${
                isInspectingOtherFarm ? "text-amber-800" : "text-slate-300"
              }`}
            >
              {isInspectingOtherFarm
                ? "Todas las pantallas del Dashboard (Ubicaciones, Kit de Campo, Lotes, Finanzas) muestran ahora los datos aislados por RLS de esta finca."
                : "Puedes entrar en modo soporte a cualquier finca registrada para revisar su configuración, imprimir su Kit de Campo o asistir al productor."}
            </p>
          </div>

          {isInspectingOtherFarm && (
            <button
              type="button"
              onClick={() =>
                handleSwitchContext(
                  data.currentContext.defaultFarmId,
                  "Granja Principal",
                )
              }
              disabled={switchingFarmId !== null}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-xl bg-amber-900 text-white text-sm font-bold hover:bg-amber-950 shrink-0"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Volver a Granja Principal
            </button>
          )}
        </div>
      )}

      {/* Resumen Global KPIs */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Total Granjas
            </p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              {data.summary.totalFarms}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {data.summary.totalUsers} usuarios registrados
            </p>
          </div>

          <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-emerald-800 uppercase">
              Planes Pagos Activos
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1">
              {data.summary.activePaidFarms}
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Suscripción vigente al día
            </p>
          </div>

          <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-amber-800 uppercase">
              En Prueba / Semilla
            </p>
            <p className="text-2xl sm:text-3xl font-black text-amber-900 mt-1">
              {data.summary.trialFarms + data.summary.freemiumFarms}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              {data.summary.trialFarms} trial · {data.summary.freemiumFarms} freemium
            </p>
          </div>

          <div className="bg-red-50/70 rounded-2xl border border-red-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-red-800 uppercase">
              Suscripciones Vencidas
            </p>
            <p className="text-2xl sm:text-3xl font-black text-red-900 mt-1">
              {data.summary.expiredFarms}
            </p>
            <p className="text-xs text-red-700 mt-1">
              Requieren renovación de ciclo
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Facturación Acumulada
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {formatCop(data.summary.totalRevenueCop)}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {data.summary.totalAnimals.toLocaleString("es-CO")} animales en plataforma
            </p>
          </div>
        </div>
      )}

      {/* Buscador y Filtros Rápidos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre de finca, municipio, propietario, usuario, código aliado o plan..."
          resultCount={filteredFarms.length}
          totalCount={data?.farms.length || 0}
        />

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "ALL", label: "Todas las granjas" },
            { id: "ACTIVE", label: "Activas (Pagas)" },
            { id: "TRIAL", label: "En Prueba (Trial)" },
            { id: "EXPIRED", label: "Vencidas" },
            { id: "FREEMIUM", label: "Freemium" },
            { id: "MEDIANO", label: "Escala Mediano Productor" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listado de Granjas (Tenants) */}
      {loading && !data ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
          Cargando inventario de granjas registradas...
        </div>
      ) : filteredFarms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
          No se encontraron granjas que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFarms.map((farm) => {
            const isCurrentActive =
              data?.currentContext.activeFarmId === farm.id;
            const badge =
              STATUS_BADGE[farm.subscription.effectiveStatus] ||
              STATUS_BADGE.trial;

            return (
              <div
                key={farm.id}
                className={`bg-white rounded-2xl border-2 p-4 sm:p-6 shadow-sm transition-all ${
                  isCurrentActive
                    ? "border-emerald-600 ring-2 ring-emerald-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Columna 1: Identidad de la Finca y Propietario */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-5 h-5 text-slate-700 shrink-0" />
                      <h3 className="text-lg sm:text-xl font-black text-slate-900">
                        {farm.name}
                      </h3>
                      {farm.isDefaultFarm && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
                          Granja Principal
                        </span>
                      )}
                      {isCurrentActive && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-700 text-white">
                          Sesión Activa
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          farm.scale === "MEDIANO"
                            ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        {farm.scale === "MEDIANO"
                          ? "Mediano Productor"
                          : "Pequeño Productor"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                        slug: {farm.slug}
                      </span>
                      {farm.municipality && (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {farm.municipality}
                        </span>
                      )}
                      <span>
                        Modo:{" "}
                        <strong className="uppercase">{farm.deploymentMode}</strong>
                      </span>
                      {farm.allyCode && (
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                          Aliado: {farm.allyCode}
                        </span>
                      )}
                      {farm.qrSource && (
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
                          QR: {farm.qrSource}
                        </span>
                      )}
                    </div>

                    {/* Propietario y Métricas Operativas */}
                    <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">
                          Titular / Admin
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {farm.owner?.name || "Sin asignar"}
                        </p>
                        <p className="text-xs text-slate-600 truncate">
                          {farm.owner ? `@${farm.owner.username}` : "—"}
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">
                          Cupo Usuarios
                        </p>
                        <p className="text-sm font-black text-slate-900 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          {farm.usersCount} / {farm.subscription.maxUsers}
                        </p>
                        <p className="text-xs text-slate-600">
                          {farm.onboardingCompleted
                            ? "Onboarding completado"
                            : "Día 1 pendiente"}
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">
                          Operación Viva
                        </p>
                        <p className="text-sm font-black text-slate-900">
                          {farm.animalsCount.toLocaleString("es-CO")} animales
                        </p>
                        <p className="text-xs text-slate-600">
                          {farm.locationsCount} ubic. · {farm.activeBatchesCount}{" "}
                          lotes
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">
                          Pagos Aprobados
                        </p>
                        <p className="text-sm font-black text-slate-900">
                          {formatCop(farm.billing.approvedPaymentsCop)}
                        </p>
                        <p className="text-xs text-slate-600">
                          {farm.billing.paymentsCount} transacciones
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Columna 2: Estado del Plan, Vencimiento y Acciones */}
                  <div className="lg:w-80 shrink-0 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        {farm.subscription.daysRemaining !== null && (
                          <span
                            className={`text-xs font-bold ${
                              farm.subscription.daysRemaining <= 7
                                ? "text-red-700"
                                : "text-slate-700"
                            }`}
                          >
                            {farm.subscription.daysRemaining > 0
                              ? `Quedan ${farm.subscription.daysRemaining} días`
                              : "Vencido (0 días)"}
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase">
                          Plan Asignado
                        </p>
                        <p className="text-sm sm:text-base font-black text-slate-900">
                          {farm.subscription.planName}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <CalendarClock className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>
                          Vence:{" "}
                          <strong>
                            {formatDateShort(farm.subscription.currentPeriodEnd)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => openEditModal(farm)}
                        className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800"
                      >
                        <Settings2 className="w-4 h-4" />
                        Administrar Plan y Vencimiento
                      </button>

                      <button
                        type="button"
                        disabled={isCurrentActive || switchingFarmId === farm.id}
                        onClick={() => handleSwitchContext(farm.id, farm.name)}
                        className={`w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
                          isCurrentActive
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 cursor-default"
                            : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        {isCurrentActive
                          ? "Finca en Sesión Actual"
                          : switchingFarmId === farm.id
                            ? "Cambiando..."
                            : "Entrar a esta Granja (Soporte)"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: + Nueva Granja (Alta Llave en Mano) */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Alta de Nueva Granja (Tenant Llave en Mano)"
      >
        {createdCredentials ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 space-y-2 text-emerald-950">
              <div className="flex items-center gap-2 font-bold text-base">
                <Sparkles className="w-5 h-5 text-emerald-700" />
                <span>¡Granja creada y aprovisionada con éxito!</span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-900">
                Se creó el espacio aislado (RLS), la suscripción inicial y el
                usuario propietario. Copia las credenciales para enviarlas por
                WhatsApp:
              </p>
              <div className="bg-white rounded-xl p-3 border border-emerald-200 text-xs sm:text-sm space-y-1 font-mono">
                <p>
                  <strong>Finca:</strong> {createdCredentials.farmName}
                </p>
                <p>
                  <strong>Titular:</strong> {createdCredentials.ownerName}
                </p>
                <p>
                  <strong>Plan:</strong> {createdCredentials.planName}
                </p>
                <p>
                  <strong>Usuario:</strong> {createdCredentials.username}
                </p>
                <p>
                  <strong>Clave inicial:</strong> {createdCredentials.password}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={copyWelcomeMessage}
                className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800"
              >
                {copiedWelcome ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado para WhatsApp
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar Bienvenida para WhatsApp
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedCredentials(null);
                  setShowCreateModal(false);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateFarm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Nombre de la Granja o Predio *">
                <Input
                  required
                  value={newFarmName}
                  onChange={(e) => setNewFarmName(e.target.value)}
                  placeholder="Ej. Granja Avícola San Pedro"
                />
              </FormField>

              <FormField label="Municipio / Vereda">
                <Input
                  value={newMunicipality}
                  onChange={(e) => setNewMunicipality(e.target.value)}
                  placeholder="Ej. Fómeque, Cundinamarca"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Escala Operativa Inicial">
                <Select
                  value={newScale}
                  onChange={(e) =>
                    setNewScale(e.target.value as "PEQUENO" | "MEDIANO")
                  }
                >
                  <option value="PEQUENO">
                    Pequeño Productor (UI Simplificada)
                  </option>
                  <option value="MEDIANO">
                    Mediano Productor (Todos los módulos activos)
                  </option>
                </Select>
              </FormField>

              <FormField label="Plan Asignado">
                <Select
                  value={newPlanCode}
                  onChange={(e) => handlePlanChangeInCreate(e.target.value)}
                >
                  {(data?.plans || []).map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({formatCop(p.amountCop)})
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Estado Suscripción">
                <Select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as "trial" | "active")
                  }
                >
                  <option value="trial">En Prueba (Trial)</option>
                  <option value="active">Activa (Pagada)</option>
                </Select>
              </FormField>

              <FormField label="Vigencia (Días)">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={newDurationDays}
                  onChange={(e) => setNewDurationDays(Number(e.target.value))}
                />
              </FormField>

              <FormField label="Cupo Máx. Usuarios">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={newMaxUsers}
                  onChange={(e) => setNewMaxUsers(Number(e.target.value))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Despliegue">
                <Select
                  value={newDeploymentMode}
                  onChange={(e) => setNewDeploymentMode(e.target.value)}
                >
                  <option value="saas">SaaS Multi-Tenant</option>
                  <option value="dedicated">Instancia Dedicada</option>
                </Select>
              </FormField>

              <FormField label="Código Aliado (Opcional)">
                <Input
                  value={newAllyCode}
                  onChange={(e) => setNewAllyCode(e.target.value)}
                  placeholder="Ej. AGRO-ORIENTE"
                />
              </FormField>

              <FormField label="Origen QR (Opcional)">
                <Input
                  value={newQrSource}
                  onChange={(e) => setNewQrSource(e.target.value)}
                  placeholder="Ej. FERIA-AVICOLA"
                />
              </FormField>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-3">
              <p className="text-xs font-bold uppercase text-slate-600">
                Credenciales del Propietario / Administrador de la Finca
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Nombre Completo *">
                  <Input
                    required
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Ej. Don Ramiro Gómez"
                  />
                </FormField>

                <FormField label="Usuario / Celular *">
                  <Input
                    required
                    value={newOwnerUsername}
                    onChange={(e) => setNewOwnerUsername(e.target.value)}
                    placeholder="Ej. 3105551234"
                  />
                </FormField>

                <FormField label="Contraseña Inicial (mín. 8) *">
                  <Input
                    required
                    minLength={8}
                    value={newOwnerPassword}
                    onChange={(e) => setNewOwnerPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </FormField>
              </div>
            </div>

            {newPlanCode !== "FREEMIUM_SEMILLA" && (
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRegisterPayment}
                  onChange={(e) => setNewRegisterPayment(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700"
                />
                <span>
                  Registrar pago manual aprobado en historial de facturación (
                  {formatCop(plansByCode.get(newPlanCode)?.amountCop || 0)})
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50"
              >
                {creating ? "Creando Granja..." : "Crear Granja y Propietario"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Administrar Plan, Vencimiento y Cupos */}
      <Modal
        open={Boolean(editingFarm)}
        onClose={() => setEditingFarm(null)}
        title={
          editingFarm
            ? `Administrar Granja: ${editingFarm.name}`
            : "Administrar Granja"
        }
      >
        {editingFarm && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Nombre de la Granja">
                <Input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </FormField>

              <FormField label="Municipio / Vereda">
                <Input
                  value={editMunicipality}
                  onChange={(e) => setEditMunicipality(e.target.value)}
                  placeholder="Ej. Fusagasugá, Cundinamarca"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Escala del Productor">
                <Select
                  value={editScale}
                  onChange={(e) =>
                    setEditScale(e.target.value as "PEQUENO" | "MEDIANO")
                  }
                >
                  <option value="PEQUENO">
                    Pequeño Productor (UI Simplificada)
                  </option>
                  <option value="MEDIANO">
                    Mediano Productor (13 Módulos Completos)
                  </option>
                </Select>
              </FormField>

              <FormField label="Plan de Suscripción">
                <Select
                  value={editPlanCode}
                  onChange={(e) => handlePlanChangeInEdit(e.target.value)}
                >
                  {(data?.plans || []).map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({formatCop(p.amountCop)})
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Estado Suscripción">
                <Select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="trial">En Prueba (Trial)</option>
                  <option value="active">Activa (Al día)</option>
                  <option value="grace">Período de Gracia</option>
                  <option value="expired">Vencida</option>
                </Select>
              </FormField>

              <FormField label="Cupo Máx. Usuarios">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={editMaxUsers}
                  onChange={(e) => setEditMaxUsers(Number(e.target.value))}
                />
              </FormField>

              <FormField label="Límite Lotes Activos (vacío = ilimitado)">
                <Input
                  type="number"
                  min={1}
                  value={editMaxActiveBatches}
                  onChange={(e) => setEditMaxActiveBatches(e.target.value)}
                  placeholder="Ilimitado"
                />
              </FormField>
            </div>

            {/* Control de Vencimiento y Extensión Rápida */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase text-slate-700">
                  Fecha de Vencimiento y Prórroga Rápida
                </span>
                <span className="text-xs text-slate-600">
                  Actual:{" "}
                  <strong>
                    {formatDateShort(editingFarm.subscription.currentPeriodEnd)}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { days: 30, label: "+30 días (1 mes)" },
                  { days: 60, label: "+60 días (1 ciclo)" },
                  { days: 180, label: "+180 días (Semestral)" },
                  { days: 365, label: "+365 días (1 año)" },
                ].map((btn) => (
                  <button
                    key={btn.days}
                    type="button"
                    onClick={() =>
                      setEditExtendDays(
                        editExtendDays === btn.days ? 0 : btn.days,
                      )
                    }
                    className={`min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      editExtendDays === btn.days
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {editExtendDays > 0 ? (
                <p className="text-xs font-semibold text-emerald-800">
                  Se sumarán +{editExtendDays} días a partir de la fecha de
                  vencimiento vigente (o desde hoy si ya estaba vencida).
                </p>
              ) : (
                <FormField label="O fijar fecha exacta de vencimiento">
                  <Input
                    type="date"
                    value={editPeriodEndDate}
                    onChange={(e) => setEditPeriodEndDate(e.target.value)}
                  />
                </FormField>
              )}
            </div>

            {/* Atribución Comercial y Despliegue */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Modo de Despliegue">
                <Select
                  value={editDeploymentMode}
                  onChange={(e) => setEditDeploymentMode(e.target.value)}
                >
                  <option value="saas">SaaS Multi-Tenant</option>
                  <option value="dedicated">Instancia Dedicada</option>
                  <option value="self_hosted">Self-Hosted</option>
                </Select>
              </FormField>

              <FormField label="Código de Aliado">
                <Input
                  value={editAllyCode}
                  onChange={(e) => setEditAllyCode(e.target.value)}
                  placeholder="Ej. ALMACEN-EL-CAMPO"
                />
              </FormField>

              <FormField label="Origen QR">
                <Input
                  value={editQrSource}
                  onChange={(e) => setEditQrSource(e.target.value)}
                  placeholder="Ej. BULTOS-40KG"
                />
              </FormField>
            </div>

            {/* Registro de Pago Manual */}
            <div className="bg-emerald-50/70 rounded-2xl p-3.5 border border-emerald-200 space-y-3">
              <label className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-emerald-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editRegisterPayment}
                  onChange={(e) => setEditRegisterPayment(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700"
                />
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <span>
                  Registrar pago recibido manualmente (Transferencia / Nequi
                  directo / Efectivo)
                </span>
              </label>

              {editRegisterPayment && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <FormField label="Valor Recibido (COP)">
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      value={editPaymentAmount}
                      onChange={(e) =>
                        setEditPaymentAmount(Number(e.target.value))
                      }
                    />
                  </FormField>

                  <FormField label="Medio de Pago">
                    <Select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value)}
                    >
                      <option value="transferencia">
                        Transferencia Bancaria / Bre-B
                      </option>
                      <option value="nequi">Nequi Directo</option>
                      <option value="daviplata">Daviplata Directo</option>
                      <option value="efectivo">Efectivo en Campo</option>
                    </Select>
                  </FormField>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingFarm(null)}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
              >
                {savingEdit ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}


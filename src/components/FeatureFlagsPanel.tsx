"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  History,
  Lock,
  Sparkles,
  Unlock,
  Wand2,
} from "lucide-react";
import { Badge, Card, StatCard } from "@/components/ui";
import {
  FARM_PURPOSE_CATALOG,
  FEATURE_FLAG_BY_KEY,
  FEATURE_FLAG_CATALOG,
  exportDay1StarterCsvTemplate,
  resolvePurposeProfileMode,
  type FarmPurposeKey,
  type ProducerScale,
  type ProgressiveUnlockableFlagKey,
} from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";
import OnboardingWizardModal from "@/components/OnboardingWizardModal";
import { OPEN_ONBOARDING_WIZARD_EVENT } from "@/lib/quick-capture-events";

const ORIGIN_BADGE: Record<string, { label: string; color: "green" | "blue" | "yellow" }> = {
  PERFIL_INICIAL: { label: "Perfil Inicial", color: "blue" },
  MANUAL_USUARIO: { label: "Manual Usuario", color: "yellow" },
  AUTO_TRIGGER_CRECIMIENTO: { label: "Auto-Trigger Crecimiento", color: "green" },
};

export default function FeatureFlagsPanel() {
  const { state, flags, metrics, evaluation, history, loading, patchOnboarding, refresh } = useOnboardingState();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const onOpen = () => setWizardOpen(true);
    window.addEventListener(OPEN_ONBOARDING_WIZARD_EVENT, onOpen);
    void Promise.resolve().then(() => {
      if (!active || typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("wizard") === "1") {
        setWizardOpen(true);
        params.delete("wizard");
        const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", cleanUrl);
      }
    });
    return () => {
      active = false;
      window.removeEventListener(OPEN_ONBOARDING_WIZARD_EVENT, onOpen);
    };
  }, []);

  const handleScaleChange = async (nextScale: ProducerScale) => {
    setSavingKey(`scale-${nextScale}`);
    setFeedback(null);
    try {
      await patchOnboarding({ scale: nextScale });
      setFeedback({
        type: "ok",
        text: `Escala cambiada a ${nextScale === "PEQUENO" ? "Pequeño Productor" : "Mediano / Tecnificado"} sin migración ni pérdida de datos.`,
      });
    } catch (err) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Error al cambiar de escala" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleFlag = async (key: ProgressiveUnlockableFlagKey, nextEnabled: boolean) => {
    setSavingKey(key);
    setFeedback(null);
    try {
      await patchOnboarding({ toggleFlag: { key, enabled: nextEnabled } });
      setFeedback({
        type: "ok",
        text: `${FEATURE_FLAG_BY_KEY[key].name}: ${nextEnabled ? "activado" : "desactivado"}.`,
      });
    } catch (err) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Error al cambiar módulo" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleTogglePurpose = async (purposeKey: FarmPurposeKey) => {
    const current = state?.config.purposes ?? [];
    const exists = current.includes(purposeKey);
    const nextPurposes = exists ? current.filter((p) => p !== purposeKey) : [...current, purposeKey];
    const currentPrimary = state?.config.primaryPurpose ?? null;
    const nextPrimary = currentPrimary && nextPurposes.includes(currentPrimary)
      ? currentPrimary
      : nextPurposes[0] ?? null;
    setSavingKey(`purpose-${purposeKey}`);
    setFeedback(null);
    try {
      await patchOnboarding({ purposes: nextPurposes, primaryPurpose: nextPrimary });
      setFeedback({ type: "ok", text: "Propósitos de la granja actualizados sin modificar tu historial." });
    } catch (err) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Error al actualizar propósitos" });
    } finally {
      setSavingKey(null);
    }
  };

  const handlePrimaryPurposeChange = async (nextPrimary: FarmPurposeKey | null) => {
    setSavingKey("purpose-primary");
    setFeedback(null);
    try {
      await patchOnboarding({ primaryPurpose: nextPrimary });
      setFeedback({ type: "ok", text: "Prioridad principal actualizada." });
    } catch (err) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Error al actualizar prioridad" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleFormalReportToggle = async (nextVal: boolean) => {
    setSavingKey("formal-report");
    setFeedback(null);
    try {
      await patchOnboarding({ solicitaReporteFormal: nextVal });
      setFeedback({
        type: "ok",
        text: nextVal
          ? "Reportes DIAN / Crédito habilitados automáticamente por trigger inteligente."
          : "Preferencia de reportes formales actualizada.",
      });
    } catch (err) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Error al actualizar preferencia" });
    } finally {
      setSavingKey(null);
    }
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([exportDay1StarterCsvTemplate()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_arranque_dia1.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !state || !flags || !metrics || !evaluation) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-500">Cargando arquitectura progresiva y feature flags...</p>
      </Card>
    );
  }

  const activeTotal = Object.values(flags).filter(Boolean).length;
  const currentScale = state.config.scale;

  return (
    <div className="space-y-6">
      {/* KPIs vivos que alimentan los disparadores inteligentes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard label="Aves vivas activas" value={metrics.avesActivasTotales} icon="bird" color="green" />
        <StatCard label="Especies operadas" value={metrics.especiesActivas} icon="paw-print" color="blue" />
        <StatCard label="Mamíferos / pie cría" value={metrics.reproductoresMamiferos} icon="rabbit" color="earth" />
        <StatCard label="Capacidades activas" value={`${activeTotal} / 9`} icon="sparkles" color="purple" />
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Selector de escala único sin bifurcación de código */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Escala del Productor (Base de Código Única)</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Cambia de Pequeño Productor a Mediano Tecnificado en un clic sin migrar datos ni perder historial.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800"
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Asistente Día 1 (3 pasos)</span>
            </button>
            <button
              type="button"
              onClick={downloadCsvTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Plantilla CSV Día 1</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              scale: "PEQUENO" as const,
              title: "Pequeño Productor (Enfoque Diario)",
              desc: "Activa las 4 funciones esenciales: captura offline, inventario en bultos 40 kg, sanidad/retiros/compostaje y parte diario compartible (Telegram). Mantiene ocultas auditorías complejas hasta crecer.",
            },
            {
              scale: "MEDIANO" as const,
              title: "Mediano / Tecnificado (Control Total)",
              desc: "Desbloquea los 9 módulos: agrega POE GAB ICA, centros de costo/prorrateo, clasificación NTC 1240 PEPS, reportes DIAN/ROI y genealogía 3 generaciones + sensores IoT.",
            },
          ].map((opt) => {
            const active = currentScale === opt.scale;
            return (
              <button
                key={opt.scale}
                type="button"
                disabled={savingKey !== null}
                onClick={() => handleScaleChange(opt.scale)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  active
                    ? "border-green-600 bg-green-50 ring-2 ring-green-600/30"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm text-slate-900">{opt.title}</span>
                  <Badge color={active ? "green" : "gray"}>{active ? "Activa" : "Cambiar"}</Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Mis propósitos en IwaGranja (v2.3 combinables y editables) */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--iw-semantic-text-primary)]">
              Mis propósitos en IwaGranja
            </h2>
            <p className="text-xs text-[var(--iw-semantic-text-secondary)] mt-0.5">
              Orienta las recomendaciones, cápsulas MicroInsight, nudges y guías según tu finalidad actual, sin cambiar permisos ni perder datos.
            </p>
          </div>
          <Badge color="green">
            Perfil:{" "}
            {(() => {
              const mode = resolvePurposeProfileMode(state.config.purposes);
              if (mode === "mixto") return "Mixto (Hogar + Negocio)";
              if (mode === "hogar") return "Hogar / Autoconsumo";
              if (mode === "ingresos") return "Comercial / Negocio";
              return "Neutral por necesidad";
            })()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {FARM_PURPOSE_CATALOG.map((p) => {
            const active = (state.config.purposes ?? []).includes(p.key);
            const isPrimary = state.config.primaryPurpose === p.key;
            return (
              <button
                key={p.key}
                type="button"
                disabled={savingKey !== null}
                onClick={() => void handleTogglePurpose(p.key)}
                className={`text-left rounded-xl border p-3 transition-colors ${
                  active
                    ? "border-[var(--iw-semantic-border-strong)] bg-[var(--iw-semantic-bg-feature)]"
                    : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] hover:bg-[var(--iw-semantic-bg-subtle)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--iw-semantic-text-primary)]">{p.label}</span>
                  <Badge color={active ? (isPrimary ? "green" : "blue") : "gray"}>
                    {active ? (isPrimary ? "Prioritario" : "Activo") : "Elegir"}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--iw-semantic-text-secondary)] leading-snug">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>

        {(state.config.purposes ?? []).length >= 2 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--iw-semantic-border-default)] pt-3">
            <label htmlFor="ff-primary-purpose" className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
              Prioridad principal:
            </label>
            <select
              id="ff-primary-purpose"
              value={state.config.primaryPurpose ?? ""}
              disabled={savingKey !== null}
              onChange={(e) => void handlePrimaryPurposeChange((e.target.value || null) as FarmPurposeKey | null)}
              className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)]"
            >
              {(state.config.purposes ?? []).map((key) => {
                const def = FARM_PURPOSE_CATALOG.find((item) => item.key === key);
                return (
                  <option key={key} value={key}>
                    {def ? def.label : key}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </Card>

      {/* Catálogo de Feature Flags + Auto Triggers */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Módulos y Disparadores Inteligentes</h2>
            <p className="text-xs text-slate-600">
              Las funciones avanzadas se desbloquean solas al cruzar tus metas productivas reales o manualmente cuando las necesites.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={state.config.solicitaReporteFormal}
              disabled={savingKey !== null}
              onChange={(e) => handleFormalReportToggle(e.target.checked)}
              className="h-4 w-4 accent-green-700"
            />
            <span>Requiero reportes DIAN / crédito</span>
          </label>
        </div>

        <div className="space-y-3">
          {FEATURE_FLAG_CATALOG.map((def) => {
            const enabled = flags[def.key];
            const prog = evaluation.progress.find((p) => p.key === def.key);
            const isUnlockable = def.manualUnlock;
            const flagKey = def.key as ProgressiveUnlockableFlagKey;

            return (
              <div
                key={def.key}
                className={`rounded-xl border p-4 transition-colors ${
                  enabled ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-[220px]">
                    <div className="flex flex-wrap items-center gap-2">
                      {enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      )}
                      <h3 className="text-sm font-bold text-slate-900">{def.name}</h3>
                      <Badge color={enabled ? "green" : "gray"}>
                        {isUnlockable ? (enabled ? "Desbloqueado" : "En espera") : "Core Permanente"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{def.description}</p>

                    {prog && (
                      <div className="pt-1.5 max-w-md space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" aria-hidden="true" />
                            <span>Auto-trigger: {prog.currentValue} / {prog.threshold} {prog.unitLabel}</span>
                          </span>
                          <span>{prog.percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${prog.met ? "bg-emerald-600" : "bg-amber-500"}`}
                            style={{ width: `${prog.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {enabled && (
                      <Link
                        href={def.configHref}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    )}

                    {isUnlockable && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        disabled={savingKey === def.key}
                        onClick={() => handleToggleFlag(flagKey, !enabled)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                          enabled
                            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            : "bg-green-700 text-white hover:bg-green-800"
                        }`}
                      >
                        {enabled ? <Lock className="w-3.5 h-3.5" aria-hidden="true" /> : <Unlock className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{savingKey === def.key ? "Guardando..." : enabled ? "Ocultar módulo" : "Desbloquear"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Historial de Activaciones */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-slate-600" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900">Historial de Activaciones</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">Sin cambios registrados todavía.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.slice(0, 15).map((entry) => {
              const badge = ORIGIN_BADGE[entry.origin] ?? { label: entry.origin, color: "blue" as const };
              const def = FEATURE_FLAG_BY_KEY[entry.featureKey];
              return (
                <div key={entry.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800">{def?.name || entry.featureKey}</span>
                      <Badge color={badge.color}>{badge.label}</Badge>
                      <span className="font-semibold text-slate-600">
                        {entry.estadoAnterior ? "ON" : "OFF"} → {entry.estadoNuevo ? "ON" : "OFF"}
                      </span>
                    </div>
                    <p className="text-slate-500">{entry.triggerReason}</p>
                  </div>
                  <span className="text-slate-400">
                    {new Date(entry.activatedAt).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <OnboardingWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCompleted={() => void refresh()}
      />
    </div>
  );
}

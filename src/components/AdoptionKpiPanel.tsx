"use client";

/**
 * Tablero de KPIs de Adopción (Plan Maestro §8) reutilizable en
 * /analisis/adopcion y en la Semana 4 (Marcha Blanca) del Kit de Campo.
 * Semáforos en lenguaje de granja; versión simplificada para PEQUENO
 * y para roles operativos (el tablero completo es de propietario/admin).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";
import { useOnboardingState } from "@/lib/useOnboardingState";

export interface AdoptionKpis {
  timeToValueMinutes: number | null;
  avgFieldCaptureSeconds: number | null;
  medianCaptureSec: number | null;
  captureSamplesCount: number;
  captureStreakDays: number;
  weeklyClosureAdherencePct: number;
  adherence21dPct: number;
  sanitaryAndGenealogyIntegrityPct: number;
  costCentersActiveCount: number;
}

type TrafficLight = "verde" | "amarillo" | "rojo" | "sin-datos";

interface KpiCard {
  id: string;
  label: string;
  value: string;
  hint: string;
  light: TrafficLight;
  target: string;
  href: string;
  action: string;
  simple?: boolean;
}

const LIGHT_STYLES: Record<TrafficLight, { border: string; dot: string; text: string }> = {
  verde: { border: "border-l-emerald-500", dot: "bg-emerald-500", text: "text-emerald-700" },
  amarillo: { border: "border-l-amber-500", dot: "bg-amber-500", text: "text-amber-700" },
  rojo: { border: "border-l-rose-500", dot: "bg-rose-500", text: "text-rose-700" },
  "sin-datos": { border: "border-l-slate-300", dot: "bg-slate-300", text: "text-slate-500" },
};

const LIGHT_LABEL: Record<TrafficLight, string> = {
  verde: "En meta",
  amarillo: "Cerca de la meta",
  rojo: "Necesita atención",
  "sin-datos": "Sin datos aún",
};

function lightFromThreshold(value: number | null, green: number, yellow: number, higherIsBetter = true): TrafficLight {
  if (value === null || !Number.isFinite(value)) return "sin-datos";
  if (higherIsBetter) {
    if (value >= green) return "verde";
    if (value >= yellow) return "amarillo";
    return "rojo";
  }
  if (value <= green) return "verde";
  if (value <= yellow) return "amarillo";
  return "rojo";
}

export function buildAdoptionCards(kpis: AdoptionKpis): KpiCard[] {
  const captureSec = kpis.medianCaptureSec ?? kpis.avgFieldCaptureSeconds;
  return [
    {
      id: "time-to-value",
      label: "Arranque Día 1",
      value: kpis.timeToValueMinutes !== null ? `${kpis.timeToValueMinutes} min` : "—",
      hint: "Minutos desde que entraste hasta tener tu granja lista y el primer indicador.",
      light: lightFromThreshold(kpis.timeToValueMinutes, 10, 30, false),
      target: "Meta: menos de 10 min",
      href: "/configuracion/modulos",
      action: "Revisar configuración de arranque",
    },
    {
      id: "capture-speed",
      label: "Captura en galpón",
      value: captureSec !== null ? `${captureSec} s` : "—",
      hint: `Tiempo típico por registro rápido (${kpis.captureSamplesCount} muestras).`,
      light: lightFromThreshold(captureSec, 120, 240, false),
      target: "Meta: menos de 2 min (120 s)",
      href: "/inicio",
      action: "Usar captura rápida",
      simple: true,
    },
    {
      id: "weekly-adherence",
      label: "Adherencia semanal",
      value: `${kpis.weeklyClosureAdherencePct}%`,
      hint: `Días con cierre o registro en los últimos 7 días · ${kpis.adherence21dPct}% en 21 días.`,
      light: lightFromThreshold(kpis.weeklyClosureAdherencePct, 85, 60),
      target: "Meta: ≥ 85% desde la semana 3",
      href: "/operaciones/cierre",
      action: "Cerrar el día de hoy",
      simple: true,
    },
    {
      id: "streak",
      label: "Racha de registro",
      value: `${kpis.captureStreakDays} día${kpis.captureStreakDays === 1 ? "" : "s"}`,
      hint: "Días seguidos con actividad en la granja (cierre o captura).",
      light: lightFromThreshold(kpis.captureStreakDays, 7, 3),
      target: "Meta: 7 días seguidos",
      href: "/planeacion/calendario",
      action: "Ver rutina de hoy",
      simple: true,
    },
    {
      id: "sanitary-integrity",
      label: "Integridad sanitaria",
      value: `${kpis.sanitaryAndGenealogyIntegrityPct}%`,
      hint: "Animales activos con raza registrada y plan sanitario vigente.",
      light: lightFromThreshold(kpis.sanitaryAndGenealogyIntegrityPct, 90, 60),
      target: "Meta: ≥ 90% (retiros y vacunas al día)",
      href: "/sanidad/calendario",
      action: "Revisar calendario sanitario",
    },
    {
      id: "cost-visibility",
      label: "Visibilidad financiera",
      value: `${kpis.costCentersActiveCount}`,
      hint: "Centros de costo activos por especie/lugar (anti-subsidio cruzado).",
      light: kpis.costCentersActiveCount > 0 ? "verde" : "rojo",
      target: "Meta: al menos 1 centro de costo activo",
      href: "/analisis/reportes?tab=analitica",
      action: "Ver contabilidad analítica",
    },
  ];
}

export default function AdoptionKpiPanel({ compact = false }: { compact?: boolean }) {
  const [kpis, setKpis] = useState<AdoptionKpis | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { state } = useOnboardingState();
  const scale = state?.config?.scale ?? "PEQUENO";

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/analisis/kpis-adopcion").then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudieron cargar los KPIs de adopción.")))),
      apiFetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([data, me]) => {
        if (cancelled) return;
        setKpis(data as AdoptionKpis);
        const role = (me as { role?: string } | null)?.role;
        setIsManager(role === "admin" || role === "propietario" || role === "superadmin" || role === "gerente");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error cargando adopción");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-3.5 sm:p-5 animate-pulse border-l-4 border-slate-200">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error || "Sin datos de adopción todavía. Completa el arranque Día 1 y registra tu primera captura."}
      </div>
    );
  }

  const simplified = scale === "PEQUENO" || !isManager;
  const cards = buildAdoptionCards(kpis).filter((card) => (simplified ? card.simple : true));

  return (
    <div className="space-y-3">
      {simplified && !compact && (
        <p className="text-xs text-slate-600">
          Vista sencilla de hábitos. El tablero completo (arranque, sanidad y costos) lo ve el propietario o administrador de la granja.
        </p>
      )}
      <div className={`grid gap-2.5 sm:gap-4 ${compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-3"}`}>
        {cards.map((card) => {
          const style = LIGHT_STYLES[card.light];
          return (
            <div key={card.id} className={`bg-white rounded-lg shadow-md p-3.5 sm:p-5 min-w-0 border-l-4 ${style.border} flex flex-col justify-between`}>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />
                  <span className="truncate">{card.label}</span>
                </p>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{card.value}</p>
                <p className={`text-[11px] sm:text-xs font-semibold mt-0.5 ${style.text}`}>{LIGHT_LABEL[card.light]} · {card.target}</p>
                {!compact && <p className="text-[11px] sm:text-xs text-gray-500 mt-1 line-clamp-2">{card.hint}</p>}
              </div>
              <Link href={card.href} className="mt-2 inline-flex text-xs font-semibold text-green-700 hover:underline">
                {card.action} →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
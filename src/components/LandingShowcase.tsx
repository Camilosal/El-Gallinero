"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Egg,
  Expand,
  Lock,
  Mic,
  Pause,
  Play,
  QrCode,
  ShieldCheck,
  Wheat,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  SHOWCASE_GALLERY,
  SHOWCASE_TABS,
  type ShowcaseSimulationKind,
} from "@/lib/landing-showcase";

interface LightboxEntry {
  title: string;
  subtitle: string;
  image: string;
  alt: string;
  routeLabel: string;
}

const VOICE_PRESETS = [
  {
    id: "huevos",
    label: "Anotar huevos y alimento",
    prompt: "«En el Galpón Principal salieron 140 huevos, 2 rotos, y dimos 1 bulto de postura»",
    requiresConfirm: false,
    resultTitle: "Listo para revisar y guardado al instante",
    resultBody:
      "+138 huevos sanos al inventario · -40 kg de alimento · Queda alimento para 11 días.",
  },
  {
    id: "finanzas",
    label: "Consultar ganancia del mes",
    prompt: "«¿Cómo va la ganancia este mes entre ponedoras y pollos de engorde?»",
    requiresConfirm: false,
    resultTitle: "Resumen claro por cada línea",
    resultBody:
      "Ponedoras: +$312.000 ($384/huevo) · Engorde Lote L-004: +$186.500 ($8.420/kg).",
  },
  {
    id: "venta",
    label: "Registrar una venta",
    prompt: "«Vende 4 cubetas AAA a tienda La Vereda por $96.000 de contado»",
    requiresConfirm: true,
    resultTitle: "Pendiente de tu confirmación",
    resultBody:
      "Descuenta 120 huevos AAA del lote más antiguo y suma $96.000 a caja.",
  },
];

const NTC_GRADES = [
  { weight: 79, grade: "Jumbo", range: "Más de 78 g", priceUnit: 800 },
  { weight: 71, grade: "AAA", range: "67.0 – 77.9 g", priceUnit: 700 },
  { weight: 63, grade: "AA", range: "60.0 – 66.9 g", priceUnit: 600 },
  { weight: 56, grade: "A", range: "53.0 – 59.9 g", priceUnit: 520 },
  { weight: 49, grade: "B", range: "46.0 – 52.9 g", priceUnit: 440 },
];

const NOOP_SUBSCRIBE = () => () => {};

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return NOOP_SUBSCRIBE;
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ShowcaseSimulation({ kind }: { kind: ShowcaseSimulationKind }) {
  const [routineEggsDone, setRoutineEggsDone] = useState(false);
  const [routineBioOpen, setRoutineBioOpen] = useState(false);
  const [routineBioNote, setRoutineBioNote] = useState("Puertas y mallas cerradas sin novedad");
  const [routineBioDone, setRoutineBioDone] = useState(false);

  const [trays, setTrays] = useState(4);
  const [bags, setBags] = useState(2);
  const [captureSaved, setCaptureSaved] = useState(false);

  const [voiceIndex, setVoiceIndex] = useState(0);
  const [voiceConfirmed, setVoiceConfirmed] = useState(false);

  const [eggWeight, setEggWeight] = useState(69);

  const [underWithdrawal, setUnderWithdrawal] = useState(true);

  const [offlineMode, setOfflineMode] = useState(true);

  if (kind === "routines") {
    const doneCount = (routineEggsDone ? 1 : 0) + (routineBioDone ? 1 : 0);
    return (
      <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
            Prueba interactiva · Tareas de hoy
          </span>
          <span className="text-xs text-[var(--iw-semantic-text-secondary)] font-mono">
            {doneCount} / 2 completas
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
                Recoger postura de la mañana
              </p>
              <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                {routineEggsDone
                  ? "Registrado al guardar la producción"
                  : "Se completa automáticamente al anotar huevos"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRoutineEggsDone((v) => !v)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                routineEggsDone
                  ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                  : "border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)]"
              }`}
            >
              {routineEggsDone ? "Completa" : "Registrar"}
            </button>
          </div>

          <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
                  Revisión de bebederos y mallas
                </p>
                <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                  {routineBioDone
                    ? "Confirmado con nota de campo"
                    : "Pide nota breve del recorrido en campo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (routineBioDone) {
                    setRoutineBioDone(false);
                    setRoutineBioOpen(false);
                  } else {
                    setRoutineBioOpen((v) => !v);
                  }
                }}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  routineBioDone
                    ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                    : "border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)]"
                }`}
              >
                {routineBioDone ? "Confirmada" : "Confirmar"}
              </button>
            </div>

            {routineBioOpen && !routineBioDone && (
              <div className="mt-2.5 flex flex-col sm:flex-row gap-2 pt-2.5 border-t border-[var(--iw-semantic-border-default)]">
                <input
                  type="text"
                  aria-label="Observación de recorrido en granja"
                  value={routineBioNote}
                  onChange={(e) => setRoutineBioNote(e.target.value)}
                  placeholder="Ej. Bebederos limpios y malla intacta"
                  className="flex-1 rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1.5 text-xs text-[var(--iw-semantic-text-primary)] focus:outline-none focus:border-[var(--iw-semantic-action-primary)]"
                />
                <button
                  type="button"
                  disabled={routineBioNote.trim().length < 5}
                  onClick={() => {
                    setRoutineBioDone(true);
                    setRoutineBioOpen(false);
                  }}
                  className="rounded-md bg-[var(--iw-semantic-action-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--iw-semantic-action-primary-text)] disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (kind === "quick-capture") {
    const totalEggs = trays * 30;
    const totalFeedKg = bags * 40;
    return (
      <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
            <QrCode className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)]" />
            Galpón Principal · Código QR
          </span>
          <span className="text-[11px] font-mono text-[var(--iw-semantic-text-secondary)]">
            Vista de campo
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--iw-semantic-text-secondary)] mb-1.5">
              <span>Cubetas (30 uds)</span>
              <Egg className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)]" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Restar cubeta"
                onClick={() => {
                  setTrays((t) => Math.max(0, t - 1));
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--iw-semantic-border-default)] bg-white text-sm font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)]"
              >
                -
              </button>
              <span className="font-mono text-base font-bold text-[var(--iw-semantic-text-primary)]">
                {trays}
              </span>
              <button
                type="button"
                aria-label="Sumar cubeta"
                onClick={() => {
                  setTrays((t) => t + 1);
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--iw-semantic-border-default)] bg-white text-sm font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)]"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--iw-semantic-text-secondary)] mb-1.5">
              <span>Bultos (40 kg)</span>
              <Wheat className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)]" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Restar bulto"
                onClick={() => {
                  setBags((b) => Math.max(0, b - 1));
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--iw-semantic-border-default)] bg-white text-sm font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)]"
              >
                -
              </button>
              <span className="font-mono text-base font-bold text-[var(--iw-semantic-text-primary)]">
                {bags}
              </span>
              <button
                type="button"
                aria-label="Sumar bulto"
                onClick={() => {
                  setBags((b) => b + 1);
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--iw-semantic-border-default)] bg-white text-sm font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)]"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--iw-semantic-text-secondary)] font-mono">
            +{totalEggs} huevos · -{totalFeedKg} kg en bodega
          </p>
          <button
            type="button"
            onClick={() => setCaptureSaved(true)}
            className="rounded-md bg-[var(--iw-semantic-action-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--iw-semantic-action-primary-text)] hover:bg-[var(--iw-semantic-action-primary-hover)] transition"
          >
            {captureSaved ? "Guardado" : "Guardar"}
          </button>
        </div>

        {captureSaved && (
          <p className="mt-2.5 rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 text-xs text-[var(--iw-semantic-text-primary)]">
            Guardado: +{totalEggs} huevos · -{totalFeedKg} kg en bodega · Utilidad neta hoy +$214.000 (lista para WhatsApp).
          </p>
        )}
      </div>
    );
  }

  if (kind === "ai-voice") {
    const preset = VOICE_PRESETS[voiceIndex];
    return (
      <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
            <Mic className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)]" />
            Ejemplo con voz o mensaje escrito
          </span>
          <div className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
            <span className="land-voice-bar" />
            <span className="land-voice-bar" />
            <span className="land-voice-bar" />
            <span className="land-voice-bar" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {VOICE_PRESETS.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setVoiceIndex(idx);
                setVoiceConfirmed(false);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                voiceIndex === idx
                  ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                  : "border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3 text-xs space-y-2">
          <p className="italic text-[var(--iw-semantic-text-primary)]">{preset.prompt}</p>
          <div className="pt-2 border-t border-[var(--iw-semantic-border-default)] flex items-start gap-2">
            <Bot className="w-4 h-4 text-[var(--iw-semantic-action-primary)] shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-[var(--iw-semantic-text-primary)]">
                {preset.requiresConfirm && voiceConfirmed
                  ? "Operación guardada y factura al día"
                  : preset.resultTitle}
              </p>
              <p className="text-[var(--iw-semantic-text-secondary)] leading-relaxed">{preset.resultBody}</p>
              {preset.requiresConfirm && !voiceConfirmed && (
                <button
                  type="button"
                  onClick={() => setVoiceConfirmed(true)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[var(--iw-semantic-action-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--iw-semantic-action-primary-text)] hover:bg-[var(--iw-semantic-action-primary-hover)]"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Confirmar operación
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "ntc1240-curves") {
    const matched =
      NTC_GRADES.find((g) => eggWeight >= g.weight - 3) ??
      NTC_GRADES[NTC_GRADES.length - 1];
    const trayPrice = matched.priceUnit * 30;
    return (
      <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
            Clasificador por peso (norma NTC 1240)
          </span>
          <span className="font-mono text-xs font-semibold text-[var(--iw-semantic-action-primary)]">
            {eggWeight} g · Categoría {matched.grade}
          </span>
        </div>

        <label className="block mb-3">
          <span className="sr-only">Peso del huevo en gramos</span>
          <input
            type="range"
            min={46}
            max={80}
            value={eggWeight}
            onChange={(e) => setEggWeight(Number(e.target.value))}
            className="w-full accent-[var(--iw-semantic-action-primary)]"
          />
          <div className="flex justify-between text-[11px] font-mono text-[var(--iw-semantic-text-secondary)] mt-1">
            <span>46 g (B)</span>
            <span>60 g (AA)</span>
            <span>67 g (AAA)</span>
            <span>80 g (Jumbo)</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
            <span className="text-[11px] text-[var(--iw-semantic-text-secondary)] block">Clasificación</span>
            <span className="text-sm font-bold text-[var(--iw-semantic-text-primary)]">
              Tipo {matched.grade}
            </span>
            <span className="text-[11px] text-[var(--iw-semantic-text-secondary)] block">
              {matched.range}
            </span>
          </div>
          <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
            <span className="text-[11px] text-[var(--iw-semantic-text-secondary)] block">Valor sugerido</span>
            <span className="text-sm font-bold text-[var(--iw-semantic-text-primary)]">
              ${trayPrice.toLocaleString("es-CO")} / cubeta
            </span>
            <span className="text-[11px] text-[var(--iw-semantic-text-secondary)] block">
              ${matched.priceUnit.toLocaleString("es-CO")} por unidad
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "sanitary-withdrawal") {
    return (
      <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
            Control de retiro veterinario
          </span>
          <button
            type="button"
            onClick={() => setUnderWithdrawal((v) => !v)}
            className="rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)] transition"
          >
            {underWithdrawal ? "Simular día 8 (libre)" : "Simular tratamiento activo"}
          </button>
        </div>

        <div
          className={`rounded-lg border border-[var(--iw-semantic-border-default)] border-l-4 bg-[var(--iw-semantic-bg-surface)] p-3 text-xs ${
            underWithdrawal
              ? "border-l-[var(--iw-color-ochre)]"
              : "border-l-[var(--iw-semantic-action-primary)]"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {underWithdrawal ? (
              <Lock className="w-4 h-4 text-[var(--iw-color-ochre)] shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[var(--iw-semantic-action-primary)] shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold text-[var(--iw-semantic-text-primary)]">
                {underWithdrawal
                  ? "Venta bloqueada: Lote en día 4 de 8 de retiro"
                  : "Retiro cumplido: lote habilitado para venta"}
              </p>
              <p className="text-[var(--iw-semantic-text-secondary)] leading-relaxed">
                {underWithdrawal
                  ? "Para proteger al comprador, la app impide facturar huevos o carne de este corral hasta cumplir el tiempo del medicamento."
                  : "El periodo de seguridad terminó. El lote queda libre nuevamente en el registro de ventas."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
          {offlineMode ? (
            <WifiOff className="w-3.5 h-3.5 text-[var(--iw-color-ochre)]" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)]" />
          )}
          {offlineMode ? "Sin señal en el galpón" : "Señal recuperada"}
        </span>
        <button
          type="button"
          onClick={() => setOfflineMode((v) => !v)}
          className="rounded-md bg-[var(--iw-semantic-action-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--iw-semantic-action-primary-text)] hover:bg-[var(--iw-semantic-action-primary-hover)] transition"
        >
          {offlineMode ? "Simular conexión" : "Simular sin señal"}
        </button>
      </div>

      <div className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--iw-semantic-text-primary)]">
            {offlineMode
              ? "2 registros en copia cifrada del teléfono"
              : "Sincronizado con copia local cifrada"}
          </span>
          <span className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)]">
            {offlineMode ? "En espera" : "Sincronizado"}
          </span>
        </div>
        <p className="text-[var(--iw-semantic-text-secondary)]">
          {offlineMode
            ? "Puedes seguir registrando huevos, alimento, vacunas y cierres sin señal; todo se sube al volver a casa."
            : "Stock PEPS: 284 huevos · Utilidad neta hoy: +$214.000 · Resumen listo para WhatsApp."}
        </p>
      </div>
    </div>
  );
}

export function LandingShowcase({
  variant = "full",
}: {
  variant?: "full" | "hero";
}) {
  const isHero = variant === "hero";
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [secondaryView, setSecondaryView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryAnnouncement, setGalleryAnnouncement] = useState("");

  const sectionRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const galleryTrackRef = useRef<HTMLDivElement>(null);
  const gallerySlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingGalleryTargetRef = useRef<number | null>(null);
  const gallerySettleTimeoutRef = useRef<number | null>(null);
  const galleryRafRef = useRef<number | null>(null);
  const tabBaseId = useId();

  const activeTab = SHOWCASE_TABS[activeIndex];

  const lightboxEntries: LightboxEntry[] = useMemo(() => {
    const tabEntries = SHOWCASE_TABS.map((t) => ({
      title: t.title,
      subtitle: t.description,
      image: t.screenshot,
      alt: t.screenshotAlt,
      routeLabel: t.routeLabel,
    }));
    const galleryEntries = SHOWCASE_GALLERY.map((g) => ({
      title: g.title,
      subtitle: g.summary,
      image: g.image,
      alt: g.alt,
      routeLabel: g.routeLabel,
    }));
    return [...tabEntries, ...galleryEntries];
  }, []);

  useEffect(() => {
    if (isHero) return;
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);

    const onVisibilityChange = (e: Event) => {
      const skipped = (e as Event & { skipped?: boolean }).skipped;
      if (typeof skipped === "boolean" && skipped) {
        setInView(false);
      }
    };
    el.addEventListener("contentvisibilityautostatechange", onVisibilityChange);

    return () => {
      io.disconnect();
      el.removeEventListener("contentvisibilityautostatechange", onVisibilityChange);
    };
  }, [isHero]);

  useEffect(() => {
    if (isHero || paused || prefersReducedMotion || !inView || lightboxIndex !== null) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SHOWCASE_TABS.length);
      setSecondaryView(false);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [isHero, paused, prefersReducedMotion, inView, lightboxIndex]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxIndex !== null && !dialog.open) {
      dialog.showModal();
    } else if (lightboxIndex === null && dialog.open) {
      dialog.close();
    }
  }, [lightboxIndex]);

  const scrollToGallerySlide = useCallback(
    (targetIndex: number, announce = false) => {
      const total = SHOWCASE_GALLERY.length;
      const bounded = (targetIndex + total) % total;

      pendingGalleryTargetRef.current = bounded;
      if (gallerySettleTimeoutRef.current !== null) {
        window.clearTimeout(gallerySettleTimeoutRef.current);
      }
      gallerySettleTimeoutRef.current = window.setTimeout(
        () => {
          pendingGalleryTargetRef.current = null;
        },
        prefersReducedMotion ? 60 : 700,
      );

      setGalleryIndex(bounded);
      if (announce) {
        const slide = SHOWCASE_GALLERY[bounded];
        setGalleryAnnouncement(`Pantalla ${bounded + 1} de ${total}: ${slide.title}`);
      }

      const track = galleryTrackRef.current;
      const slideEl = gallerySlideRefs.current[bounded];
      if (track && slideEl) {
        const targetLeft = Math.max(0, slideEl.offsetLeft - track.offsetLeft);
        track.scrollTo({
          left: targetLeft,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      }
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    if (
      isHero ||
      !galleryOpen ||
      galleryPaused ||
      prefersReducedMotion ||
      !inView ||
      lightboxIndex !== null
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      scrollToGallerySlide(galleryIndex + 1, false);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [
    isHero,
    galleryOpen,
    galleryPaused,
    prefersReducedMotion,
    inView,
    lightboxIndex,
    galleryIndex,
    scrollToGallerySlide,
  ]);

  useEffect(() => {
    return () => {
      if (gallerySettleTimeoutRef.current !== null) {
        window.clearTimeout(gallerySettleTimeoutRef.current);
      }
      if (galleryRafRef.current !== null) {
        window.cancelAnimationFrame(galleryRafRef.current);
      }
    };
  }, []);

  const handleGalleryScroll = useCallback(() => {
    if (pendingGalleryTargetRef.current !== null) return;
    if (galleryRafRef.current !== null) return;

    galleryRafRef.current = window.requestAnimationFrame(() => {
      galleryRafRef.current = null;
      const track = galleryTrackRef.current;
      if (!track || pendingGalleryTargetRef.current !== null) return;

      let nearest = 0;
      let minDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < SHOWCASE_GALLERY.length; i += 1) {
        const slideEl = gallerySlideRefs.current[i];
        if (!slideEl) continue;
        const dist = Math.abs(slideEl.offsetLeft - track.offsetLeft - track.scrollLeft);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      setGalleryIndex((prev) => (prev === nearest ? prev : nearest));
    });
  }, []);

  const handleGalleryScrollEnd = useCallback(() => {
    if (gallerySettleTimeoutRef.current !== null) {
      window.clearTimeout(gallerySettleTimeoutRef.current);
      gallerySettleTimeoutRef.current = null;
    }
    pendingGalleryTargetRef.current = null;
  }, []);

  useEffect(() => {
    const track = galleryTrackRef.current;
    if (!track || typeof window === "undefined" || !("onscrollend" in window)) {
      return;
    }
    track.addEventListener("scrollend", handleGalleryScrollEnd);
    return () => track.removeEventListener("scrollend", handleGalleryScrollEnd);
  }, [handleGalleryScrollEnd]);

  const selectTab = useCallback((index: number, focus = false) => {
    const bounded = (index + SHOWCASE_TABS.length) % SHOWCASE_TABS.length;
    setActiveIndex(bounded);
    setSecondaryView(false);
    setPaused(true);
    if (focus) {
      tabRefs.current[bounded]?.focus();
    }
  }, []);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        selectTab(idx + 1, true);
        break;
      case "ArrowLeft":
        e.preventDefault();
        selectTab(idx - 1, true);
        break;
      case "Home":
        e.preventDefault();
        selectTab(0, true);
        break;
      case "End":
        e.preventDefault();
        selectTab(SHOWCASE_TABS.length - 1, true);
        break;
    }
  };

  const displayImage =
    secondaryView && activeTab.secondaryScreenshot
      ? activeTab.secondaryScreenshot
      : activeTab.screenshot;
  const displayAlt =
    secondaryView && activeTab.secondaryAlt
      ? activeTab.secondaryAlt
      : activeTab.screenshotAlt;

  const activeLightbox =
    lightboxIndex !== null ? lightboxEntries[lightboxIndex] : null;

  const browserFrame = (
    <div className="land-browser-frame">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)]">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--iw-color-terracotta)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--iw-color-ochre)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--iw-color-forest)]" />
        </div>

        <span className="truncate font-mono text-[11px] text-[var(--iw-semantic-text-secondary)]">
          {activeTab.routeLabel}
        </span>

        <button
          type="button"
          onClick={() => setLightboxIndex(activeIndex)}
          aria-label="Ampliar captura de pantalla"
          className="inline-flex items-center gap-1 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)] transition shrink-0"
        >
          <Expand className="w-3 h-3" />
          Ampliar
        </button>
      </div>

      <div className="relative bg-[var(--iw-semantic-bg-surface)] overflow-hidden">
        <Image
          key={displayImage}
          src={displayImage}
          alt={displayAlt}
          width={1280}
          height={800}
          priority={activeIndex === 0}
          onClick={() => setLightboxIndex(activeIndex)}
          className="w-full h-auto object-cover cursor-zoom-in block land-panel-enter"
        />
      </div>

      {activeTab.secondaryScreenshot && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]">
          <span className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
            Vista: {secondaryView ? activeTab.secondaryLabel : "Principal"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSecondaryView(false)}
              className={`rounded-[var(--iw-radius-control)] px-2.5 py-1 text-[11px] font-semibold transition ${
                !secondaryView
                  ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                  : "text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
              }`}
            >
              Principal
            </button>
            <button
              type="button"
              onClick={() => setSecondaryView(true)}
              className={`rounded-[var(--iw-radius-control)] px-2.5 py-1 text-[11px] font-semibold transition ${
                secondaryView
                  ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                  : "text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
              }`}
            >
              {activeTab.secondaryLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section
      id={isHero ? undefined : "vitrina"}
      ref={sectionRef}
      className={isHero ? "land-hero-showcase" : "land-section land-showcase"}
      aria-labelledby={isHero ? undefined : "vitrina-heading"}
      aria-label={isHero ? "Vista interactiva de IwaGranja" : undefined}
    >
      <div className={isHero ? "" : "land-wrap"}>
        {!isHero && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <p className="land-eyebrow">1 · Así se ve por dentro</p>
              <h2 id="vitrina-heading" className="land-h2">
                Pantallas reales y pruebas interactivas
              </h2>
              <p className="land-section-sub" style={{ marginBottom: 0 }}>
                Explora cómo trabajas cada módulo en el día a día antes de crear tu granja.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="self-start md:self-auto inline-flex items-center gap-2 rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)] transition"
            >
              {paused || prefersReducedMotion ? (
                <>
                  <Play className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)]" />
                  Reanudar
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)]" />
                  Pausar recorrido
                </>
              )}
            </button>
          </div>
        )}

        <div
          role="tablist"
          aria-label="Módulos de IwaGranja"
          className={`land-tablist ${isHero ? "land-tablist-hero mb-3" : "mb-6"}`}
        >
          {SHOWCASE_TABS.map((tab, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`${tabBaseId}-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectTab(idx)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`land-tab ${isSelected ? "is-active" : ""}`}
              >
                <span className="hidden sm:inline">{tab.tabLabel}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div
          id={`${tabBaseId}-panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`${tabBaseId}-tab-${activeTab.id}`}
          className={isHero ? "land-hero-panel" : "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"}
        >
          {isHero ? (
            <>
              {browserFrame}
              <div
                key={activeTab.id}
                className="land-hero-caption rounded-xl border border-white/15 bg-[var(--iw-semantic-bg-surface)] p-3.5 shadow-sm land-panel-enter"
              >
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--iw-semantic-action-primary)]">
                  {activeTab.eyebrow}
                </p>
                <p className="mt-1 font-display text-sm font-bold text-[var(--iw-semantic-text-primary)] leading-snug">
                  {activeTab.title}
                </p>
                <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)] leading-relaxed line-clamp-2">
                  {activeTab.description}
                </p>
                <details className="land-hero-details mt-2 border-t border-[var(--iw-semantic-border-default)] pt-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-[var(--iw-semantic-action-primary)]">
                    Probar esta pantalla
                    <ChevronDown className="land-norm-chevron w-3.5 h-3.5 shrink-0" />
                  </summary>
                  <div className="mt-3 space-y-3">
                    <ul className="space-y-1.5 text-xs text-[var(--iw-semantic-text-primary)]">
                      {activeTab.highlights.map((hl) => (
                        <li key={hl} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--iw-semantic-action-primary)] shrink-0 mt-0.5" />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                    <ShowcaseSimulation kind={activeTab.simulationKind} />
                  </div>
                </details>
              </div>
            </>
          ) : (
            <>
              <div
                key={`header-${activeTab.id}`}
                className="lg:col-span-12 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-5 py-4 sm:px-6 sm:py-5 shadow-xs land-panel-enter"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-[var(--iw-semantic-action-primary)] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--iw-semantic-action-primary-text)]">
                      {activeTab.eyebrow}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)]">
                      {activeTab.routeLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTab.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-0.5 font-mono text-[10px] font-medium text-[var(--iw-semantic-text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <h3 className="font-display text-xl sm:text-2xl lg:text-[26px] font-bold text-[var(--iw-semantic-text-primary)] leading-snug">
                  {activeTab.title}
                </h3>
                <p className="mt-1.5 text-sm sm:text-base text-[var(--iw-semantic-text-secondary)] leading-relaxed max-w-4xl">
                  {activeTab.description}
                </p>
              </div>

              <div className="lg:col-span-7">{browserFrame}</div>

              <div className="lg:col-span-5">
                <div
                  key={`body-${activeTab.id}`}
                  className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 sm:p-6 space-y-4 shadow-sm land-panel-enter"
                >
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--iw-semantic-action-primary)]">
                      Qué resuelve en campo
                    </p>
                    <ul className="mt-2.5 space-y-2 text-xs sm:text-sm text-[var(--iw-semantic-text-primary)]">
                      {activeTab.highlights.map((hl) => (
                        <li key={hl} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[var(--iw-semantic-action-primary)] shrink-0 mt-0.5" />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ShowcaseSimulation kind={activeTab.simulationKind} />
                </div>
              </div>
            </>
          )}
        </div>

        {!isHero && (
          <details
            className="land-gallery-accordion mt-10 border-t border-[var(--iw-semantic-border-default)] pt-6"
            onToggle={(event) => setGalleryOpen(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-1 py-2 text-[var(--iw-semantic-text-primary)]">
              <span>
                <span className="block font-display text-lg sm:text-xl font-bold">Más pantallas del sistema</span>
                <span className="mt-1 block text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)]">Explora las vistas clave de IwaGranja cuando quieras ver más.</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--iw-semantic-action-primary)]">
                {galleryOpen ? "Cerrar galería" : `Ver ${SHOWCASE_GALLERY.length} pantallas`}
                <ChevronDown className="land-gallery-chevron h-4 w-4" aria-hidden="true" />
              </span>
            </summary>
            <div
              role="region"
              aria-roledescription="carousel"
              aria-label="Más pantallas del sistema"
              className="pt-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGalleryPaused(true);
                    scrollToGallerySlide(galleryIndex - 1, true);
                  }}
                  aria-label="Pantalla anterior en la galería"
                  className="land-carousel-ctrl inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)] transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryPaused((p) => !p)}
                  className="land-carousel-ctrl inline-flex items-center gap-1.5 rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)] transition"
                >
                  {galleryPaused || prefersReducedMotion ? (
                    <>
                      <Play className="w-3 h-3 text-[var(--iw-semantic-action-primary)]" />
                      Reanudar galería
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3 text-[var(--iw-semantic-action-primary)]" />
                      Pausar galería
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGalleryPaused(true);
                    scrollToGallerySlide(galleryIndex + 1, true);
                  }}
                  aria-label="Siguiente pantalla en la galería"
                  className="land-carousel-ctrl inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-action-primary)] transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <Link
                  href="/login"
                  className="ml-1 text-xs font-semibold text-[var(--iw-semantic-action-primary)] hover:underline shrink-0"
                >
                  Probar en vivo →
                </Link>
              </div>
            <div
              ref={galleryTrackRef}
              tabIndex={0}
              role="group"
              aria-label="Vistas del sistema"
              onScroll={handleGalleryScroll}
              className="land-carousel-track"
            >
              {SHOWCASE_GALLERY.map((item, idx) => {
                const isActiveSlide = idx === galleryIndex;
                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      gallerySlideRefs.current[idx] = el;
                    }}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${idx + 1} de ${SHOWCASE_GALLERY.length}: ${item.title}`}
                    className={`land-carousel-slide ${isActiveSlide ? "is-active" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(SHOWCASE_TABS.length + idx)}
                      className="land-carousel-card group w-full h-full text-left rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] overflow-hidden hover:border-[var(--iw-semantic-action-primary)] focus-visible:outline-2 focus-visible:outline-[var(--iw-semantic-action-primary)] flex flex-col"
                    >
                      <div className="relative aspect-[16/10] w-full bg-white overflow-hidden border-b border-[var(--iw-semantic-border-default)]">
                        <Image
                          src={item.image}
                          alt={item.alt}
                          width={640}
                          height={400}
                          loading="lazy"
                          className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                        />
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-[var(--iw-color-forest-dark)]/90 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--iw-color-paper)]">
                          {item.moduleTag}
                        </span>
                      </div>
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-1.5">
                        <div>
                          <p className="text-sm font-bold text-[var(--iw-semantic-text-primary)] line-clamp-1">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)] line-clamp-2 leading-relaxed">
                            {item.summary}
                          </p>
                        </div>
                        <p className="pt-1 font-mono text-[10px] text-[var(--iw-semantic-action-primary)] truncate">
                          {item.routeLabel}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {galleryAnnouncement}
            </p>

            <nav
              aria-label="Elegir pantalla de la galería"
              className="mt-3 flex flex-wrap items-center justify-center gap-2"
            >
              {SHOWCASE_GALLERY.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Ir a pantalla ${idx + 1}: ${item.title}`}
                  aria-current={idx === galleryIndex ? "true" : undefined}
                  onClick={() => {
                    setGalleryPaused(true);
                    scrollToGallerySlide(idx, true);
                  }}
                  className="land-carousel-marker"
                />
              ))}
            </nav>
            </div>
          </details>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onCancel={() => setLightboxIndex(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setLightboxIndex(null);
        }}
        aria-label={activeLightbox?.title ?? "Vista ampliada de pantalla"}
        className="backdrop:bg-black/75 backdrop:backdrop-blur-xs bg-transparent p-0 m-auto max-w-5xl w-[94vw] rounded-2xl overflow-hidden shadow-[var(--iw-shadow-popover)]"
      >
        {activeLightbox && (
          <div className="bg-[var(--iw-semantic-bg-surface)] border border-[var(--iw-semantic-border-default)] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)]">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-[var(--iw-semantic-text-secondary)] truncate">
                  {activeLightbox.routeLabel}
                </p>
                <h4 className="font-display text-base sm:text-lg font-bold text-[var(--iw-semantic-text-primary)] truncate">
                  {activeLightbox.title}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="Pantalla anterior"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev === null
                        ? 0
                        : (prev - 1 + lightboxEntries.length) % lightboxEntries.length,
                    )
                  }
                  className="p-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] hover:bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Pantalla siguiente"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev === null ? 0 : (prev + 1) % lightboxEntries.length,
                    )
                  }
                  className="p-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] hover:bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Cerrar vista ampliada"
                  onClick={() => setLightboxIndex(null)}
                  className="p-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] hover:bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-[var(--iw-semantic-bg-surface)] max-h-[72vh] overflow-auto">
              <Image
                src={activeLightbox.image}
                alt={activeLightbox.alt}
                width={1440}
                height={900}
                className="w-full h-auto block"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)]">
              <p className="text-xs text-[var(--iw-semantic-text-secondary)]">{activeLightbox.subtitle}</p>
              <Link
                href="/login"
                onClick={() => setLightboxIndex(null)}
                className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-action-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--iw-semantic-action-primary-text)] hover:bg-[var(--iw-semantic-action-primary-hover)] shrink-0"
              >
                Abrir en la app →
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}

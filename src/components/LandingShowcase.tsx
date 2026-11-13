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
      <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs font-semibold text-[var(--ink)]">
            Prueba interactiva · Tareas de hoy
          </span>
          <span className="text-xs text-[var(--moss)] font-mono">
            {doneCount} / 2 completas
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-[var(--ink)]">
                Recoger postura de la mañana
              </p>
              <p className="text-[11px] text-[var(--moss)]">
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
                  ? "bg-[var(--forest)] text-white"
                  : "border border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--forest)]"
              }`}
            >
              {routineEggsDone ? "Completa" : "Registrar"}
            </button>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--ink)]">
                  Revisión de bebederos y mallas
                </p>
                <p className="text-[11px] text-[var(--moss)]">
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
                    ? "bg-[var(--forest)] text-white"
                    : "border border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--forest)]"
                }`}
              >
                {routineBioDone ? "Confirmada" : "Confirmar"}
              </button>
            </div>

            {routineBioOpen && !routineBioDone && (
              <div className="mt-2.5 flex flex-col sm:flex-row gap-2 pt-2.5 border-t border-[var(--line)]">
                <input
                  type="text"
                  aria-label="Observación de recorrido en granja"
                  value={routineBioNote}
                  onChange={(e) => setRoutineBioNote(e.target.value)}
                  placeholder="Ej. Bebederos limpios y malla intacta"
                  className="flex-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--forest)]"
                />
                <button
                  type="button"
                  disabled={routineBioNote.trim().length < 5}
                  onClick={() => {
                    setRoutineBioDone(true);
                    setRoutineBioOpen(false);
                  }}
                  className="rounded-md bg-[var(--forest)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
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
      <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
            <QrCode className="w-3.5 h-3.5 text-[var(--forest)]" />
            Galpón Principal · Código QR
          </span>
          <span className="text-[11px] font-mono text-[var(--moss)]">
            Vista de campo
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--moss)] mb-1.5">
              <span>Cubetas (30 uds)</span>
              <Egg className="w-3.5 h-3.5 text-[var(--forest)]" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Restar cubeta"
                onClick={() => {
                  setTrays((t) => Math.max(0, t - 1));
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)]"
              >
                -
              </button>
              <span className="font-mono text-base font-bold text-[var(--ink)]">
                {trays}
              </span>
              <button
                type="button"
                aria-label="Sumar cubeta"
                onClick={() => {
                  setTrays((t) => t + 1);
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)]"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--moss)] mb-1.5">
              <span>Bultos (40 kg)</span>
              <Wheat className="w-3.5 h-3.5 text-[var(--forest)]" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Restar bulto"
                onClick={() => {
                  setBags((b) => Math.max(0, b - 1));
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)]"
              >
                -
              </button>
              <span className="font-mono text-base font-bold text-[var(--ink)]">
                {bags}
              </span>
              <button
                type="button"
                aria-label="Sumar bulto"
                onClick={() => {
                  setBags((b) => b + 1);
                  setCaptureSaved(false);
                }}
                className="w-7 h-7 rounded-md border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)]"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--moss)] font-mono">
            +{totalEggs} huevos · -{totalFeedKg} kg en bodega
          </p>
          <button
            type="button"
            onClick={() => setCaptureSaved(true)}
            className="rounded-md bg-[var(--forest)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--forest-deep)] transition"
          >
            {captureSaved ? "Guardado" : "Guardar"}
          </button>
        </div>

        {captureSaved && (
          <p className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs text-[var(--ink)]">
            Guardado: +{totalEggs} huevos · -{totalFeedKg} kg en bodega · Utilidad neta hoy +$214.000 (lista para WhatsApp).
          </p>
        )}
      </div>
    );
  }

  if (kind === "ai-voice") {
    const preset = VOICE_PRESETS[voiceIndex];
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
            <Mic className="w-3.5 h-3.5 text-[var(--forest)]" />
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
                  ? "bg-[var(--forest)] text-white"
                  : "border border-[var(--line)] bg-[var(--paper)] text-[var(--moss)] hover:text-[var(--ink)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 text-xs space-y-2">
          <p className="italic text-[var(--ink)]">{preset.prompt}</p>
          <div className="pt-2 border-t border-[var(--line)] flex items-start gap-2">
            <Bot className="w-4 h-4 text-[var(--forest)] shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-[var(--ink)]">
                {preset.requiresConfirm && voiceConfirmed
                  ? "Operación guardada y factura al día"
                  : preset.resultTitle}
              </p>
              <p className="text-[var(--moss)] leading-relaxed">{preset.resultBody}</p>
              {preset.requiresConfirm && !voiceConfirmed && (
                <button
                  type="button"
                  onClick={() => setVoiceConfirmed(true)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[var(--forest)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--forest-deep)]"
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
      <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-[var(--ink)]">
            Clasificador por peso (norma NTC 1240)
          </span>
          <span className="font-mono text-xs font-semibold text-[var(--forest)]">
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
            className="w-full accent-[#1e3d2b]"
          />
          <div className="flex justify-between text-[11px] font-mono text-[var(--moss)] mt-1">
            <span>46 g (B)</span>
            <span>60 g (AA)</span>
            <span>67 g (AAA)</span>
            <span>80 g (Jumbo)</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <span className="text-[11px] text-[var(--moss)] block">Clasificación</span>
            <span className="text-sm font-bold text-[var(--ink)]">
              Tipo {matched.grade}
            </span>
            <span className="text-[11px] text-[var(--moss)] block">
              {matched.range}
            </span>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <span className="text-[11px] text-[var(--moss)] block">Valor sugerido</span>
            <span className="text-sm font-bold text-[var(--ink)]">
              ${trayPrice.toLocaleString("es-CO")} / cubeta
            </span>
            <span className="text-[11px] text-[var(--moss)] block">
              ${matched.priceUnit.toLocaleString("es-CO")} por unidad
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "sanitary-withdrawal") {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-[var(--ink)]">
            Control de retiro veterinario
          </span>
          <button
            type="button"
            onClick={() => setUnderWithdrawal((v) => !v)}
            className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] hover:border-[var(--forest)] transition"
          >
            {underWithdrawal ? "Simular día 8 (libre)" : "Simular tratamiento activo"}
          </button>
        </div>

        <div
          className={`rounded-lg border border-[var(--line)] border-l-4 bg-[var(--paper)] p-3 text-xs ${
            underWithdrawal
              ? "border-l-[var(--amber-deep)]"
              : "border-l-[var(--forest)]"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {underWithdrawal ? (
              <Lock className="w-4 h-4 text-[var(--amber-deep)] shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[var(--forest)] shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold text-[var(--ink)]">
                {underWithdrawal
                  ? "Venta bloqueada: Lote en día 4 de 8 de retiro"
                  : "Retiro cumplido: lote habilitado para venta"}
              </p>
              <p className="text-[var(--moss)] leading-relaxed">
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
    <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
          {offlineMode ? (
            <WifiOff className="w-3.5 h-3.5 text-[var(--amber-deep)]" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-[var(--forest)]" />
          )}
          {offlineMode ? "Sin señal en el galpón" : "Señal recuperada"}
        </span>
        <button
          type="button"
          onClick={() => setOfflineMode((v) => !v)}
          className="rounded-md bg-[var(--forest)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--forest-deep)] transition"
        >
          {offlineMode ? "Simular conexión" : "Simular sin señal"}
        </button>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--ink)]">
            {offlineMode
              ? "2 registros en copia cifrada del teléfono"
              : "Sincronizado con copia local cifrada"}
          </span>
          <span className="font-mono text-[11px] text-[var(--moss)]">
            {offlineMode ? "En espera" : "Sincronizado"}
          </span>
        </div>
        <p className="text-[var(--moss)]">
          {offlineMode
            ? "Puedes seguir registrando huevos, alimento, vacunas y cierres sin señal; todo se sube al volver a casa."
            : "Stock PEPS: 284 huevos · Utilidad neta hoy: +$214.000 · Resumen listo para WhatsApp."}
        </p>
      </div>
    </div>
  );
}

export function LandingShowcase() {
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

  const sectionRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
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
  }, []);

  useEffect(() => {
    if (paused || prefersReducedMotion || !inView || lightboxIndex !== null) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SHOWCASE_TABS.length);
      setSecondaryView(false);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [paused, prefersReducedMotion, inView, lightboxIndex]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxIndex !== null && !dialog.open) {
      dialog.showModal();
    } else if (lightboxIndex === null && dialog.open) {
      dialog.close();
    }
  }, [lightboxIndex]);

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

  return (
    <section
      id="vitrina"
      ref={sectionRef}
      className="land-section land-showcase"
      aria-labelledby="vitrina-heading"
    >
      <div className="land-wrap">
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
            aria-pressed={paused}
            className="self-start md:self-auto inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--forest)] transition"
          >
            {paused || prefersReducedMotion ? (
              <>
                <Play className="w-3.5 h-3.5 text-[var(--forest)]" />
                Reanudar
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-[var(--forest)]" />
                Pausar recorrido
              </>
            )}
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Módulos de El Gallinero"
          className="land-tablist mb-6"
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
                aria-controls={`${tabBaseId}-panel-${tab.id}`}
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
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className="lg:col-span-7">
            <div className="land-browser-frame">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--line)] bg-[#f4ede0]">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d4a373]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#e9c46a]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4f775d]" />
                </div>

                <span className="truncate font-mono text-[11px] text-[var(--moss)]">
                  {activeTab.routeLabel}
                </span>

                <button
                  type="button"
                  onClick={() => setLightboxIndex(activeIndex)}
                  aria-label="Ampliar captura de pantalla"
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--forest)] transition shrink-0"
                >
                  <Expand className="w-3 h-3" />
                  Ampliar
                </button>
              </div>

              <div className="relative bg-white overflow-hidden">
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
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-[var(--line)] bg-[#fbf7ee]">
                  <span className="text-[11px] text-[var(--moss)]">
                    Vista: {secondaryView ? activeTab.secondaryLabel : "Principal"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSecondaryView(false)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        !secondaryView
                          ? "bg-[var(--forest)] text-white"
                          : "text-[var(--moss)] hover:text-[var(--ink)]"
                      }`}
                    >
                      Principal
                    </button>
                    <button
                      type="button"
                      onClick={() => setSecondaryView(true)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        secondaryView
                          ? "bg-[var(--forest)] text-white"
                          : "text-[var(--moss)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {activeTab.secondaryLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div
              key={activeTab.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6 space-y-4 shadow-sm land-panel-enter"
            >
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--forest)] mb-1">
                  {activeTab.eyebrow}
                </p>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] leading-snug">
                  {activeTab.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--moss)] leading-relaxed">
                  {activeTab.description}
                </p>
              </div>

              <ul className="space-y-1.5 text-xs sm:text-sm text-[var(--ink)]">
                {activeTab.highlights.map((hl) => (
                  <li key={hl} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--forest)] shrink-0 mt-0.5" />
                    <span>{hl}</span>
                  </li>
                ))}
              </ul>

              <ShowcaseSimulation kind={activeTab.simulationKind} />
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-[var(--line)]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)]">
                Más pantallas del sistema
              </h3>
              <p className="text-xs sm:text-sm text-[var(--moss)]">
                Toca cualquier vista para abrirla en tamaño completo.
              </p>
            </div>
            <Link
              href="/login"
              className="text-xs font-semibold text-[var(--forest)] hover:underline shrink-0"
            >
              Probar en vivo →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {SHOWCASE_GALLERY.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLightboxIndex(SHOWCASE_TABS.length + idx)}
                className="group text-left rounded-xl border border-[var(--line)] bg-[var(--paper)] overflow-hidden hover:border-[var(--forest)] transition focus-visible:outline-2 focus-visible:outline-[var(--forest)]"
              >
                <div className="relative aspect-[16/10] bg-white overflow-hidden border-b border-[var(--line)]">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    width={640}
                    height={400}
                    loading="lazy"
                    className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <div className="p-3">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--moss)] block">
                    {item.moduleTag}
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-[var(--ink)] line-clamp-1 mt-0.5">
                    {item.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onCancel={() => setLightboxIndex(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setLightboxIndex(null);
        }}
        aria-label={activeLightbox?.title ?? "Vista ampliada de pantalla"}
        className="backdrop:bg-black/75 backdrop:backdrop-blur-xs bg-transparent p-0 m-auto max-w-5xl w-[94vw] rounded-2xl overflow-hidden shadow-2xl"
      >
        {activeLightbox && (
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--line)] bg-[#f4ede0]">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-[var(--moss)] truncate">
                  {activeLightbox.routeLabel}
                </p>
                <h4 className="font-display text-base sm:text-lg font-bold text-[var(--ink)] truncate">
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
                  className="p-1.5 rounded-lg border border-[var(--line)] bg-white hover:bg-[var(--cream)] text-[var(--ink)]"
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
                  className="p-1.5 rounded-lg border border-[var(--line)] bg-white hover:bg-[var(--cream)] text-[var(--ink)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Cerrar vista ampliada"
                  onClick={() => setLightboxIndex(null)}
                  className="p-1.5 rounded-lg border border-[var(--line)] bg-white hover:bg-[var(--cream)] text-[var(--ink)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white max-h-[72vh] overflow-auto">
              <Image
                src={activeLightbox.image}
                alt={activeLightbox.alt}
                width={1440}
                height={900}
                className="w-full h-auto block"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-[var(--line)] bg-[#f4ede0]">
              <p className="text-xs text-[var(--moss)]">{activeLightbox.subtitle}</p>
              <Link
                href="/login"
                onClick={() => setLightboxIndex(null)}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--forest)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--forest-deep)] shrink-0"
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

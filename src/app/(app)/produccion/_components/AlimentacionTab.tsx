"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, BookOpen, ClipboardList, Image as ImageIcon, Lightbulb, Package, Pencil, Search, ShoppingCart, Sparkles, TrendingDown, TrendingUp, Upload, X } from "lucide-react";
import { PageHeader, HeroActionButton, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard, Tooltip as FieldTooltip } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { useCatalog } from "@/lib/useCatalog";
import ContactField from "@/components/contacts/ContactField";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import FarmLocationSelect from "@/components/FarmLocationSelect";
import { useActionQuery } from "@/lib/useActionQuery";
import { syncManager } from "@/lib/offline/syncManager";
import { getCachedCatalog, setCachedCatalog, getCachedRecords, setCachedRecords } from "@/lib/offline/db";
import { recordFeedCaptureHabit } from "@/lib/form-habit-learner";
import {
  FEED_CATALOG_GROUPS,
  FEED_CURRENT_CATEGORIES,
  FEED_CURRENT_TYPES,
  currentFeedCategory,
  currentFeedType,
  feedTypeLabel,
  inferFeedCatalogGroup,
  isPurchasedFeedCategory,
  normalizeFeedCatalogGroup,
  normalizeFeedType,
} from "@/lib/feed-classification";
import { getStageSpecies, type FeedingSpecies } from "@/lib/feeding/stage-species";
import {
  STANDARD_FEED_CATALOG,
  STANDARD_FEED_GROUPS,
  findStandardFeedById,
  resolveEffectiveFeedProfile,
  searchStandardFeedCatalog,
  type StandardFeedItem,
} from "@/lib/feeding/standard-feed-catalog";
import {
  FEED_IMAGE_PRESETS,
  FEED_SPECIES_SELECTOR_OPTIONS,
  inferDefaultImageByFeed,
  inferDefaultSpeciesByFeed,
  normalizeFeedSpeciesList,
  normalizeRegionalNamesList,
} from "@/lib/feeding/feed-catalog-metadata";
import {
  suggestSafeSubstitutesForStandardId,
  validateFeedingProgram,
  type DietValidationResult,
} from "@/lib/feeding/nutrition-validator";
import { DietValidationSummary } from "@/app/(app)/produccion/_components/DietValidationSummary";
import {
  FeedCatalogExplorerModal,
  FeedFichaModal,
  SpeciesTagList,
  type FeedFichaRecord,
} from "@/components/feeding/FeedFichaModal";
import { FeedSearchPicker, compressFeedImageFile } from "@/components/feeding/FeedSearchPicker";
import MicroInsightCard from "@/components/MicroInsightCard";
import { buildFeedMicroInsight, type MicroInsightPayload } from "@/lib/micro-insights";

interface Feed {
  id: string;
  name: string;
  category: string;
  feedType: string;
  unit: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  supplier: string | null;
  dryMatterPct?: string | null;
  crudeProteinPct?: string | null;
  standardCatalogId?: string | null;
  catalogGroup?: string | null;
  sanitaryStatus?: string | null;
  energyKcalKgDm?: string | null;
  calciumDmPct?: string | null;
  availablePhosphorusDmPct?: string | null;
  lysineDigDmPct?: string | null;
  metCysDigDmPct?: string | null;
  crudeFiberDmPct?: string | null;
  nutritionProfile?: Record<string, unknown> | null;
  allowedSpecies?: string[] | null;
  imageUrl?: string | null;
  description?: string | null;
  regionalNames?: string[] | null;
}

interface FeedProgramEntry {
  id?: string;
  feedId: string;
  feedName?: string | null;
  feedUnit?: string | null;
  percentage: string;
  dailyAmountPerHen: string;
}

interface Stage {
  id: string;
  value: string;
  tipo?: string | null;
  minWeeks: number | null;
  maxWeeks: number | null;
  animalCount?: number;
  henCount: number;
  programs: FeedProgramEntry[];
  ration?: {
    totalGrams: number;
    dryMatterGrams: number;
    dryMatterComplete: boolean;
    crudeProteinPctAsFed: number | null;
    freshSharePct: number;
  };
  nutritionValidation?: DietValidationResult | null;
}

/** El porcentaje de cada alimento se deriva de sus gramos (lo calcula también el servidor). */
function derivedPercent(entries: { dailyAmountPerHen: string }[], index: number): string {
  const total = entries.reduce((sum, entry) => sum + (Number(entry.dailyAmountPerHen) || 0), 0);
  const grams = Number(entries[index]?.dailyAmountPerHen) || 0;
  return total > 0 ? ((grams / total) * 100).toFixed(2) : "0.00";
}

const speciesPresentation: Record<FeedingSpecies, { icon: string; singular: string; plural: string }> = {
  gallina: { icon: "hen", singular: "gallina", plural: "gallinas" },
  gallo: { icon: "rooster", singular: "gallo", plural: "gallos" },
  pollo: { icon: "rooster", singular: "pollo", plural: "pollos" },
  codorniz: { icon: "egg", singular: "codorniz", plural: "codornices" },
  pato: { icon: "duck", singular: "pato", plural: "patos" },
  conejo: { icon: "rabbit", singular: "conejo", plural: "conejos" },
  cuy: { icon: "rabbit", singular: "cuy", plural: "cuyes" },
};

interface Movement {
  id: string;
  feedId: string;
  feedName: string | null;
  feedUnit: string | null;
  quantity: string;
  isEntry: boolean;
  movementType: string;
  autoGenerated: boolean;
  stageCatalogoId: string | null;
  stageName: string | null;
  henCount: number | null;
  date: string;
  notes: string | null;
  locationId: string | null;
  locationName: string | null;
}

/** Acepta tanto un array plano como `{ items: [...] }` para no romper la vista. */
function normalizeFeedList(data: unknown): Feed[] {
  if (Array.isArray(data)) return data as Feed[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: Feed[] }).items;
  }
  return [];
}

// Motivos de movimiento clasificados por tipo (entrada / salida)
const movementTypeLabels: Record<string, string> = {
  compra: "Compra",
  donacion: "Donación",
  traslado: "Traslado",
  produccion_propia: "Producción propia",
  ajuste: "Ajuste",
  consumo_programa: "Consumo por programa",
  consumo_manual: "Consumo manual",
  venta: "Venta",
  uso_interno: "Uso interno",
  merma: "Merma",
  otro: "Otro",
};

const entryMovementTypes = ["compra", "donacion", "traslado", "produccion_propia", "ajuste", "otro"];
const exitMovementTypes = ["consumo_manual", "venta", "uso_interno", "merma", "traslado", "ajuste", "otro"];

interface ComparativoItem {
  feedId: string;
  feedName: string;
  plannedDaily: number;
  plannedTotal: number;
  actualTotal: number;
  entryTotal: number;
  variance: number;
  variancePercent: number;
  currentStock: number;
  costPerUnit: number;
}

interface DailyData {
  fecha: string;
  planned: Record<string, number>;
  actual: Record<string, number>;
}

interface DietPerformanceItem {
  species: string;
  activeAnimals: number;
  dailyFeedPerAnimalKg: number | null;
  feedCostPerKg: number | null;
  totalWeightGainKg: number;
  estimatedFeedKg: number;
  fcr: number | null;
  costPerKgGain: number | null;
}

interface PredictionItem {
  feedId: string;
  feedName: string;
  feedUnit: string;
  currentStockKg: number;
  dailyNeedKg: number;
  minStockKg: number;
  costPerUnit: number;
  daysRemaining: number | null;
  outOfStockDate: string | null;
  reorderDate: string | null;
  alertLevel: "ok" | "bajo" | "critico" | "agotado" | "sin_programa";
  expected7d: number;
  actual7d: number;
  suggestedOrderQty: number;
}

interface PredictionData {
  days: number;
  generatedAt: string;
  minimumStockCoverageDays?: number;
  minimumStockUpdatedCount?: number;
  summary: {
    totalFeeds: number;
    totalCurrentStockKg: number;
    totalDailyNeedKg: number;
    criticalCount: number;
    lowCount: number;
    outCount: number;
  };
  predictions: PredictionItem[];
}

const alertLabels: Record<string, string> = {
  ok: "OK",
  bajo: "Bajo",
  critico: "Crítico",
  agotado: "Agotado",
  sin_programa: "—",
};

const categoryLabels: Record<string, string> = {
  granja_fresco: "Granja Fresco",
  granja_procesado: "Granja Procesado",
  suplementario: "Suplementario",
  Concentrado: "Concentrado",
  "En Fresco": "En Fresco",
  Preparados: "Preparados",
};

const feedTypeLabels: Record<string, string> = {
  mosca_soldado: "Mosca Soldado Negro",
  pastos_gramineas: "Pastos y Gramíneas",
  maiz_germinado: "Maíz Germinado",
  bore_raices: "Bore / Raíces",
  purinas: "Purinas",
  maiz_comprado: "Maíz Comprado",
  concentrado_comercial: "Concentrado Aves",
  otro: "Otro",
  "Bore o Raices": "Bore o Raices",
  "Concentrado Aves": "Concentrado Aves",
  "Concentrado Pollo Engorde": "Concentrado Pollo Engorde",
  "Concentrado Codorniz": "Concentrado Codorniz",
  "Concentrado Patos": "Concentrado Patos",
  "Concentrado Conejos": "Concentrado Conejos",
  "Concentrado Cuyes": "Concentrado Cuyes",
  "Concentrado Multiespecie": "Concentrado Multiespecie",
  "Forraje Verde": "Forraje Verde",
  "Maiz en Grano": "Maiz en Grano",
  "Maíz Germinado": "Maíz Germinado",
  "Mosca Soldado": "Mosca Soldado",
  "Pastos y gramíneas": "Pastos y gramíneas",
  Purinas: "Purinas",
};

const categoryFallback = [...FEED_CURRENT_CATEGORIES];
const feedTypeFallback = [...FEED_CURRENT_TYPES];

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

export default function AlimentacionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTab = searchParams.get("subtab");
  const feedingTabs = ["inventario", "movimientos", "etapas", "comparativo", "prediccion"] as const;
  const tab = feedingTabs.includes(requestedTab as (typeof feedingTabs)[number]) ? requestedTab as (typeof feedingTabs)[number] : "inventario";
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [comparativo, setComparativo] = useState<ComparativoItem[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [dietPerformance, setDietPerformance] = useState<DietPerformanceItem[]>([]);
  const [comparativoDays, setComparativoDays] = useState<number>(14);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editing, setEditing] = useState<Feed | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [programEntries, setProgramEntries] = useState<FeedProgramEntry[]>([]);
  const [feedingReview, setFeedingReview] = useState<{ reviewed: boolean; reviewedAt: string | null } | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");
  const [aligningCatalog, setAligningCatalog] = useState(false);
  const [alignNotice, setAlignNotice] = useState("");

  // ─── Nuevo Plan de Alimentación Multiespecie ───
  const [newPlanModalOpen, setNewPlanModalOpen] = useState(false);
  const [selectedProgramSpeciesFilter, setSelectedProgramSpeciesFilter] = useState<string>("all");
  const [newPlanError, setNewPlanError] = useState("");
  const [programError, setProgramError] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogGroup, setCatalogGroup] = useState("all");
  const [catalogSpecies, setCatalogSpecies] = useState("all");
  const [newPlanForm, setNewPlanForm] = useState({
    species: "pollo",
    name: "",
    minWeeks: "0",
    maxWeeks: "7",
    entries: [{ feedId: "", percentage: "100", dailyAmountPerHen: "100" }],
  });
  const emptyFeedForm = {
    name: "",
    category: "En Fresco",
    feedType: "Pastos y gramíneas",
    catalogGroup: "Hojas y forrajes",
    unit: "kg",
    currentStock: "0",
    minStock: "0",
    costPerUnit: "0",
    supplier: "",
    dryMatterPct: "",
    crudeProteinPct: "",
    standardCatalogId: "",
    sanitaryStatus: "",
    energyKcalKgDm: "",
    calciumDmPct: "",
    availablePhosphorusDmPct: "",
    lysineDigDmPct: "",
    metCysDigDmPct: "",
    crudeFiberDmPct: "",
    allowedSpecies: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"] as FeedingSpecies[],
    imageUrl: "/images/alimentos/forrajes-hojas.svg",
    description: "",
    regionalNamesText: "",
  };
  const [form, setForm] = useState(emptyFeedForm);
  const [feedError, setFeedError] = useState("");
  const [feedImageError, setFeedImageError] = useState("");
  const [savingFeed, setSavingFeed] = useState(false);
  const [fichaFeed, setFichaFeed] = useState<FeedFichaRecord | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [movForm, setMovForm] = useState({ feedId: "", quantity: "", isEntry: true, movementType: "compra", stageCatalogoId: "", henCount: "", date: new Date().toISOString().split("T")[0], locationId: "", notes: "" });
  const [movementError, setMovementError] = useState("");
  const [lastInsight, setLastInsight] = useState<MicroInsightPayload | null>(null);
  const [prediccion, setPrediccion] = useState<PredictionData | null>(null);
  const [prediccionDays, setPrediccionDays] = useState<number>(14);
  const [feedSearch, setFeedSearch] = useState("");
  const [feedGroupFilter, setFeedGroupFilter] = useState("all");
  const [feedSpeciesFilter, setFeedSpeciesFilter] = useState("all");
  const [movementSearch, setMovementSearch] = useState("");
  const [comparativoSearch, setComparativoSearch] = useState("");
  const [predictionSearch, setPredictionSearch] = useState("");
  const { values: unitOptions } = useCatalog("unidad_medida", ["kg", "lb", "litros"]);
  const { values: categoryOptions } = useCatalog("categoria_alimento", categoryFallback);
  const { values: feedTypeOptions } = useCatalog("tipo_alimento", feedTypeFallback);
  const categorySelectOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const option of categoryOptions) {
      const value = currentFeedCategory(option);
      if (value && !labels.has(value)) labels.set(value, option);
    }
    return categoryFallback.map((value) => ({
      value,
      label: labels.get(value) || categoryLabels[value] || value,
    }));
  }, [categoryOptions]);
  const feedTypeSelectOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const option of feedTypeOptions) {
      const value = currentFeedType(option);
      if (value && !labels.has(value)) labels.set(value, option);
    }
    const options: { value: string; label: string }[] = feedTypeFallback.map((value) => ({
      value,
      label: labels.get(value) || feedTypeLabels[value] || value,
    }));
    const selectedValue = normalizeFeedType(form.feedType);
    if (selectedValue && !options.some((option) => option.value === selectedValue)) {
      options.push({ value: selectedValue, label: feedTypeLabel(selectedValue) });
    }
    return options;
  }, [feedTypeOptions, form.feedType]);

  const load = useCallback(() => {
    // 1. Cargar primero de caché local
    void Promise.all([
      getCachedCatalog<Feed[]>("feed_inventory"),
      getCachedRecords<Movement[]>("feed_movements"),
    ]).then(([cachedFeeds, cachedMovements]) => {
      if (cachedFeeds && Array.isArray(cachedFeeds) && cachedFeeds.length > 0) {
        setFeeds(normalizeFeedList(cachedFeeds));
      }
      if (cachedMovements && Array.isArray(cachedMovements) && cachedMovements.length > 0) {
        setMovements(cachedMovements);
      }
    });

    apiFetch("/api/produccion/alimentacion/prediccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: prediccionDays }),
    }).then((r) => r.json()).catch(() => null).then((pred) => Promise.all([
      apiFetch("/api/produccion/alimentacion").then((r) => r.json()),
      apiFetch("/api/produccion/alimentacion/movimientos").then((r) => r.json()),
      apiFetch("/api/produccion/etapas").then((r) => r.json()).catch(() => []),
      apiFetch(`/api/produccion/alimentacion/comparativo?days=${comparativoDays}`).then((r) => r.json()).catch(() => null),
      apiFetch("/api/dashboard/setup/feeding-review").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([f, m, s, comp, feedRev]) => {
      const normalizedF = normalizeFeedList(f);
      setFeeds(normalizedF);
      void setCachedCatalog("feed_inventory", normalizedF);

      const movList = Array.isArray(m) ? m : [];
      setMovements(movList);
      void setCachedRecords("feed_movements", movList);

      setStages(Array.isArray(s) ? s : []);
      setComparativo(comp?.comparativo || []);
      setDailyData(comp?.dailyData || []);
      setDietPerformance(Array.isArray(comp?.dietPerformance) ? comp.dietPerformance : []);
      if (feedRev && typeof feedRev.reviewed === "boolean") setFeedingReview(feedRev);
      if (pred) setPrediccion(pred);
    })).catch(() => {
      // Si falla la red, mantenemos los datos de IndexedDB
    }).finally(() => setLoading(false));
  }, [comparativoDays, prediccionDays]);

  useEffect(() => { load(); }, [load]);

  // Escuchar eventos de sincronización para actualizar movimientos
  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener("gallinero-sync-status", handler);
    return () => window.removeEventListener("gallinero-sync-status", handler);
  }, [load]);

  const confirmFeedingReview = async () => {
    setReviewSaving(true);
    setReviewNotice("");
    try {
      const res = await apiFetch("/api/dashboard/setup/feeding-review", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setReviewNotice(body?.error || "No se pudo confirmar la revisión de planes");
        return;
      }
      setFeedingReview(body);
    } finally {
      setReviewSaving(false);
    }
  };

  const seedDefaultPrograms = async () => {
    setSeedingDefaults(true);
    setReviewNotice("");
    try {
      const res = await apiFetch("/api/produccion/etapas/seed-defaults", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setReviewNotice(body?.error || "No se pudieron inicializar los planes base");
        return;
      }
      setReviewNotice(
        `Planes base aplicados: ${body?.createdFeeds ?? 0} alimentos, ${body?.createdStages ?? 0} etapas y ${body?.createdPrograms ?? 0} fórmulas.`,
      );
      load();
    } finally {
      setSeedingDefaults(false);
    }
  };

  const alignCatalog = async () => {
    setAligningCatalog(true);
    setAlignNotice("");
    try {
      const res = await apiFetch("/api/produccion/alimentacion/alinear-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedStarterCalciumAndRoot: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setAlignNotice(body?.error || "No se pudo alinear el inventario con el catálogo estándar");
        return;
      }
      setAlignNotice(
        `Inventario alineado: ${body?.updatedFeeds ?? 0} alimentos vinculados al catálogo (${body?.seededMissingStandards ?? 0} ingredientes base agregados) sin alterar existencias ni costos.`,
      );
      load();
    } finally {
      setAligningCatalog(false);
    }
  };

  const selectedStandardItem: StandardFeedItem | null = useMemo(
    () => findStandardFeedById(form.standardCatalogId),
    [form.standardCatalogId],
  );

  const filteredStandardCatalog = useMemo(
    () =>
      searchStandardFeedCatalog(catalogSearch, {
        group: catalogGroup,
        species: catalogSpecies,
        includeBlocked: true,
      }),
    [catalogSearch, catalogGroup, catalogSpecies],
  );

  const applyStandardFeed = (stdId: string) => {
    if (!stdId) {
      setForm((prev) => ({
        ...prev,
        standardCatalogId: "",
        sanitaryStatus: "",
      }));
      return;
    }
    const item = findStandardFeedById(stdId);
    if (!item) return;
    setForm((prev) => ({
      ...prev,
      standardCatalogId: item.id,
      catalogGroup: item.group,
      sanitaryStatus: item.sanitaryStatus,
      name: editing ? prev.name : item.name,
      category: item.defaultCategory,
      feedType: item.defaultFeedType,
      unit: prev.unit || item.defaultUnit,
      dryMatterPct: item.dryMatterPct !== null ? String(item.dryMatterPct) : "",
      crudeProteinPct: item.crudeProteinAsFedPct !== null ? String(item.crudeProteinAsFedPct) : "",
      energyKcalKgDm: item.energyKcalKgDm !== null ? String(item.energyKcalKgDm) : "",
      calciumDmPct: item.calciumDmPct !== null ? String(item.calciumDmPct) : "",
      availablePhosphorusDmPct: item.availablePhosphorusDmPct !== null ? String(item.availablePhosphorusDmPct) : "",
      lysineDigDmPct: item.lysineDigDmPct !== null ? String(item.lysineDigDmPct) : "",
      metCysDigDmPct: item.metCysDigDmPct !== null ? String(item.metCysDigDmPct) : "",
      crudeFiberDmPct: item.crudeFiberDmPct !== null ? String(item.crudeFiberDmPct) : "",
      allowedSpecies: item.targetSpecies,
      imageUrl: item.imageUrl,
      description: editing && prev.description ? prev.description : item.description,
      regionalNamesText: editing && prev.regionalNamesText ? prev.regionalNamesText : item.regionalNames.join(", "),
    }));
  };

  const openNewFeed = () => {
    setEditing(null);
    setFeedError("");
    setFeedImageError("");
    setCatalogSearch("");
    setCatalogGroup("all");
    setCatalogSpecies("all");
    setForm(emptyFeedForm);
    setModalOpen(true);
  };

  const openNewFeedFromStandard = (item: StandardFeedItem) => {
    setEditing(null);
    setFeedError("");
    setFeedImageError("");
    setCatalogSearch("");
    setCatalogGroup(item.group);
    setCatalogSpecies("all");
    setForm({
      ...emptyFeedForm,
      standardCatalogId: item.id,
      catalogGroup: item.group,
      sanitaryStatus: item.sanitaryStatus,
      name: item.name,
      category: item.defaultCategory,
      feedType: item.defaultFeedType,
      dryMatterPct: item.dryMatterPct !== null ? String(item.dryMatterPct) : "",
      crudeProteinPct: item.crudeProteinAsFedPct !== null ? String(item.crudeProteinAsFedPct) : "",
      energyKcalKgDm: item.energyKcalKgDm !== null ? String(item.energyKcalKgDm) : "",
      calciumDmPct: item.calciumDmPct !== null ? String(item.calciumDmPct) : "",
      availablePhosphorusDmPct: item.availablePhosphorusDmPct !== null ? String(item.availablePhosphorusDmPct) : "",
      lysineDigDmPct: item.lysineDigDmPct !== null ? String(item.lysineDigDmPct) : "",
      metCysDigDmPct: item.metCysDigDmPct !== null ? String(item.metCysDigDmPct) : "",
      crudeFiberDmPct: item.crudeFiberDmPct !== null ? String(item.crudeFiberDmPct) : "",
      allowedSpecies: item.targetSpecies,
      imageUrl: item.imageUrl,
      description: item.description,
      regionalNamesText: item.regionalNames.join(", "),
    });
    setModalOpen(true);
  };

  const openEditFeed = (f: Feed) => {
    const resolvedGroup =
      normalizeFeedCatalogGroup(f.catalogGroup) ??
      findStandardFeedById(f.standardCatalogId)?.group ??
      inferFeedCatalogGroup(f.feedType, f.name, f.category);
    const std = findStandardFeedById(f.standardCatalogId);
    const resolvedSpecies =
      normalizeFeedSpeciesList(f.allowedSpecies).length > 0
        ? normalizeFeedSpeciesList(f.allowedSpecies)
        : std?.targetSpecies ??
          inferDefaultSpeciesByFeed({
            standardCatalogId: f.standardCatalogId,
            group: resolvedGroup,
            feedType: f.feedType,
            name: f.name,
            sanitaryStatus: f.sanitaryStatus,
          });
    const resolvedRegional =
      normalizeRegionalNamesList(f.regionalNames).length > 0
        ? normalizeRegionalNamesList(f.regionalNames)
        : std?.regionalNames ?? [];

    setEditing(f);
    setFeedError("");
    setFeedImageError("");
    setCatalogSearch("");
    setCatalogGroup("all");
    setCatalogSpecies("all");
    setForm({
      name: f.name,
      category: currentFeedCategory(f.category) || f.category,
      feedType: currentFeedType(f.feedType) || f.feedType,
      catalogGroup: resolvedGroup,
      unit: f.unit,
      currentStock: f.currentStock,
      minStock: f.minStock,
      costPerUnit: f.costPerUnit,
      supplier: f.supplier || "",
      dryMatterPct: f.dryMatterPct ?? "",
      crudeProteinPct: f.crudeProteinPct ?? "",
      standardCatalogId: f.standardCatalogId ?? "",
      sanitaryStatus: f.sanitaryStatus ?? "",
      energyKcalKgDm: f.energyKcalKgDm ?? "",
      calciumDmPct: f.calciumDmPct ?? "",
      availablePhosphorusDmPct: f.availablePhosphorusDmPct ?? "",
      lysineDigDmPct: f.lysineDigDmPct ?? "",
      metCysDigDmPct: f.metCysDigDmPct ?? "",
      crudeFiberDmPct: f.crudeFiberDmPct ?? "",
      allowedSpecies: resolvedSpecies,
      imageUrl:
        f.imageUrl ||
        std?.imageUrl ||
        inferDefaultImageByFeed({
          standardCatalogId: f.standardCatalogId,
          group: resolvedGroup,
          feedType: f.feedType,
          name: f.name,
        }),
      description: f.description || std?.description || "",
      regionalNamesText: resolvedRegional.join(", "),
    });
    setModalOpen(true);
  };

  const toggleFormSpecies = (sp: FeedingSpecies) => {
    setForm((prev) => {
      const exists = prev.allowedSpecies.includes(sp);
      const next = exists
        ? prev.allowedSpecies.filter((s) => s !== sp)
        : [...prev.allowedSpecies, sp];
      return { ...prev, allowedSpecies: normalizeFeedSpeciesList(next) };
    });
  };

  const saveFeed = async () => {
    const method = editing ? "PUT" : "POST";
    const { regionalNamesText, ...restForm } = form;
    const payload = {
      ...restForm,
      regionalNames: normalizeRegionalNamesList(regionalNamesText),
    };
    const body = editing ? { ...payload, id: editing.id } : payload;
    setFeedError("");
    setSavingFeed(true);
    try {
      const response = await apiFetch("/api/produccion/alimentacion", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedError(result.error || "No se pudo guardar el alimento. Revisa los datos e inténtalo de nuevo.");
        return;
      }
      setModalOpen(false);
      load();
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "No se pudo guardar el alimento. Inténtalo de nuevo.");
    } finally {
      setSavingFeed(false);
    }
  };

  const removeFeed = async (id: string) => {
    if (!confirm("¿Eliminar este alimento y sus movimientos?")) return;
    await apiFetch(`/api/produccion/alimentacion?id=${id}`, { method: "DELETE" });
    load();
  };

  const openMovement = (entry = true) => {
    setMovForm({ feedId: feeds[0]?.id || "", quantity: "", isEntry: entry, movementType: entry ? "compra" : "consumo_manual", stageCatalogoId: "", henCount: "", date: new Date().toISOString().split("T")[0], locationId: "", notes: "" });
    setMovementError("");
    setMovModalOpen(true);
  };

  const saveMovement = async () => {
    setMovementError("");
    if (!movForm.isEntry && !movForm.locationId) return setMovementError("Selecciona el lugar al que se suministró el alimento");
    const payload: Record<string, unknown> = { ...movForm };
    delete payload.stageCatalogoId;
    delete payload.henCount;

    const selectedFeed = feeds.find((f) => f.id === movForm.feedId);
    const feedName = selectedFeed?.name || "alimento";
    const qtyNum = Number(movForm.quantity || 0);
    const priorStock = selectedFeed ? Number(selectedFeed.currentStock || 0) : null;
    const remainingStockAfter =
      priorStock !== null
        ? Math.max(0, movForm.isEntry ? priorStock + qtyNum : priorStock - qtyNum)
        : null;

    const result = await syncManager.executeMutation({
      endpoint: "/api/produccion/alimentacion/movimientos",
      method: "POST",
      entity: "alimentacion",
      description: `${movForm.isEntry ? "Entrada" : "Salida"} de ${movForm.quantity} ${selectedFeed?.unit || "kg"} de ${feedName}`,
      payload,
    });

    if (result.offline) {
      setMovModalOpen(false);

      const optimisticMov: Movement = {
        id: result.mutationId,
        feedId: movForm.feedId,
        feedName,
        feedUnit: selectedFeed?.unit || "kg",
        quantity: movForm.quantity,
        isEntry: movForm.isEntry,
        movementType: movForm.movementType,
        autoGenerated: false,
        stageCatalogoId: null,
        stageName: null,
        henCount: null,
        date: movForm.date,
        locationId: movForm.locationId || null,
        locationName: null,
        notes: movForm.notes ? `${movForm.notes} (Guardado en móvil)` : "Guardado en móvil",
      };

      setMovements((prev) => [optimisticMov, ...prev.filter((m) => m.id !== optimisticMov.id)]);
      setLastInsight(
        buildFeedMicroInsight({
          date: movForm.date,
          feedName,
          unit: selectedFeed?.unit || "kg",
          quantity: qtyNum,
          isEntry: movForm.isEntry,
          remainingStockAfter,
          unitCost: selectedFeed ? Number(selectedFeed.costPerUnit || 0) : null,
          activeAnimalsCount: totalAnimals > 0 ? totalAnimals : null,
          offline: true,
        }),
      );
      recordFeedCaptureHabit({
        locationId: movForm.locationId || "",
        feedId: movForm.feedId,
        quantity: qtyNum,
      });
      return;
    }

    if (!result.ok) {
      setMovementError(result.error || "No se pudo guardar el movimiento");
      return;
    }

    setMovModalOpen(false);
    setLastInsight(
      buildFeedMicroInsight({
        date: movForm.date,
        feedName,
        unit: selectedFeed?.unit || "kg",
        quantity: qtyNum,
        isEntry: movForm.isEntry,
        remainingStockAfter,
        unitCost: selectedFeed ? Number(selectedFeed.costPerUnit || 0) : null,
        activeAnimalsCount: totalAnimals > 0 ? totalAnimals : null,
        offline: false,
      }),
    );
    recordFeedCaptureHabit({
      locationId: movForm.locationId || "",
      feedId: movForm.feedId,
      quantity: qtyNum,
    });
    load();
  };

  // Programa alimenticio
  const openProgramEditor = (stage: Stage) => {
    setEditingStage(stage);
    setProgramError("");
    setProgramEntries(
      stage.programs.length > 0
        ? stage.programs.map((p) => ({ id: p.id, feedId: p.feedId, percentage: p.percentage, dailyAmountPerHen: p.dailyAmountPerHen }))
        : [{ feedId: feeds[0]?.id || "", percentage: "100", dailyAmountPerHen: "0" }]
    );
    setProgramModalOpen(true);
  };

  const addProgramEntry = () => {
    setProgramEntries([...programEntries, { feedId: feeds[0]?.id || "", percentage: "0", dailyAmountPerHen: "0" }]);
  };

  const removeProgramEntry = (idx: number) => {
    setProgramEntries(programEntries.filter((_, i) => i !== idx));
  };

  const updateProgramEntry = (idx: number, field: keyof FeedProgramEntry, value: string) => {
    const updated = [...programEntries];
    updated[idx] = { ...updated[idx], [field]: value };
    setProgramEntries(updated);
  };

  const buildValidationFromEntries = useCallback(
    (
      entries: Array<{ feedId: string; dailyAmountPerHen: string }>,
      species: FeedingSpecies,
      stageName: string,
      minWeeks: number,
      maxWeeks: number | null,
    ): DietValidationResult | null => {
      const valid = entries.filter((e) => e.feedId && Number(e.dailyAmountPerHen) > 0);
      if (valid.length === 0) return null;
      const lines = valid.map((entry) => {
        const feed = feeds.find((f) => f.id === entry.feedId);
        const resolved = resolveEffectiveFeedProfile({
          name: feed?.name,
          standardCatalogId: feed?.standardCatalogId,
          sanitaryStatus: feed?.sanitaryStatus,
          dryMatterPct: feed?.dryMatterPct,
          crudeProteinPct: feed?.crudeProteinPct,
          energyKcalKgDm: feed?.energyKcalKgDm,
          calciumDmPct: feed?.calciumDmPct,
          availablePhosphorusDmPct: feed?.availablePhosphorusDmPct,
          lysineDigDmPct: feed?.lysineDigDmPct,
          metCysDigDmPct: feed?.metCysDigDmPct,
          crudeFiberDmPct: feed?.crudeFiberDmPct,
          nutritionProfile: feed?.nutritionProfile ?? null,
        });
        return {
          grams: Number(entry.dailyAmountPerHen) || 0,
          dryMatterPct: resolved.dryMatterPct,
          crudeProteinPct: resolved.crudeProteinAsFedPct,
          category: feed?.category ?? null,
          energyKcalKgDm: resolved.energyKcalKgDm,
          calciumDmPct: resolved.calciumDmPct,
          availablePhosphorusDmPct: resolved.availablePhosphorusDmPct,
          lysineDigDmPct: resolved.lysineDigDmPct,
          metCysDigDmPct: resolved.metCysDigDmPct,
          crudeFiberDmPct: resolved.crudeFiberDmPct,
          sanitaryStatus: resolved.sanitaryStatus,
          standardCatalogId: resolved.standardCatalogId,
          feedName: feed?.name ?? null,
          allowedSpecies: resolved.allowedSpecies,
        };
      });
      return validateFeedingProgram({
        species,
        stageName,
        minWeeks,
        maxWeeks,
        lines,
        availableFeeds: feeds,
      });
    },
    [feeds],
  );

  const addRecommendedFeedToProgram = (feedId: string, suggestedGrams = 15) => {
    setProgramEntries((prev) => {
      const existingIdx = prev.findIndex((p) => p.feedId === feedId);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const nextGrams = (Number(copy[existingIdx].dailyAmountPerHen) || 0) + suggestedGrams;
        copy[existingIdx] = { ...copy[existingIdx], dailyAmountPerHen: String(nextGrams) };
        return copy;
      }
      return [...prev, { feedId, percentage: "0", dailyAmountPerHen: String(suggestedGrams) }];
    });
  };

  const addRecommendedFeedToNewPlan = (feedId: string, suggestedGrams = 15) => {
    setNewPlanForm((prev) => {
      const existingIdx = prev.entries.findIndex((p) => p.feedId === feedId);
      if (existingIdx >= 0) {
        const copy = [...prev.entries];
        const nextGrams = (Number(copy[existingIdx].dailyAmountPerHen) || 0) + suggestedGrams;
        copy[existingIdx] = { ...copy[existingIdx], dailyAmountPerHen: String(nextGrams) };
        return { ...prev, entries: copy };
      }
      return {
        ...prev,
        entries: [...prev.entries, { feedId, percentage: "0", dailyAmountPerHen: String(suggestedGrams) }],
      };
    });
  };

  const liveProgramValidation = useMemo(() => {
    if (!programModalOpen || !editingStage) return null;
    return buildValidationFromEntries(
      programEntries,
      getStageSpecies(editingStage),
      editingStage.value,
      editingStage.minWeeks ?? 0,
      editingStage.maxWeeks ?? null,
    );
  }, [programModalOpen, editingStage, programEntries, buildValidationFromEntries]);

  const liveNewPlanValidation = useMemo(() => {
    if (!newPlanModalOpen) return null;
    return buildValidationFromEntries(
      newPlanForm.entries,
      newPlanForm.species as FeedingSpecies,
      newPlanForm.name || newPlanForm.species,
      Number(newPlanForm.minWeeks) || 0,
      newPlanForm.maxWeeks ? Number(newPlanForm.maxWeeks) : null,
    );
  }, [newPlanModalOpen, newPlanForm, buildValidationFromEntries]);

  const saveProgram = async () => {
    if (!editingStage) return;
    setProgramError("");
    const res = await apiFetch(`/api/produccion/etapas/${editingStage.id}/programa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: programEntries.map(({ feedId, percentage, dailyAmountPerHen }) => ({ feedId, percentage, dailyAmountPerHen })) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setProgramError(err.error || "No se pudo guardar el programa de alimentación.");
      return;
    }
    setProgramModalOpen(false);
    load();
  };

  // ─── Lógica para Nuevo Plan / Programa ───
  const openNewPlanModal = () => {
    setNewPlanError("");
    setNewPlanForm({
      species: "pollo",
      name: "",
      minWeeks: "0",
      maxWeeks: "7",
      entries: [{ feedId: feeds[0]?.id || "", percentage: "100", dailyAmountPerHen: "100" }],
    });
    setNewPlanModalOpen(true);
  };

  const selectTab = (nextTab: (typeof feedingTabs)[number]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "alimentacion");
    params.set("subtab", nextTab);
    params.delete("nuevo");
    router.replace(`/produccion?${params.toString()}`, { scroll: false });
  };
  useActionQuery(searchParams.get("nuevo"), {
    alimento: () => {
      selectTab("inventario");
      setEditing(null);
      setFeedError("");
      setFeedImageError("");
      setCatalogSearch("");
      setCatalogGroup("all");
      setCatalogSpecies("all");
      setForm(emptyFeedForm);
      setModalOpen(true);
    },
    movimiento: () => {
      selectTab("movimientos");
      setMovForm({ feedId: "", quantity: "", isEntry: false, movementType: "consumo_manual", stageCatalogoId: "", henCount: "", date: new Date().toISOString().split("T")[0], locationId: "", notes: "" });
      setMovementError("");
      setMovModalOpen(true);
    },
    plan: () => {
      selectTab("etapas");
      setNewPlanError("");
      setNewPlanForm({ species: "pollo", name: "", minWeeks: "0", maxWeeks: "7", entries: [{ feedId: "", percentage: "100", dailyAmountPerHen: "100" }] });
      setNewPlanModalOpen(true);
    },
  });

  const addPlanEntry = () => {
    setNewPlanForm((prev) => ({
      ...prev,
      entries: [...prev.entries, { feedId: feeds[0]?.id || "", percentage: "0", dailyAmountPerHen: "0" }],
    }));
  };

  const removePlanEntry = (idx: number) => {
    setNewPlanForm((prev) => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== idx),
    }));
  };

  const updatePlanEntry = (idx: number, field: string, val: string) => {
    setNewPlanForm((prev) => {
      const copy = [...prev.entries];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, entries: copy };
    });
  };

  const saveNewPlan = async () => {
    setNewPlanError("");
    if (!newPlanForm.name.trim()) {
      setNewPlanError("El nombre del plan o etapa es requerido");
      return;
    }
    const validEntries = newPlanForm.entries.filter((e) => e.feedId && Number(e.dailyAmountPerHen) > 0);
    if (validEntries.length === 0) {
      setNewPlanError("Agrega al menos un alimento con dosis diaria mayor a 0");
      return;
    }

    const payload = {
      species: newPlanForm.species,
      value: newPlanForm.name.trim(),
      minWeeks: Number(newPlanForm.minWeeks) || 0,
      maxWeeks: newPlanForm.maxWeeks ? Number(newPlanForm.maxWeeks) : null,
      programs: validEntries,
    };

    const res = await apiFetch("/api/produccion/etapas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNewPlanError(data.error || "Error al crear el plan de alimentación");
      return;
    }

    setNewPlanModalOpen(false);
    load();
  };

  const lowStock = feeds.filter((f) => Number(f.currentStock) <= Number(f.minStock));
  const farmFeeds = feeds.filter((f) => !isPurchasedFeedCategory(f.category));
  const purchasedFeeds = feeds.filter((f) => isPurchasedFeedCategory(f.category));
  const unalignedFeeds = feeds.filter(
    (f) => !f.standardCatalogId || !f.dryMatterPct || !f.energyKcalKgDm || !f.calciumDmPct || !f.availablePhosphorusDmPct,
  );
  const totalAnimals = stages.reduce((sum, stage) => sum + Number(stage.animalCount ?? stage.henCount ?? 0), 0);

  const filteredFeeds = useMemo(() => {
    return feeds.filter((feed) => {
      const feedGroup =
        normalizeFeedCatalogGroup(feed.catalogGroup) ??
        findStandardFeedById(feed.standardCatalogId)?.group ??
        inferFeedCatalogGroup(feed.feedType, feed.name, feed.category);
      if (feedGroupFilter !== "all" && feedGroup !== feedGroupFilter) return false;
      const speciesList = normalizeFeedSpeciesList(feed.allowedSpecies);
      if (feedSpeciesFilter !== "all" && speciesList.length > 0 && !speciesList.includes(feedSpeciesFilter as FeedingSpecies)) {
        return false;
      }
      if (!feedSearch.trim()) return true;
      return matchesTextQuery(feedSearch, [
        feed.name,
        feedGroup,
        categoryLabels[feed.category] || feed.category,
        feedTypeLabels[feed.feedType] || feed.feedType,
        feed.currentStock,
        feed.minStock,
        feed.costPerUnit,
        feed.unit,
        feed.supplier,
        feed.standardCatalogId,
        feed.sanitaryStatus,
        feed.description,
        normalizeRegionalNamesList(feed.regionalNames).join(" "),
        speciesList.join(" "),
        Number(feed.currentStock) <= Number(feed.minStock) ? "stock bajo" : "",
      ]);
    });
  }, [feeds, feedSearch, feedGroupFilter, feedSpeciesFilter]);

  const filteredMovements = useMemo(() => {
    if (!movementSearch.trim()) return movements;
    return movements.filter((movement) =>
      matchesTextQuery(movementSearch, [
        movement.date,
        new Date(movement.date + "T12:00:00").toLocaleDateString("es"),
        movement.feedName,
        movement.locationName,
        movement.movementType,
        movementTypeLabels[movement.movementType] || movement.movementType,
        movement.isEntry ? "entrada" : movement.autoGenerated ? "consumo auto" : "salida",
        movement.stageName,
        movement.henCount,
        movement.quantity,
        movement.feedUnit,
        movement.notes,
      ]),
    );
  }, [movements, movementSearch]);

  const filteredComparativo = useMemo(() => {
    if (!comparativoSearch.trim()) return comparativo;
    return comparativo.filter((item) =>
      matchesTextQuery(comparativoSearch, [
        item.feedName,
        item.plannedDaily,
        item.plannedTotal,
        item.actualTotal,
        item.entryTotal,
        item.variance,
        item.variancePercent,
        item.currentStock,
        item.costPerUnit,
      ]),
    );
  }, [comparativo, comparativoSearch]);

  const filteredPredictions = useMemo(() => {
    const predictions = prediccion?.predictions ?? [];
    if (!predictionSearch.trim()) return predictions;
    return predictions.filter((item) =>
      matchesTextQuery(predictionSearch, [
        item.feedName,
        item.currentStockKg,
        item.dailyNeedKg,
        item.daysRemaining,
        item.outOfStockDate,
        item.reorderDate,
        item.suggestedOrderQty,
        item.alertLevel,
      ]),
    );
  }, [prediccion, predictionSearch]);

  // Totales diarios para una gráfica legible: una barra de planificado y otra de real.
  const dailyTotals = useMemo(
    () =>
      dailyData.map((day) => ({
        fecha: day.fecha,
        planificado:
          Math.round(
            Object.values(day.planned).reduce((sum, value) => sum + value, 0) * 100,
          ) / 100,
        real:
          Math.round(
            Object.values(day.actual).reduce((sum, value) => sum + value, 0) * 100,
          ) / 100,
      })),
    [dailyData],
  );

  // Días de stock restante por alimento: la lectura más directa para decidir compras.
  const stockDaysData = useMemo(
    () =>
      (prediccion?.predictions ?? [])
        .filter((item) => item.daysRemaining !== null)
        .sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0))
        .slice(0, 10)
        .map((item) => ({
          name: item.feedName,
          dias: item.daysRemaining ?? 0,
          alertLevel: item.alertLevel,
        })),
    [prediccion],
  );

  return (
    <div>
      <PageHeader
        theme="alimentacion"
        title="Gestión de Alimentación"
        description="Alimentos, movimientos, programas por etapa y predicción de consumo"
        help="Gestiona los alimentos de tus animales y su consumo.\n\n• Inventario: registra los alimentos que tienes (de granja o comprados), su stock y costo.\n• Movimientos: registra entradas (compras, donaciones) y salidas manuales. El consumo diario por programa se calcula automáticamente.\n• Etapas y Programas: define qué come cada grupo de animales según su etapa de crecimiento. El sistema calcula el consumo automático diario.\n• Planificado vs Real: compara lo que debieron comer vs lo que realmente consumieron.\n• Predicción de Stock: proyecta cuándo se agotará cada alimento según el consumo actual.\n\nLa proyección de stock y la comparación con lo esperado viven solo en sus pestañas, para no duplicar información."
        actions={
          <div className="flex flex-wrap gap-2">
            <HeroActionButton tone="glass" onClick={() => openMovement(true)}>
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              <span>Entrada</span>
            </HeroActionButton>
            <HeroActionButton tone="glass" onClick={() => openMovement(false)}>
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
              <span>Salida</span>
            </HeroActionButton>
            <HeroActionButton tone="solid" onClick={openNewFeed}>+ Nuevo Alimento</HeroActionButton>
          </div>
        }
      />

      {lastInsight && (
        <div className="mb-6">
          <MicroInsightCard
            insight={lastInsight}
            onAnother={() => openMovement(false)}
            onDismiss={() => setLastInsight(null)}
            doneLabel="Entendido"
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4 mb-6">
        <StatCard icon="sprout" label="Alimentos de Granja" value={farmFeeds.length} color="green" />
        <StatCard icon="cart" label="Suplementarios" value={purchasedFeeds.length} color="blue" />
        <StatCard icon="warning" label="Stock Bajo" value={lowStock.length} color={lowStock.length > 0 ? "red" : "green"} />
        <StatCard icon="package" label="Movimientos" value={movements.length} color="purple" />
        <StatCard icon="paw" label="Animales en Programas" value={totalAnimals} color="green" />
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Alertas de Stock Bajo</span>
          </h3>
          <div className="space-y-1">
            {lowStock.map((f) => (
              <p key={f.id} className="text-sm text-red-600">
                <strong>{f.name}</strong> — Stock: {f.currentStock} {f.unit} (mínimo: {f.minStock} {f.unit})
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => selectTab("inventario")} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${tab === "inventario" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          <ClipboardList className="w-4 h-4" aria-hidden="true" />
          <span>Inventario</span>
        </button>
        <button onClick={() => selectTab("movimientos")} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${tab === "movimientos" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          <Package className="w-4 h-4" aria-hidden="true" />
          <span>Movimientos</span>
        </button>
        <button onClick={() => selectTab("etapas")} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${tab === "etapas" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
          <span>Etapas y Programas</span>
        </button>
        <button onClick={() => selectTab("comparativo")} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${tab === "comparativo" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
          <span>Planificado vs Real</span>
        </button>
        <button onClick={() => selectTab("prediccion")} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${tab === "prediccion" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>Predicción de Stock</span>
        </button>
      </div>

      {/* Tab: Inventario */}
      {tab === "inventario" && (
        <Card>
          {!loading && (unalignedFeeds.length > 0 || alignNotice) && (
            <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                  {unalignedFeeds.length > 0
                    ? `${unalignedFeeds.length} alimento(s) del inventario sin ficha nutricional completa o código estándar`
                    : "Inventario alineado con el catálogo estándar"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--iw-semantic-text-secondary)]">
                  {alignNotice ||
                    "Vincula cada alimento existente con su código IG-xxx (MS, PB, EM, Ca, P, Fibra) para evaluar todas las dietas sin alterar stock, costos ni movimientos."}
                </p>
              </div>
              {unalignedFeeds.length > 0 && (
                <Button
                  onClick={alignCatalog}
                  disabled={aligningCatalog || loading}
                  className="shrink-0"
                >
                  {aligningCatalog ? "Alineando..." : "Alinear inventario con catálogo estándar"}
                </Button>
              )}
            </div>
          )}
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <form
                onSubmit={(e) => e.preventDefault()}
                className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <label htmlFor="feed-inventory-search" className="block text-xs font-semibold text-[var(--iw-semantic-text-secondary)] mb-1">
                    Búsqueda directa de alimentos
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
                    <input
                      id="feed-inventory-search"
                      type="search"
                      value={feedSearch}
                      onChange={(e) => setFeedSearch(e.target.value)}
                      placeholder="Buscar por nombre, sinónimo regional (cuido, zapallo, chonque), IG o animal..."
                      className="min-h-[42px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] py-2 pl-9 pr-9 text-sm text-[var(--iw-semantic-text-primary)] outline-none focus:border-[var(--iw-semantic-focus-ring)]"
                    />
                    {feedSearch && (
                      <button
                        type="button"
                        onClick={() => setFeedSearch("")}
                        aria-label="Limpiar búsqueda de alimentos"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--iw-semantic-text-secondary)]"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                <Button type="submit" className="min-h-[42px] shrink-0">
                  <Search className="mr-1.5 w-4 h-4" aria-hidden="true" />
                  Buscar alimento
                </Button>
              </form>

              <div className="flex flex-wrap items-end gap-2 shrink-0">
                <div className="w-full sm:w-56">
                  <Select
                    label="Grupo catálogo (CSV)"
                    value={feedGroupFilter}
                    onChange={(e) => setFeedGroupFilter(e.target.value)}
                  >
                    <option value="all">Todos los grupos ({FEED_CATALOG_GROUPS.length})</option>
                    {FEED_CATALOG_GROUPS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setExplorerOpen(true)}
                  className="min-h-[42px] shrink-0"
                >
                  <BookOpen className="mr-1.5 w-4 h-4" aria-hidden="true" />
                  Explorar fichas
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFeedSpeciesFilter("all")}
                className={`min-h-[34px] rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  feedSpeciesFilter === "all"
                    ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                    : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
                }`}
              >
                Todos los animales
              </button>
              {FEED_SPECIES_SELECTOR_OPTIONS.map((sp) => (
                <button
                  key={sp.value}
                  type="button"
                  onClick={() => setFeedSpeciesFilter(sp.value)}
                  className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    feedSpeciesFilter === sp.value
                      ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                      : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
                  }`}
                >
                  <AppIcon
                    icon={
                      sp.value === "gallina"
                        ? "hen"
                        : sp.value === "codorniz"
                          ? "egg"
                          : sp.value === "pato"
                            ? "duck"
                            : sp.value === "conejo" || sp.value === "cuy"
                              ? "rabbit"
                              : "rooster"
                    }
                    className="w-3.5 h-3.5"
                  />
                  <span>{sp.shortLabel}</span>
                </button>
              ))}
              {(feedSearch.trim() || feedGroupFilter !== "all" || feedSpeciesFilter !== "all") && (
                <span className="ml-auto text-xs text-[var(--iw-semantic-text-secondary)] tabular-nums">
                  {filteredFeeds.length} de {feeds.length} alimentos
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <p className="text-center py-8 text-slate-400">Cargando...</p>
          ) : filteredFeeds.length === 0 ? (
            <EmptyState
              icon="wheat"
              message={
                feedSearch.trim() || feedSpeciesFilter !== "all" || feedGroupFilter !== "all"
                  ? "No hay alimentos que coincidan con la búsqueda"
                  : "No hay alimentos registrados"
              }
            />
          ) : (
            <Table headers={["Alimento y ficha", "Para qué animales", "Categoría", "Grupo / Tipo", "Stock", "Mín.", "Costo/Unidad", "Proveedor", "Acciones"]}>
              {filteredFeeds.map((f) => {
                const missingProfile =
                  !f.dryMatterPct || !f.energyKcalKgDm || !f.calciumDmPct || !f.availablePhosphorusDmPct;
                const feedGroup =
                  normalizeFeedCatalogGroup(f.catalogGroup) ??
                  findStandardFeedById(f.standardCatalogId)?.group ??
                  inferFeedCatalogGroup(f.feedType, f.name, f.category);
                const thumb =
                  f.imageUrl ||
                  inferDefaultImageByFeed({
                    standardCatalogId: f.standardCatalogId,
                    group: feedGroup,
                    feedType: f.feedType,
                    name: f.name,
                  });
                const regional = normalizeRegionalNamesList(f.regionalNames);
                return (
                  <tr key={f.id} className={`hover:bg-slate-50 ${Number(f.currentStock) <= Number(f.minStock) ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => setFichaFeed(f)}
                          aria-label={`Explorar ficha de ${f.name}`}
                          className="shrink-0 overflow-hidden rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb} alt={f.name} className="h-11 w-14 object-cover" />
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setFichaFeed(f)}
                            className="text-left font-semibold text-[var(--iw-semantic-text-primary)] hover:text-[var(--iw-semantic-action-primary)] hover:underline"
                          >
                            {f.name}
                          </button>
                          {regional.length > 0 && (
                            <p className="mt-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
                              También: {regional.slice(0, 3).join(", ")}
                            </p>
                          )}
                          {f.description && (
                            <p className="mt-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)] line-clamp-1 max-w-xs">
                              {f.description}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {f.standardCatalogId && (
                              <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--iw-semantic-text-secondary)]">
                                {f.standardCatalogId}
                              </span>
                            )}
                            {f.sanitaryStatus === "NO USAR" && (
                              <span className="rounded border border-[var(--iw-semantic-status-danger)]/45 bg-[var(--iw-semantic-bg-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--iw-semantic-status-danger)]">
                                NO USAR
                              </span>
                            )}
                            {f.sanitaryStatus === "RESTRINGIDO" && (
                              <span className="rounded border border-[var(--iw-semantic-status-warning)]/40 bg-[var(--iw-color-paper)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--iw-semantic-status-warning)]">
                                RESTRINGIDO
                              </span>
                            )}
                            {missingProfile && (
                              <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-page)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--iw-semantic-text-secondary)]">
                                Falta ficha MS/EM/Ca
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SpeciesTagList species={f.allowedSpecies} compact />
                    </td>
                    <td className="px-4 py-3 text-sm">{categoryLabels[f.category] || f.category}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-[var(--iw-semantic-text-primary)]">{feedGroup}</div>
                      <div className="text-xs text-[var(--iw-semantic-text-secondary)]">{feedTypeLabels[f.feedType] || f.feedType}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{f.currentStock} {f.unit}</td>
                    <td className="px-4 py-3 text-sm">{f.minStock} {f.unit}</td>
                    <td className="px-4 py-3">{f.costPerUnit != null ? `$${f.costPerUnit}` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{f.supplier || "Producción propia"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setFichaFeed(f)} className="text-[var(--iw-semantic-action-primary)] hover:underline text-xs font-semibold">Ver ficha</button>
                        <button type="button" onClick={() => openEditFeed(f)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button type="button" onClick={() => removeFeed(f.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* Tab: Movimientos */}
      {tab === "movimientos" && (
        <Card>
          <TableSearch
            value={movementSearch}
            onChange={setMovementSearch}
            placeholder="Buscar por fecha, alimento, motivo o etapa..."
            resultCount={filteredMovements.length}
            totalCount={movements.length}
            className="mb-4"
          />
          {filteredMovements.length === 0 ? (
            <EmptyState
              icon="package"
              message={
                movementSearch.trim()
                  ? "No hay movimientos que coincidan con la búsqueda"
                  : "No hay movimientos registrados"
              }
            />
          ) : (
            <Table headers={["Fecha", "Lugar", "Alimento", "Tipo", "Motivo", "Etapa", "Gallinas", "Cantidad", "Notas"]}>
              {filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{new Date(m.date + "T12:00:00").toLocaleDateString("es")}</td>
                  <td className="px-4 py-3 text-sm">{m.locationName || "Sin lugar asignado"}</td>
                  <td className="px-4 py-3 font-medium">{m.feedName || "—"}</td>
                  <td className="px-4 py-3">
                    {m.isEntry ? (
                      <Badge color="green">Entrada</Badge>
                    ) : m.autoGenerated ? (
                      <Badge color="blue">Consumo auto</Badge>
                    ) : (
                      <Badge color="red">Salida</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.movementType ? <Badge color="gray">{movementTypeLabels[m.movementType] || m.movementType}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {m.stageName ? <Badge color={stageColors[m.stageName] || "gray"}>{m.stageName}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{m.henCount ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{m.quantity} {m.feedUnit || ""}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.notes || "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* Tab: Etapas y Programas de Alimentación Multiespecie */}
      {tab === "etapas" && (
        <div className="space-y-4">
          <Card className={feedingReview?.reviewed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className={`font-semibold ${feedingReview?.reviewed ? "text-green-800" : "text-amber-900"}`}>
                  {feedingReview?.reviewed
                    ? "Planes de alimentación iniciales validados"
                    : "Valida los planes de alimentación iniciales"}
                </h3>
                <p className={`mt-1 text-sm ${feedingReview?.reviewed ? "text-green-700" : "text-amber-800"}`}>
                  {feedingReview?.reviewed
                    ? `Revisión confirmada${feedingReview.reviewedAt ? ` el ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(feedingReview.reviewedAt))}` : ""}. Puedes seguir ajustando raciones y proporciones cuando lo necesites.`
                    : "Revisa las dietas mixtas precargadas por especie y etapa (concentrado, forrajes y suplementos) antes de confirmar este paso de arranque."}
                </p>
                {reviewNotice && <p className="mt-2 text-xs font-medium text-slate-700">{reviewNotice}</p>}
                {alignNotice && <p className="mt-2 text-xs font-medium text-[var(--iw-semantic-text-primary)]">{alignNotice}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {unalignedFeeds.length > 0 && (
                  <Button variant="secondary" onClick={alignCatalog} disabled={aligningCatalog || loading}>
                    {aligningCatalog ? "Alineando..." : `Alinear ${unalignedFeeds.length} alimento(s) al catálogo`}
                  </Button>
                )}
                {(stages.length === 0 || !stages.some((s) => s.programs.length > 0)) && (
                  <Button variant="secondary" onClick={seedDefaultPrograms} disabled={seedingDefaults || loading}>
                    {seedingDefaults ? "Inicializando..." : "Inicializar planes base"}
                  </Button>
                )}
                {!feedingReview?.reviewed && (
                  <Button
                    onClick={confirmFeedingReview}
                    disabled={reviewSaving || loading || stages.length === 0 || !stages.some((s) => s.programs.length > 0)}
                  >
                    {reviewSaving ? "Guardando..." : "Validar planes iniciales"}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "Todos los Planes", icon: "globe" },
                { id: "gallina", label: "Gallinas", icon: "hen" },
                { id: "gallo", label: "Gallos", icon: "rooster" },
                { id: "pollo", label: "Pollos", icon: "rooster" },
                { id: "codorniz", label: "Codornices", icon: "egg" },
                { id: "pato", label: "Patos", icon: "duck" },
                { id: "conejo", label: "Conejos", icon: "rabbit" },
                { id: "cuy", label: "Cuyes", icon: "rabbit" },
              ].map((sp) => {
                const isSelected = selectedProgramSpeciesFilter === sp.id;
                return (
                  <button
                    key={sp.id}
                    onClick={() => setSelectedProgramSpeciesFilter(sp.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    <AppIcon icon={sp.icon} className="w-3.5 h-3.5" />
                    <span>{sp.label}</span>
                  </button>
                );
              })}
            </div>

            <Button onClick={openNewPlanModal}>+ Nuevo Plan de Alimentación</Button>
          </div>

          {(selectedProgramSpeciesFilter === "all" || selectedProgramSpeciesFilter === "conejo" || selectedProgramSpeciesFilter === "cuy") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Protocolo de Forraje Oreado (12–24 horas)</span>
                </p>
                <p className="mt-1">En conejos y cuyes, orear el pasto/alfalfa antes del suministro para reducir humedad excesiva y prevenir timpanismo o meteorismo digestivo.</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Vitamina C Obligatoria en Cuyes (25 mg/animal/día)</span>
                </p>
                <p className="mt-1">Los cobayos no sintetizan ácido ascórbico: garantiza aporte diario en agua limpia, forraje fresco o premezcla estable (~25 mg/cuy/día).</p>
              </div>
            </div>
          )}

          {stages.length === 0 ? (
            <Card>
              <EmptyState icon="bar-chart" message="No hay etapas o planes de alimentación definidos" />
            </Card>
          ) : (
            stages
              .filter((stage) => {
                if (selectedProgramSpeciesFilter === "all") return true;
                return getStageSpecies(stage) === selectedProgramSpeciesFilter;
              })
              .map((stage) => {
                const totalPercentage = stage.programs.reduce((s, p) => s + Number(p.percentage), 0);
                const totalGrams = stage.programs.reduce((s, p) => s + Number(p.dailyAmountPerHen), 0);
                const animalCount = Number(stage.animalCount ?? stage.henCount ?? 0);
                const species = speciesPresentation[getStageSpecies(stage)];
                const totalDailyKg = (animalCount * totalGrams / 1000).toFixed(1);

                return (
                  <Card key={stage.id}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge color={stageColors[stage.value] || "green"}>
                          <span className="inline-flex items-center gap-1">
                            <AppIcon icon={species.icon} className="w-3.5 h-3.5" />
                            <span>{stage.value}</span>
                          </span>
                        </Badge>
                        <span className="text-sm text-slate-500">
                          {stage.minWeeks}–{stage.maxWeeks ? `${stage.maxWeeks} sem` : "+ sem"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <AppIcon icon={species.icon} className="w-4 h-4 text-slate-600" />
                          <span>{animalCount} {animalCount === 1 ? species.singular : species.plural}</span>
                        </span>
                      </div>
                      <Button onClick={() => openProgramEditor(stage)}>
                        <span className="inline-flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Editar Dieta</span>
                        </span>
                      </Button>
                    </div>

                    {stage.programs.length === 0 ? (
                      <p className="text-sm text-slate-400 py-2">Sin programa alimenticio definido</p>
                    ) : (
                      <div>
                        <Table headers={["Alimento / Ingrediente", "% Dieta", `g/${species.singular}/día`, animalCount > 0 ? `Total/día (${animalCount} animales)` : "Dosis unitaria"]}>
                          {stage.programs.map((p) => (
                            <tr key={p.id || p.feedId} className="hover:bg-slate-50">
                              <td className="px-4 py-2 font-medium">{p.feedName || "—"}</td>
                              <td className="px-4 py-2">{p.percentage}%</td>
                              <td className="px-4 py-2 font-semibold text-slate-800">{p.dailyAmountPerHen} g</td>
                              <td className="px-4 py-2">
                                {animalCount > 0 ? (
                                  <span className="font-semibold">{((Number(p.dailyAmountPerHen) * animalCount) / 1000).toFixed(2)} kg</span>
                                ) : (
                                  <span className="text-slate-400">{p.dailyAmountPerHen} g/cabeza</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t font-semibold bg-slate-50">
                            <td className="px-4 py-2">TOTAL</td>
                            <td className="px-4 py-2">{totalPercentage}%</td>
                            <td className="px-4 py-2">{totalGrams} g</td>
                            <td className="px-4 py-2">
                              {animalCount > 0 ? `${totalDailyKg} kg` : `${totalGrams} g/animal`}
                            </td>
                          </tr>
                        </Table>
                        {stage.ration && stage.ration.totalGrams > 0 && (
                          <p className="mt-2 text-xs text-[var(--iw-semantic-text-secondary)]">
                            Forraje fresco {stage.ration.freshSharePct}% de la ración
                            {stage.ration.dryMatterComplete ? ` · materia seca ${stage.ration.dryMatterGrams} g/animal/día` : " · agrega la materia seca de los alimentos para ver la ración en base seca"}
                            {stage.ration.crudeProteinPctAsFed !== null ? ` · proteína ${stage.ration.crudeProteinPctAsFed}% tal cual` : ""}
                          </p>
                        )}
                        {stage.nutritionValidation && (
                          <DietValidationSummary validation={stage.nutritionValidation} />
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
          )}

          <Card className="border-blue-200 bg-blue-50">
            <div className="flex flex-col gap-2 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <strong>La proyección de stock y el consumo esperado no se repiten aquí.</strong>{" "}
                Consulta los días restantes en Predicción de Stock y la comparación con lo real en Planificado vs Real.
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => selectTab("prediccion")}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Predicción de Stock
                </button>
                <button
                  onClick={() => selectTab("comparativo")}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Planificado vs Real
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Comparativo */}
      {tab === "comparativo" && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span>Consumo Planificado vs Real</span>
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Período:</label>
                <select
                  value={comparativoDays}
                  onChange={(e) => setComparativoDays(Number(e.target.value))}
                  className="border rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <option value={7}>7 días</option>
                  <option value={14}>14 días</option>
                  <option value={21}>21 días</option>
                  <option value={30}>30 días</option>
                </select>
              </div>
            </div>

            {comparativo.length === 0 ? (
              <EmptyState icon="trend-up" message="No hay datos de comparativo disponibles" />
            ) : (
              <>
                <TableSearch
                  value={comparativoSearch}
                  onChange={setComparativoSearch}
                  placeholder="Buscar por alimento..."
                  resultCount={filteredComparativo.length}
                  totalCount={comparativo.length}
                  className="mb-4"
                />
                {filteredComparativo.length === 0 ? (
                  <EmptyState
                    icon="trend-up"
                    message={
                      comparativoSearch.trim()
                        ? "No hay alimentos que coincidan con la búsqueda"
                        : "No hay datos de comparativo disponibles"
                    }
                  />
                ) : (
                  <Table headers={["Alimento", "Planificado/día", `Planificado (${comparativoDays}d)`, `Real (${comparativoDays}d)`, "Entradas", "Diferencia", "%", "Stock", "Costo/kg"]}>
                    {filteredComparativo.map((item) => {
                      const isOver = item.variance > 0;
                      const isUnder = item.variance < 0;
                      return (
                        <tr key={item.feedId} className={`hover:bg-slate-50 ${isUnder ? "bg-orange-50" : isOver ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-2 font-medium">{item.feedName}</td>
                          <td className="px-4 py-2">{item.plannedDaily} kg</td>
                          <td className="px-4 py-2">{item.plannedTotal} kg</td>
                          <td className="px-4 py-2 font-semibold">{item.actualTotal} kg</td>
                          <td className="px-4 py-2 text-green-600">{item.entryTotal} kg</td>
                          <td className="px-4 py-2">
                            <span className={`font-bold ${isUnder ? "text-orange-600" : isOver ? "text-blue-600" : "text-slate-500"}`}>
                              {item.variance > 0 ? "+" : ""}{item.variance} kg
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-sm font-semibold ${item.variancePercent > 10 ? "text-red-600" : item.variancePercent < -10 ? "text-orange-600" : "text-green-600"}`}>
                              {item.variancePercent > 0 ? "+" : ""}{item.variancePercent}%
                            </span>
                          </td>
                          <td className="px-4 py-2">{item.currentStock} kg</td>
                          <td className="px-4 py-2">${item.costPerUnit.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </Table>
                )}
              </>
            )}
          </Card>

          {/* Chart: Daily totals planned vs actual */}
          {dailyTotals.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span>Consumo diario total: Planificado vs Real</span>
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Suma de todos los alimentos por día. El detalle por alimento está en la tabla.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" fontSize={11} />
                  <YAxis fontSize={11} label={{ value: "kg", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="planificado" name="Planificado" fill="var(--iw-color-info)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="real" name="Real" fill="var(--iw-color-forest)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Summary stats */}
          {comparativo.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <p className="text-sm text-slate-500">Total Planificado</p>
                <p className="text-2xl font-bold text-blue-600">{comparativo.reduce((s, c) => s + c.plannedTotal, 0).toFixed(1)} kg</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Total Consumido</p>
                <p className="text-2xl font-bold text-green-600">{comparativo.reduce((s, c) => s + c.actualTotal, 0).toFixed(1)} kg</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Total Entradas (Compras)</p>
                <p className="text-2xl font-bold text-purple-600">{comparativo.reduce((s, c) => s + c.entryTotal, 0).toFixed(1)} kg</p>
              </Card>
            </div>
          )}

          {dietPerformance.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Comparativo de Rendimiento del Alimento (Comida por Kilo Ganado)</span>
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Evalúa qué mezcla y especie necesita menos alimento para producir 1 kilo de peso vivo (conversión) y cuánto cuesta cada kilo ganado.
              </p>
              <Table headers={["Especie", "Animales activos", "Ración/día", "Costo dieta/kg", "Ganancia peso", "Alimento est.", "Comida/kg (FCR)", "Costo / kg ganado"]}>
                {dietPerformance.map((row) => (
                  <tr key={row.species} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-semibold capitalize">{speciesPresentation[row.species as FeedingSpecies]?.plural || row.species}</td>
                    <td className="px-4 py-2">{row.activeAnimals}</td>
                    <td className="px-4 py-2">{row.dailyFeedPerAnimalKg != null ? `${(row.dailyFeedPerAnimalKg * 1000).toFixed(0)} g` : "—"}</td>
                    <td className="px-4 py-2">{row.feedCostPerKg != null ? `$${row.feedCostPerKg.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-2">{row.totalWeightGainKg} kg</td>
                    <td className="px-4 py-2">{row.estimatedFeedKg} kg</td>
                    <td className="px-4 py-2 font-bold">
                      {row.fcr != null ? <Badge color={row.fcr <= 2.2 ? "green" : row.fcr <= 3.2 ? "blue" : "orange"}>{row.fcr}:1</Badge> : "—"}
                    </td>
                    <td className="px-4 py-2 font-semibold text-emerald-700">
                      {row.costPerKgGain != null ? `$${row.costPerKgGain.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Predicción de Stock */}
      {tab === "prediccion" && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span>Proyección de Stock (consumo automático por etapa)</span>
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Horizonte:</label>
                <select
                  value={prediccionDays}
                  onChange={(e) => setPrediccionDays(Number(e.target.value))}
                  className="border rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <option value={14}>14 días</option>
                  <option value={30}>30 días</option>
                  <option value={60}>60 días</option>
                  <option value={90}>90 días</option>
                  <option value={180}>180 días</option>
                  <option value={365}>365 días</option>
                </select>
              </div>
            </div>

            {!prediccion || prediccion.predictions.length === 0 ? (
              <EmptyState icon="sparkles" message="No hay consumo previsto. Registra animales y programas de alimentación para calcular la predicción y el stock mínimo." />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <Card>
                    <p className="text-sm text-slate-500">Stock Total</p>
                    <p className="text-2xl font-bold text-blue-600">{prediccion.summary.totalCurrentStockKg} kg</p>
                  </Card>
                  <Card>
                    <p className="text-sm text-slate-500">Consumo Diario</p>
                    <p className="text-2xl font-bold text-green-600">{prediccion.summary.totalDailyNeedKg} kg</p>
                  </Card>
                  <Card>
                    <p className="text-sm text-slate-500">Alertas Críticas</p>
                    <p className={`text-2xl font-bold ${prediccion.summary.criticalCount > 0 ? "text-red-600" : "text-slate-600"}`}>{prediccion.summary.criticalCount}</p>
                  </Card>
                  <Card>
                    <p className="text-sm text-slate-500">Stock Bajo</p>
                    <p className={`text-2xl font-bold ${prediccion.summary.lowCount > 0 ? "text-yellow-600" : "text-slate-600"}`}>{prediccion.summary.lowCount}</p>
                  </Card>
                </div>

                <TableSearch
                  value={predictionSearch}
                  onChange={setPredictionSearch}
                  placeholder="Buscar por alimento o nivel de alerta..."
                  resultCount={filteredPredictions.length}
                  totalCount={prediccion.predictions.length}
                  className="mb-4"
                />
                {filteredPredictions.length === 0 ? (
                  <EmptyState
                    icon="sparkles"
                    message={
                      predictionSearch.trim()
                        ? "No hay alimentos que coincidan con la búsqueda"
                        : "Sin predicciones disponibles"
                    }
                  />
                ) : (
                  <Table headers={["Alimento", "Stock Actual", "Consumo/día", "Se agota en", "Reponer antes de", "Compra sugerida", "Alerta"]}>
                    {filteredPredictions.map((item) => (
                      <tr key={item.feedId} className={item.alertLevel === "critico" ? "bg-red-50" : item.alertLevel === "bajo" ? "bg-yellow-50" : "hover:bg-slate-50"}>
                        <td className="px-4 py-2 font-medium">{item.feedName}</td>
                        <td className="px-4 py-2">{item.currentStockKg} kg</td>
                        <td className="px-4 py-2">{item.dailyNeedKg} kg/día</td>
                        <td className="px-4 py-2">
                          <span className={`font-bold ${item.alertLevel === "critico" ? "text-red-600" : item.alertLevel === "bajo" ? "text-yellow-700" : "text-slate-700"}`}>
                            {item.daysRemaining !== null ? `${item.daysRemaining} días` : "—"}
                          </span>
                          {item.outOfStockDate && <span className="block text-xs text-slate-500">{item.outOfStockDate}</span>}
                        </td>
                        <td className="px-4 py-2">
                          {item.reorderDate ? (
                            <span className="text-slate-700">{item.reorderDate}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-semibold">{item.suggestedOrderQty} kg</td>
                        <td className="px-4 py-2">
                          <Badge color={item.alertLevel === "ok" ? "green" : item.alertLevel === "bajo" ? "yellow" : item.alertLevel === "critico" ? "red" : "gray"}>
                            {alertLabels[item.alertLevel] || item.alertLevel}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  El mínimo de stock y la compra sugerida se actualizan automáticamente con el consumo estimado para {prediccion.days} días. Solo se ajustan alimentos con consumo previsto por programas activos.
                </p>
              </>
            )}
          </Card>

          {/* Chart: Días de stock restante por alimento */}
          {stockDaysData.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span>Días de stock restante por alimento</span>
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Los alimentos con menos días aparecen primero. Rojo: 3 días o menos; amarillo: deben reponerse dentro del horizonte seleccionado ({prediccion?.days ?? 14} días).
              </p>
              <ResponsiveContainer width="100%" height={Math.max(220, stockDaysData.length * 38)}>
                <BarChart data={stockDaysData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={11} unit=" d" />
                  <YAxis type="category" dataKey="name" width={130} fontSize={11} />
                  <Tooltip formatter={(value) => [`${value} días`, "Stock restante"]} />
                  <Bar dataKey="dias" name="Días restantes" radius={[0, 4, 4, 0]}>
                    {stockDaysData.map((item) => (
                      <Cell
                        key={item.name}
                        fill={
                          item.alertLevel === "critico"
                            ? "var(--iw-color-danger)"
                            : item.alertLevel === "bajo"
                              ? "var(--iw-color-warning)"
                              : "var(--iw-color-success)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-500 mt-2">Proyección lineal según consumo diario actual, sin entradas futuras.</p>
            </Card>
          )}
        </div>
      )}

      {/* New/Edit Feed Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Alimento y Ficha" : "Nuevo Alimento y Ficha"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-[var(--iw-semantic-text-primary)]">
                  Base estandarizada de alimentos ({STANDARD_FEED_CATALOG.length} ingredientes · IG-001 a IG-126)
                </p>
                <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                  Elige un ingrediente estándar (incluye concentrados por especie) para precargar imagen, especies, sinónimos y nutrición.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedStandardItem && (
                  <button
                    type="button"
                    onClick={() =>
                      setFichaFeed({
                        name: selectedStandardItem.name,
                        category: selectedStandardItem.defaultCategory,
                        feedType: selectedStandardItem.defaultFeedType,
                        catalogGroup: selectedStandardItem.group,
                        standardCatalogId: selectedStandardItem.id,
                        sanitaryStatus: selectedStandardItem.sanitaryStatus,
                        dryMatterPct: selectedStandardItem.dryMatterPct,
                        crudeProteinPct: selectedStandardItem.crudeProteinAsFedPct,
                        crudeProteinDmPct: selectedStandardItem.crudeProteinDmPct,
                        energyKcalKgDm: selectedStandardItem.energyKcalKgDm,
                        calciumDmPct: selectedStandardItem.calciumDmPct,
                        availablePhosphorusDmPct: selectedStandardItem.availablePhosphorusDmPct,
                        crudeFiberDmPct: selectedStandardItem.crudeFiberDmPct,
                        allowedSpecies: selectedStandardItem.targetSpecies,
                        regionalNames: selectedStandardItem.regionalNames,
                        description: selectedStandardItem.description,
                        imageUrl: selectedStandardItem.imageUrl,
                        botanicalName: selectedStandardItem.botanicalName,
                        presentation: selectedStandardItem.presentation,
                        preparation: selectedStandardItem.preparation,
                        risks: selectedStandardItem.risks,
                        sourceUrl: selectedStandardItem.sourceUrl,
                      })
                    }
                    className="text-[11px] font-semibold text-[var(--iw-semantic-action-primary)] hover:underline"
                  >
                    Ver ficha base
                  </button>
                )}
                {form.standardCatalogId && (
                  <button
                    type="button"
                    onClick={() => applyStandardFeed("")}
                    className="text-[11px] font-semibold text-[var(--iw-semantic-text-secondary)] hover:underline"
                  >
                    Desvincular
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
                <input
                  type="search"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar por nombre, alias regional (cuido, cuy, zapallo) o IG..."
                  aria-label="Buscar ingrediente en catálogo estándar"
                  className="min-h-[42px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] py-2 pl-8 pr-3 text-xs text-[var(--iw-semantic-text-primary)]"
                />
              </div>
              <select
                value={catalogSpecies}
                onChange={(e) => setCatalogSpecies(e.target.value)}
                aria-label="Filtrar catálogo base por animal"
                className="min-h-[42px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-2 text-xs text-[var(--iw-semantic-text-primary)]"
              >
                <option value="all">Todas las especies</option>
                {FEED_SPECIES_SELECTOR_OPTIONS.map((sp) => (
                  <option key={sp.value} value={sp.value}>{sp.shortLabel}</option>
                ))}
              </select>
              <select
                value={catalogGroup}
                onChange={(e) => setCatalogGroup(e.target.value)}
                aria-label="Filtrar grupo de ingrediente estándar"
                className="min-h-[42px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-2 text-xs text-[var(--iw-semantic-text-primary)]"
              >
                <option value="all">Todos los grupos ({STANDARD_FEED_CATALOG.length})</option>
                {STANDARD_FEED_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (filteredStandardCatalog.length === 1) {
                    applyStandardFeed(filteredStandardCatalog[0].id);
                  }
                }}
                className="min-h-[42px] px-3 py-1.5 text-xs"
              >
                <Search className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Buscar ({filteredStandardCatalog.length})
              </Button>
            </div>

            <select
              value={form.standardCatalogId}
              onChange={(e) => applyStandardFeed(e.target.value)}
              aria-label="Seleccionar ingrediente del catálogo estandarizado"
              className="min-h-[44px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--iw-semantic-text-primary)]"
            >
              <option value="">-- Alimento personalizado (sin ficha base) --</option>
              {filteredStandardCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.name} ({item.sanitaryStatus})
                  {item.dryMatterPct !== null ? ` · MS ${item.dryMatterPct}%` : ""}
                  {item.crudeProteinDmPct !== null ? ` · PB ${item.crudeProteinDmPct}% MS` : ""}
                </option>
              ))}
            </select>

            {selectedStandardItem && (
              <div
                className={`rounded-lg border p-2.5 text-xs space-y-1 ${
                  selectedStandardItem.isBlocked
                    ? "border-[var(--iw-semantic-status-danger)]/50 bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-status-danger)]"
                    : selectedStandardItem.sanitaryStatus === "RESTRINGIDO"
                      ? "border-[var(--iw-semantic-status-warning)]/45 bg-[var(--iw-color-paper)] text-[var(--iw-semantic-text-primary)]"
                      : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    {selectedStandardItem.id} · {selectedStandardItem.name}
                    {selectedStandardItem.botanicalName ? ` (${selectedStandardItem.botanicalName})` : ""}
                  </span>
                  <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-bold">
                    {selectedStandardItem.sanitaryStatus}
                  </span>
                </div>
                {selectedStandardItem.preparation && (
                  <p className="text-[11px] leading-snug">
                    <strong>Preparación / validación:</strong> {selectedStandardItem.preparation}
                  </p>
                )}
                {selectedStandardItem.risks && (
                  <p className="text-[11px] leading-snug">
                    <strong>Riesgos / condiciones:</strong> {selectedStandardItem.risks}
                  </p>
                )}
                {selectedStandardItem.missingCriticalFields.length > 0 && !selectedStandardItem.isBlocked && (
                  <p className="text-[11px] font-medium text-[var(--iw-semantic-status-warning)]">
                    Campos por completar de etiqueta/lote: {selectedStandardItem.missingCriticalFields.join(", ")}.
                  </p>
                )}
                {selectedStandardItem.isBlocked && (
                  <div className="pt-1.5 border-t border-[var(--iw-semantic-status-danger)]/25 space-y-1.5">
                    <p className="text-[11px] font-bold">Sustitutos seguros recomendados:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestSafeSubstitutesForStandardId(selectedStandardItem.id, feeds).map((sub) => (
                        <button
                          key={sub.standardCatalogId || sub.name}
                          type="button"
                          onClick={() => sub.standardCatalogId && applyStandardFeed(sub.standardCatalogId)}
                          className="rounded-md border border-[var(--iw-semantic-action-primary)]/40 bg-[var(--iw-semantic-bg-feature)] px-2 py-1 text-[11px] font-semibold text-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-bg-page)]"
                        >
                          Cambiar a {sub.standardCatalogId ? `${sub.standardCatalogId} · ` : ""}{sub.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Input label="Nombre del Alimento" help="Nombre descriptivo del alimento. Ej: 'Larvas de BSF', 'Concentrado Conejos', 'Maíz molido'." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Concentrado Peletizado Cuyes" required />

          {/* Para qué animales aplica */}
          <div className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
                  Para qué animales aplica
                </span>
                <FieldTooltip text="Marca una o varias especies que pueden consumir este alimento con seguridad." />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, allowedSpecies: ["gallina", "gallo", "pollo", "codorniz", "pato"] }))}
                  className="rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
                >
                  Solo aves
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, allowedSpecies: ["conejo", "cuy"] }))}
                  className="rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
                >
                  Conejos y cuyes
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, allowedSpecies: ["gallina", "gallo", "pollo", "codorniz", "pato", "conejo", "cuy"] }))}
                  className="rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
                >
                  Todas
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FEED_SPECIES_SELECTOR_OPTIONS.map((sp) => {
                const checked = form.allowedSpecies.includes(sp.value);
                return (
                  <label
                    key={sp.value}
                    className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-[var(--iw-radius-control)] border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      checked
                        ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)]"
                        : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-secondary)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFormSpecies(sp.value)}
                      className="rounded border-slate-300 text-green-700 focus:ring-green-600"
                    />
                    <span>{sp.shortLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <Input
            label="Nombres regionales / sinónimos"
            help="Otros nombres con que se conoce este alimento en distintas regiones (separados por coma)."
            value={form.regionalNamesText}
            onChange={(e) => setForm({ ...form, regionalNamesText: e.target.value })}
            placeholder="Ej: Cuido postura, Purina, Cuyina, Zapallo, Chonque"
          />

          <Textarea
            label="Descripción del alimento"
            help="Resumen práctico sobre qué es, cómo prepararlo, qué aporta y cuidados según la especie."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Describe presentación, preparación recomendada (ej: orear 12-24 h), riesgos o beneficios por especie..."
          />

          {/* Imagen de la ficha del alimento */}
          <div className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3 space-y-2.5">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
                Imagen del alimento (ficha visual)
              </span>
              <FieldTooltip text="Foto real del bulto/ingrediente o ilustración del catálogo para reconocerlo fácil." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3 items-center">
              <div className="h-24 w-full sm:w-28 overflow-hidden rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] flex items-center justify-center">
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt={form.name || "Vista previa"} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-[var(--iw-semantic-text-secondary)]" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-page)]">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Subir foto del alimento</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setFeedImageError("");
                        try {
                          const dataUrl = await compressFeedImageFile(file);
                          setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
                        } catch (err) {
                          setFeedImageError(err instanceof Error ? err.message : "No se pudo cargar la imagen.");
                        }
                      }}
                    />
                  </label>
                  <select
                    value={FEED_IMAGE_PRESETS.some((p) => p.imageUrl === form.imageUrl) ? form.imageUrl : ""}
                    onChange={(e) => {
                      if (e.target.value) setForm((prev) => ({ ...prev, imageUrl: e.target.value }));
                    }}
                    aria-label="Elegir ilustración del catálogo"
                    className="min-h-[38px] flex-1 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1.5 text-xs text-[var(--iw-semantic-text-primary)]"
                  >
                    <option value="">Elegir ilustración base...</option>
                    {FEED_IMAGE_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.imageUrl}>{preset.label}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={form.imageUrl.startsWith("data:image/") ? "" : form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder={form.imageUrl.startsWith("data:image/") ? "Foto cargada desde tu dispositivo (lista)" : "O pega una URL / ruta de imagen..."}
                  aria-label="URL de imagen del alimento"
                  className="min-h-[36px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1 text-xs text-[var(--iw-semantic-text-primary)]"
                />
                {feedImageError && <p className="text-xs text-[var(--iw-semantic-status-danger)]">{feedImageError}</p>}
              </div>
            </div>
          </div>

          <Select label="Grupo del Catálogo (CSV)" help="Grupo oficial del Catálogo de Alimentos (IG-001..IG-126)." value={form.catalogGroup} onChange={(e) => setForm({ ...form, catalogGroup: e.target.value })}>
            {FEED_CATALOG_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Select label="Categoría" help="Clasificación del alimento: de granja (producido por ti) o suplementario (comprado)." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {categorySelectOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Select label="Tipo de Alimento" help="Tipo específico de alimento según su origen o composición." value={form.feedType} onChange={(e) => setForm({ ...form, feedType: e.target.value })}>
            {feedTypeSelectOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Unidad de medida" help="Unidad en que se mide este alimento (kg, libras, litros, etc.)." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label="Stock actual" help="Cantidad actual disponible de este alimento." type="number" step="0.01" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock mínimo" help="Se actualiza automáticamente en la predicción según el consumo estimado y el horizonte elegido. Mientras no haya consumo programado, puedes definirlo manualmente." type="number" step="0.01" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            <Input label="Costo por unidad ($)" help="Costo de cada unidad de este alimento. Se usa para calcular gastos." type="number" step="0.01" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Materia seca (%)" help="Forrajes frescos suelen estar entre 15 y 30; concentrados cerca de 88 a 90. Obligatoria para validar dietas en base seca." type="number" step="0.1" min="0" max="100" value={form.dryMatterPct} onChange={(e) => setForm({ ...form, dryMatterPct: e.target.value })} />
            <div>
              <Input label="Proteína cruda (% tal cual)" help="Proteína del alimento tal como se ofrece (% PB en MS × % MS / 100)." type="number" step="0.1" min="0" max="100" value={form.crudeProteinPct} onChange={(e) => setForm({ ...form, crudeProteinPct: e.target.value })} />
              {Number(form.dryMatterPct) > 0 && form.crudeProteinPct !== "" && Number.isFinite(Number(form.crudeProteinPct)) && (
                <p className="mt-1 text-[11px] text-[var(--iw-semantic-text-secondary)] tabular-nums">
                  Equivale a <strong>{((Number(form.crudeProteinPct) / Number(form.dryMatterPct)) * 100).toFixed(1)}% PB en MS</strong>
                </p>
              )}
            </div>
          </div>

          <details className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3" open={Boolean(selectedStandardItem && selectedStandardItem.missingCriticalFields.length > 0)}>
            <summary className="cursor-pointer text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
              Perfil nutricional técnico en base seca (% MS) — energía, minerales y fibra
            </summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input label="EM (kcal/kg MS)" type="number" step="1" min="0" max="9000" value={form.energyKcalKgDm} onChange={(e) => setForm({ ...form, energyKcalKgDm: e.target.value })} placeholder="Ej: 2950" />
              <Input label="Calcio (% MS)" type="number" step="0.01" min="0" max="100" value={form.calciumDmPct} onChange={(e) => setForm({ ...form, calciumDmPct: e.target.value })} placeholder="Ej: 3.90" />
              <Input label="Fósforo disp. (% MS)" type="number" step="0.01" min="0" max="100" value={form.availablePhosphorusDmPct} onChange={(e) => setForm({ ...form, availablePhosphorusDmPct: e.target.value })} placeholder="Ej: 0.42" />
              <Input label="Lisina dig. (% MS)" type="number" step="0.01" min="0" max="100" value={form.lysineDigDmPct} onChange={(e) => setForm({ ...form, lysineDigDmPct: e.target.value })} placeholder="Ej: 0.85" />
              <Input label="Met+Cys dig. (% MS)" type="number" step="0.01" min="0" max="100" value={form.metCysDigDmPct} onChange={(e) => setForm({ ...form, metCysDigDmPct: e.target.value })} placeholder="Ej: 0.70" />
              <Input label="Fibra bruta (% MS)" type="number" step="0.01" min="0" max="100" value={form.crudeFiberDmPct} onChange={(e) => setForm({ ...form, crudeFiberDmPct: e.target.value })} placeholder="Ej: 4.50" />
            </div>
          </details>

          <ContactField
            role="proveedor"
            label="Proveedor (vacío si es producción propia)"
            help="Nombre del proveedor de este alimento. Déjalo vacío si lo produces tú mismo."
            value={form.supplier}
            onChange={(name) => setForm({ ...form, supplier: name })}
            placeholder="Nombre del proveedor"
          />
          <div className="flex gap-3">
            <Button onClick={saveFeed} disabled={!form.name || savingFeed || Boolean(selectedStandardItem?.isBlocked)}>
              {savingFeed ? "Guardando…" : selectedStandardItem?.isBlocked ? "Bloqueado (NO USAR)" : editing ? "Actualizar" : "Registrar"}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
          {feedError && <p className="text-sm text-[var(--iw-semantic-status-danger)]" role="alert">{feedError}</p>}
        </div>
      </Modal>

      {/* Movement Modal */}
      <Modal open={movModalOpen} onClose={() => setMovModalOpen(false)} title={movForm.isEntry ? "Registrar Entrada de Alimento" : "Registrar Salida de Alimento"}>
        <div className="space-y-4">
          {movementError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{movementError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMovForm((f) => ({ ...f, isEntry: true, movementType: "compra" }))}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border ${movForm.isEntry ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border"}`}
            >
              <ArrowDown className="w-4 h-4" aria-hidden="true" />
              <span>Entrada</span>
            </button>
            <button
              type="button"
              onClick={() => setMovForm((f) => ({ ...f, isEntry: false, movementType: "consumo_manual" }))}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border ${!movForm.isEntry ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border"}`}
            >
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
              <span>Salida</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>El consumo diario por programa se registra automáticamente. Aquí registras compras,
              donaciones, traslados, producción propia (entradas) y salidas manuales como uso interno o merma.</span>
          </p>
          <FeedSearchPicker
            label="Alimento"
            help="Selecciona o busca directamente el alimento al que aplica este movimiento."
            value={movForm.feedId}
            feeds={feeds}
            onChange={(feedId) => setMovForm({ ...movForm, feedId })}
            onInspectFeed={(f) => setFichaFeed(f)}
            allowEmpty={false}
          />
          <Select label="Motivo" help="Razón del movimiento: compra, donación, consumo manual, merma, etc." value={movForm.movementType} onChange={(e) => setMovForm({ ...movForm, movementType: e.target.value })}>
            {(movForm.isEntry ? entryMovementTypes : exitMovementTypes).map((mt) => (
              <option key={mt} value={mt}>{movementTypeLabels[mt] || mt}</option>
            ))}
          </Select>
          <Input label="Cantidad" help="Cantidad de alimento que entra o sale, en la unidad del alimento." type="number" step="0.01" value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })} placeholder="Ej: 5.5" />
          <Input label="Fecha" help="Fecha del movimiento." type="date" value={movForm.date} onChange={(e) => setMovForm({ ...movForm, date: e.target.value })} />
          <FarmLocationSelect value={movForm.locationId} onChange={(locationId) => setMovForm({ ...movForm, locationId })} allowUnassigned={movForm.isEntry} label={movForm.isEntry ? "Lugar (opcional para una entrada)" : "Lugar donde se suministró *"} help={movForm.isEntry ? "Las compras pueden quedar en el inventario general." : "El consumo queda asociado a este lugar para comparar alimento por espacio."} />
          <Textarea label="Notas" help="Detalles opcionales del movimiento: factura, observaciones, etc." value={movForm.notes} onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })} placeholder="Detalles del movimiento..." />
          <div className="flex gap-3">
            <Button onClick={saveMovement} disabled={!movForm.feedId || !movForm.quantity}>
              {movForm.isEntry ? "Registrar Entrada" : "Registrar Salida"}
            </Button>
            <Button variant="secondary" onClick={() => setMovModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Program Editor Modal */}
      <Modal open={programModalOpen} onClose={() => setProgramModalOpen(false)} title={`Programa: ${editingStage?.value || ""}`}>
        <div className="space-y-4">
          {programError && (
            <p role="alert" className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-semantic-bg-surface)] p-3 text-sm text-[var(--iw-semantic-status-danger)]">
              {programError}
            </p>
          )}
          <p className="text-sm text-[var(--iw-semantic-text-secondary)]">
            Define los alimentos, porcentajes y cantidad diaria por animal para la etapa{" "}
            <strong>{editingStage?.value}</strong> ({editingStage?.minWeeks}–{editingStage?.maxWeeks ? `${editingStage.maxWeeks} sem` : "+ sem"}).
          </p>

          <div className="space-y-3">
            {programEntries.map((entry, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <FeedSearchPicker
                    label="Alimento"
                    help="Concentrado, grano o forraje de esta receta."
                    value={entry.feedId}
                    feeds={feeds}
                    targetSpecies={editingStage ? getStageSpecies(editingStage) : undefined}
                    onChange={(feedId) => updateProgramEntry(idx, "feedId", feedId)}
                    onInspectFeed={(f) => setFichaFeed(f)}
                    compact
                    allowEmpty={false}
                  />
                </div>
                <div className="w-24">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="block text-xs font-medium text-slate-600">% Dieta</label>
                    <FieldTooltip text="Porcentaje que representa este alimento en la mezcla (se calcula solo según los gramos)." />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={derivedPercent(programEntries, idx)}
                    readOnly
                    tabIndex={-1}
                    title="Se calcula a partir de los gramos"
                  />
                </div>
                <div className="w-28">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="block text-xs font-medium text-slate-600">g/ave/día</label>
                    <FieldTooltip text="Gramos diarios que come cada animal en esta etapa." />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={entry.dailyAmountPerHen}
                    onChange={(e) => updateProgramEntry(idx, "dailyAmountPerHen", e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeProgramEntry(idx)}
                  aria-label="Quitar alimento"
                  className="text-red-500 hover:text-red-700 text-sm pb-2"
                  disabled={programEntries.length <= 1}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={addProgramEntry} className="text-sm font-semibold text-[var(--iw-semantic-action-primary)] hover:underline">
            + Agregar alimento
          </button>

          {liveProgramValidation && (
            <DietValidationSummary
              validation={liveProgramValidation}
              compact
              onAddRecommendedFeed={addRecommendedFeedToProgram}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={saveProgram} disabled={Boolean(liveProgramValidation?.sanitaryAlerts.some((a) => a.status === "NO USAR"))}>
              Guardar Programa
            </Button>
            <Button variant="secondary" onClick={() => setProgramModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Nuevo Plan / Programa de Alimentación */}
      <Modal open={newPlanModalOpen} onClose={() => setNewPlanModalOpen(false)} title="Nuevo Plan / Programa de Alimentación">
        <div className="space-y-4">
          {newPlanError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{newPlanError}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Especie Objetivo *"
              value={newPlanForm.species}
              onChange={(e) => {
                const sp = e.target.value;
                const defaultName = sp === "pollo" ? "Pollo Engorde (4-7 sem)"
                  : sp === "codorniz" ? "Codorniz Postura (6+ sem)"
                    : sp === "pato" ? "Pato Engorde (4-9 sem)"
                      : sp === "conejo" ? "Conejo Engorde (8-12 sem)"
                        : sp === "cuy" ? "Cuy Engorde (10-12 sem)"
                          : "Gallina Postura";
                setNewPlanForm((prev) => ({ ...prev, species: sp, name: defaultName }));
              }}
            >
              <option value="pollo">Pollo de engorde</option>
              <option value="gallina">Gallina</option>
              <option value="codorniz">Codorniz</option>
              <option value="pato">Pato</option>
              <option value="conejo">Conejo de engorde</option>
              <option value="cuy">Cuy</option>
            </Select>

            <Input
              label="Nombre del Plan / Etapa *"
              placeholder="Ej: Conejo Engorde y Finalización"
              value={newPlanForm.name}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Semana Inicio *"
              type="number"
              min="0"
              value={newPlanForm.minWeeks}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, minWeeks: e.target.value })}
            />
            <Input
              label="Semana Fin (opcional si es continua)"
              type="number"
              min="1"
              value={newPlanForm.maxWeeks}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, maxWeeks: e.target.value })}
            />
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Composición Nutricional de la Dieta</span>
              <button type="button" onClick={addPlanEntry} className="text-xs text-green-600 font-semibold hover:underline">
                + Agregar Alimento
              </button>
            </div>

            <div className="space-y-2">
              {newPlanForm.entries.map((entry, idx) => (
                <div key={idx} className="flex gap-2 items-end bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <FeedSearchPicker
                      label="Alimento"
                      help="Producto o ingrediente de bodega incluido en el plan."
                      value={entry.feedId}
                      feeds={feeds}
                      targetSpecies={newPlanForm.species as FeedingSpecies}
                      onChange={(feedId) => updatePlanEntry(idx, "feedId", feedId)}
                      onInspectFeed={(f) => setFichaFeed(f)}
                      compact
                      emptyLabel="-- Seleccionar alimento --"
                    />
                  </div>
                  <div className="w-20">
                    <div className="flex items-center gap-1 mb-1">
                      <label className="block text-[11px] font-medium text-slate-600">% Dieta</label>
                      <FieldTooltip text="Proporción dentro de la dieta total, calculada automáticamente." />
                    </div>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                      value={derivedPercent(newPlanForm.entries, idx)}
                      readOnly
                      tabIndex={-1}
                      title="Se calcula a partir de los gramos"
                    />
                  </div>
                  <div className="w-24">
                    <div className="flex items-center gap-1 mb-1">
                      <label className="block text-[11px] font-medium text-slate-600">g/animal/día</label>
                      <FieldTooltip text="Cantidad en gramos recomendada por animal cada día." />
                    </div>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="w-full border rounded-md px-2 py-1.5 text-xs bg-white font-semibold"
                      value={entry.dailyAmountPerHen}
                      onChange={(e) => updatePlanEntry(idx, "dailyAmountPerHen", e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePlanEntry(idx)}
                    aria-label="Quitar alimento"
                    className="text-red-500 hover:text-red-700 text-xs px-1 pb-1"
                    disabled={newPlanForm.entries.length <= 1}
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {liveNewPlanValidation && (
            <DietValidationSummary
              validation={liveNewPlanValidation}
              compact
              onAddRecommendedFeed={addRecommendedFeedToNewPlan}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={saveNewPlan} disabled={Boolean(liveNewPlanValidation?.sanitaryAlerts.some((a) => a.status === "NO USAR"))}>
              Crear Plan de Alimentación
            </Button>
            <Button variant="secondary" onClick={() => setNewPlanModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <FeedFichaModal
        open={Boolean(fichaFeed)}
        onClose={() => setFichaFeed(null)}
        feed={fichaFeed}
        canSeeFinancials={fichaFeed?.costPerUnit != null}
        onEdit={
          fichaFeed?.id
            ? (feed) => {
                const found = feeds.find((x) => x.id === feed.id);
                if (found) openEditFeed(found);
              }
            : undefined
        }
        onUseFeed={
          !fichaFeed?.id && fichaFeed?.standardCatalogId
            ? (feed) => {
                const std = findStandardFeedById(feed.standardCatalogId);
                if (std) openNewFeedFromStandard(std);
              }
            : undefined
        }
        useFeedLabel="Crear alimento con esta ficha"
      />

      <FeedCatalogExplorerModal
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        feeds={feeds}
        initialSpecies={feedSpeciesFilter}
        onInspectFeed={(feed) => setFichaFeed(feed)}
        onAddStandardFeed={(item) => openNewFeedFromStandard(item)}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Egg,
  HeartPulse,
  Mic,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Wheat,
  WifiOff,
} from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import FarmLocationSelect from "@/components/FarmLocationSelect";
import { apiFetch } from "@/lib/fetch";
import { todayColombiaIso } from "@/lib/date-validation";
import { useCatalog } from "@/lib/useCatalog";
import { useFarmLocations } from "@/lib/useFarmLocations";
import { useSpeciesCatalog } from "@/lib/use-species-params";
import { syncManager } from "@/lib/offline/syncManager";
import { getCachedCatalog, getCachedRecords } from "@/lib/offline/db";
import { OPEN_ASSISTANT_VOICE_EVENT } from "@/lib/offline/voiceNotes";
import {
  OPEN_QUICK_CAPTURE_EVENT,
  QUICK_CAPTURE_SAVED_EVENT,
  type QuickCaptureDetail,
  type QuickCaptureMode,
} from "@/lib/quick-capture-events";

interface EggRecordCache {
  id: string;
  date: string;
  species?: string;
  batchId?: string | null;
  locationId?: string | null;
  totalCollected: number;
  broken: number;
  forIncubation: number;
  details?: { size: string; quantity: number }[];
}

interface FeedItem {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
}

interface FeedMovementCache {
  id: string;
  feedId: string;
  feedName?: string | null;
  feedUnit?: string | null;
  quantity: string;
  isEntry: boolean;
  movementType: string;
  locationId?: string | null;
  date: string;
}

interface HenItem {
  id: string;
  code: string;
  breed?: string | null;
  status: string;
  locationId?: string | null;
}

interface RoosterItem {
  id: string;
  code: string;
  status: string;
  locationId?: string | null;
}

interface BatchItem {
  id: string;
  code: string;
  species: string;
  purpose: string;
  currentQuantity: number;
  status: string;
  locationId?: string | null;
}

interface EggSizeInventory {
  size: string;
  price: number | null;
  available: number;
}

interface EggInventoryPayload {
  summary?: {
    available?: number;
    sizes?: EggSizeInventory[];
  };
}

const MODE_TABS: { mode: QuickCaptureMode; label: string; icon: typeof Egg }[] = [
  { mode: "huevos", label: "Huevos", icon: Egg },
  { mode: "alimentacion", label: "Alimento", icon: Wheat },
  { mode: "mortalidad", label: "Mortalidad", icon: HeartPulse },
  { mode: "gasto", label: "Gasto", icon: Receipt },
  { mode: "venta", label: "Venta", icon: ShoppingBag },
];

const EGG_SPECIES_OPTIONS = [
  { value: "gallina", label: "Gallina" },
  { value: "codorniz", label: "Codorniz" },
  { value: "pato", label: "Pato" },
];

const MORTALITY_BIRD_TYPES = [
  { value: "gallina", label: "Gallina" },
  { value: "gallo", label: "Gallo" },
  { value: "lote_pollos", label: "Lote pollos" },
  { value: "lote_codornices", label: "Lote codornices" },
  { value: "lote_patos", label: "Lote patos" },
  { value: "lote_conejos", label: "Lote conejos" },
];

const BATCH_SPECIES_BY_TYPE: Record<string, string> = {
  lote_pollos: "pollo",
  lote_codornices: "codorniz",
  lote_patos: "pato",
  lote_conejos: "conejo",
};

const MORTALITY_CAUSES = [
  { value: "enfermedad", label: "Enfermedad" },
  { value: "depredador", label: "Depredador" },
  { value: "accidente", label: "Accidente" },
  { value: "sacrificio_sanitario", label: "Sacrificio sanitario" },
  { value: "causa_natural", label: "Causa natural" },
  { value: "otro", label: "Otro" },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  "Otro egreso",
  "Compra de insumos",
  "Control sanitario",
  "Mantenimiento",
  "Mano de obra",
  "Servicios (agua/luz)",
  "Transporte",
];

function todayIso(): string {
  return todayColombiaIso();
}

function normalizeFeeds(raw: unknown): FeedItem[] {
  if (Array.isArray(raw)) return raw as FeedItem[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: FeedItem[] }).items;
  }
  return [];
}

function distributeEggSizes(
  goodTotal: number,
  sizes: string[],
  recentRecords: EggRecordCache[],
): Record<string, number> {
  if (goodTotal <= 0 || sizes.length === 0) return {};
  const recent = recentRecords.filter((r) => (r.species || "gallina") === "gallina").slice(0, 14);
  const sizeTotals: Record<string, number> = {};
  for (const r of recent) {
    for (const d of r.details || []) {
      sizeTotals[d.size] = (sizeTotals[d.size] || 0) + Number(d.quantity || 0);
    }
  }
  const classifiedTotal = Object.values(sizeTotals).reduce((s, q) => s + q, 0);
  const hasHistory = classifiedTotal > 0;
  const weights = sizes.map((size) => (hasHistory ? (sizeTotals[size] || 0) / classifiedTotal : 1));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const allocations = sizes.map((size, idx) => {
    const exact = totalWeight > 0 ? (goodTotal * weights[idx]) / totalWeight : goodTotal / sizes.length;
    const quantity = Math.floor(exact);
    return { size, quantity, remainder: exact - quantity };
  });

  let unassigned = goodTotal - allocations.reduce((s, row) => s + row.quantity, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || sizes.indexOf(a.size) - sizes.indexOf(b.size));
  for (const row of allocations) {
    if (unassigned <= 0) break;
    row.quantity += 1;
    unassigned -= 1;
  }

  const out: Record<string, number> = {};
  for (const row of allocations) {
    if (row.quantity > 0) out[row.size] = row.quantity;
  }
  return out;
}

export default function QuickCaptureModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuickCaptureMode>("huevos");
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successInfo, setSuccessInfo] = useState<{ title: string; subtitle: string; offline: boolean } | null>(null);

  const { locations } = useFarmLocations(true);
  const { items: sizeCatalog } = useCatalog("tamano_huevo");
  const { values: expenseCategories } = useCatalog("categoria_egreso", DEFAULT_EXPENSE_CATEGORIES);
  const { values: buyerOptions } = useCatalog("comprador");
  const { priceEgg } = useSpeciesCatalog();

  // Cached/live domain catalogs
  const [eggHistory, setEggHistory] = useState<EggRecordCache[]>([]);
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [feedHistory, setFeedHistory] = useState<FeedMovementCache[]>([]);
  const [hens, setHens] = useState<HenItem[]>([]);
  const [roosters, setRoosters] = useState<RoosterItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [eggInventory, setEggInventory] = useState<EggSizeInventory[]>([]);

  // Eggs state
  const [eggDate, setEggDate] = useState(todayIso);
  const [eggSpecies, setEggSpecies] = useState("gallina");
  const [eggLocationId, setEggLocationId] = useState("");
  const [eggBatchId, setEggBatchId] = useState("");
  const [trays, setTrays] = useState(0);
  const [looseEggs, setLooseEggs] = useState(0);
  const [showEggDetails, setShowEggDetails] = useState(false);
  const [brokenEggs, setBrokenEggs] = useState(0);
  const [incubEggs, setIncubEggs] = useState(0);
  const [autoEggs, setAutoEggs] = useState(0);
  const [surplusEggs, setSurplusEggs] = useState(0);
  const [eggNotes, setEggNotes] = useState("");
  const [eggOverLimitMsg, setEggOverLimitMsg] = useState("");

  // Feed state
  const [feedDate, setFeedDate] = useState(todayIso);
  const [feedLocationId, setFeedLocationId] = useState("");
  const [feedId, setFeedId] = useState("");
  const [feedQty, setFeedQty] = useState("1");
  const [feedNotes, setFeedNotes] = useState("");

  // Mortality state
  const [mortDate, setMortDate] = useState(todayIso);
  const [mortLocationId, setMortLocationId] = useState("");
  const [mortBirdType, setMortBirdType] = useState("gallina");
  const [mortHenId, setMortHenId] = useState("");
  const [mortRoosterId, setMortRoosterId] = useState("");
  const [mortBatchId, setMortBatchId] = useState("");
  const [mortQty, setMortQty] = useState("1");
  const [mortCause, setMortCause] = useState("enfermedad");
  const [mortNotes, setMortNotes] = useState("");

  // Expense state
  const [expDate, setExpDate] = useState(todayIso);
  const [expCategory, setExpCategory] = useState("Otro egreso");
  const [expAmount, setExpAmount] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expCounterparty, setExpCounterparty] = useState("");

  // Sale state
  const [saleDate, setSaleDate] = useState(todayIso);
  const [saleSize, setSaleSize] = useState("");
  const [saleQty, setSaleQty] = useState("30");
  const [salePrice, setSalePrice] = useState("500");
  const [saleBuyer, setSaleBuyer] = useState("");

  const hydrateFromCacheAndNetwork = useCallback(async (detail?: QuickCaptureDetail) => {
    const [
      cachedEggsA,
      cachedEggsB,
      cachedFeeds,
      cachedMovA,
      cachedMovB,
      cachedHens,
      cachedRoosters,
      cachedBatches,
      cachedEggInv,
    ] = await Promise.all([
      getCachedRecords<EggRecordCache[]>("produccion_huevos"),
      getCachedRecords<EggRecordCache[]>("api:/api/produccion/huevos"),
      getCachedCatalog<unknown>("feed_inventory"),
      getCachedRecords<FeedMovementCache[]>("feed_movements"),
      getCachedRecords<FeedMovementCache[]>("api:/api/produccion/alimentacion/movimientos"),
      getCachedCatalog<HenItem[]>("hens_all"),
      getCachedCatalog<RoosterItem[]>("roosters_all"),
      getCachedCatalog<BatchItem[]>("broiler_batches_all"),
      getCachedCatalog<EggInventoryPayload>("egg_inventory_summary"),
    ]);

    const mergedEggs = Array.isArray(cachedEggsA) && cachedEggsA.length > 0
      ? cachedEggsA
      : Array.isArray(cachedEggsB) ? cachedEggsB : [];
    const mergedFeeds = normalizeFeeds(cachedFeeds);
    const mergedMovs = Array.isArray(cachedMovA) && cachedMovA.length > 0
      ? cachedMovA
      : Array.isArray(cachedMovB) ? cachedMovB : [];
    const mergedHens = Array.isArray(cachedHens) ? cachedHens : [];
    const mergedRoosters = Array.isArray(cachedRoosters) ? cachedRoosters : [];
    const mergedBatches = Array.isArray(cachedBatches) ? cachedBatches : [];
    const mergedSizes = cachedEggInv?.summary?.sizes || [];

    if (mergedEggs.length > 0) setEggHistory(mergedEggs);
    if (mergedFeeds.length > 0) setFeeds(mergedFeeds);
    if (mergedMovs.length > 0) setFeedHistory(mergedMovs);
    if (mergedHens.length > 0) setHens(mergedHens);
    if (mergedRoosters.length > 0) setRoosters(mergedRoosters);
    if (mergedBatches.length > 0) setBatches(mergedBatches);
    if (mergedSizes.length > 0) {
      setEggInventory(mergedSizes);
      const firstAvail = mergedSizes.find((s) => s.available > 0);
      if (firstAvail) {
        setSaleSize((prev) => prev || firstAvail.size);
        setSalePrice((prev) => (prev === "500" && firstAvail.price ? String(firstAvail.price) : prev));
      }
    }

    // Apply smart defaults if user didn't pass explicit location/feed
    if (!detail?.locationId) {
      const lastEggLoc = mergedEggs.find((r) => r.locationId)?.locationId;
      if (lastEggLoc) setEggLocationId((prev) => prev || lastEggLoc);
      const lastFeed = mergedMovs.find((m) => !m.isEntry && m.locationId);
      if (lastFeed?.locationId) setFeedLocationId((prev) => prev || lastFeed.locationId || "");
    }
    if (!detail?.suggestedFeedId) {
      const lastOutgoing = mergedMovs.find((m) => !m.isEntry);
      const fallbackFeed = mergedFeeds.find((f) => Number(f.currentStock) > 0) || mergedFeeds[0];
      if (lastOutgoing?.feedId) setFeedId((prev) => prev || lastOutgoing.feedId);
      else if (fallbackFeed?.id) setFeedId((prev) => prev || fallbackFeed.id);
    }

    if (typeof navigator !== "undefined" && navigator.onLine !== false) {
      try {
        const [eggsRes, feedsRes, movRes, hensRes, roostersRes, batchesRes, invRes] = await Promise.all([
          apiFetch("/api/produccion/huevos").catch(() => null),
          apiFetch("/api/produccion/alimentacion").catch(() => null),
          apiFetch("/api/produccion/alimentacion/movimientos").catch(() => null),
          apiFetch("/api/produccion/gallinas").catch(() => null),
          apiFetch("/api/produccion/gallos").catch(() => null),
          apiFetch("/api/produccion/pollos").catch(() => null),
          apiFetch("/api/produccion/huevos/inventario").catch(() => null),
        ]);

        if (eggsRes?.ok) {
          const data = await eggsRes.json().catch(() => null);
          if (Array.isArray(data)) setEggHistory(data);
        }
        if (feedsRes?.ok) {
          const data = normalizeFeeds(await feedsRes.json().catch(() => null));
          if (data.length > 0) {
            setFeeds(data);
            setFeedId((prev) => prev || (data.find((f) => Number(f.currentStock) > 0) || data[0]).id);
          }
        }
        if (movRes?.ok) {
          const data = await movRes.json().catch(() => null);
          if (Array.isArray(data)) setFeedHistory(data);
        }
        if (hensRes?.ok) {
          const data = await hensRes.json().catch(() => null);
          if (Array.isArray(data)) setHens(data);
        }
        if (roostersRes?.ok) {
          const data = await roostersRes.json().catch(() => null);
          if (Array.isArray(data)) setRoosters(data);
        }
        if (batchesRes?.ok) {
          const data = await batchesRes.json().catch(() => null);
          if (Array.isArray(data)) setBatches(data);
        }
        if (invRes?.ok) {
          const data = (await invRes.json().catch(() => null)) as EggInventoryPayload | null;
          const sizes = data?.summary?.sizes || [];
          setEggInventory(sizes);
          const firstAvail = sizes.find((s) => s.available > 0);
          if (firstAvail) {
            setSaleSize((prev) => prev || firstAvail.size);
            if (firstAvail.price) setSalePrice(String(firstAvail.price));
          }
        }
      } catch {
        // Silencioso en modo offline
      }
    }
  }, []);

  const resetForDetail = useCallback((detail: QuickCaptureDetail) => {
    const today = todayIso();
    setMode(detail.mode);
    setError("");
    setSuccessInfo(null);
    setSaving(false);
    setEggOverLimitMsg("");

    // Reset eggs
    setEggDate(today);
    const sp = detail.species && ["gallina", "codorniz", "pato"].includes(detail.species) ? detail.species : "gallina";
    setEggSpecies(sp);
    setEggLocationId(detail.locationId || "");
    setEggBatchId(detail.batchId || "");
    const suggested = detail.suggestedEggs && detail.suggestedEggs > 0 ? Math.round(detail.suggestedEggs) : 0;
    setTrays(Math.floor(suggested / 30));
    setLooseEggs(suggested % 30);
    setShowEggDetails(false);
    setBrokenEggs(0);
    setIncubEggs(0);
    setAutoEggs(0);
    setSurplusEggs(0);
    setEggNotes("");

    // Reset feed
    setFeedDate(today);
    setFeedLocationId(detail.locationId || "");
    setFeedId(detail.suggestedFeedId || "");
    setFeedQty(detail.suggestedFeedQty && detail.suggestedFeedQty > 0 ? String(detail.suggestedFeedQty) : "1");
    setFeedNotes("");

    // Reset mortality
    setMortDate(today);
    setMortLocationId(detail.locationId || "");
    if (detail.roosterId) setMortBirdType("gallo");
    else if (detail.batchId) {
      const batchType = detail.species === "codorniz"
        ? "lote_codornices"
        : detail.species === "pato"
          ? "lote_patos"
          : detail.species === "conejo"
            ? "lote_conejos"
            : "lote_pollos";
      setMortBirdType(batchType);
    } else {
      setMortBirdType("gallina");
    }
    setMortHenId(detail.henId || "");
    setMortRoosterId(detail.roosterId || "");
    setMortBatchId(detail.batchId || "");
    setMortQty("1");
    setMortCause("enfermedad");
    setMortNotes("");

    // Reset expense
    setExpDate(today);
    setExpAmount("");
    setExpDescription("");
    setExpCounterparty("");

    // Reset sale
    setSaleDate(today);
    setSaleQty("30");
    setSaleBuyer("");

    setOpen(true);
    void hydrateFromCacheAndNetwork(detail);
  }, [hydrateFromCacheAndNetwork]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<QuickCaptureDetail>).detail;
      if (detail?.mode) resetForDetail(detail);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OPEN_QUICK_CAPTURE_EVENT, onOpen);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OPEN_QUICK_CAPTURE_EVENT, onOpen);
    };
  }, [resetForDetail]);

  const effectiveDefaultLocation = useMemo(() => {
    return locations[0]?.id || "";
  }, [locations]);

  const totalEggsCollected = Math.max(0, trays * 30 + looseEggs);
  const goodEggs = Math.max(0, totalEggsCollected - brokenEggs - incubEggs);
  const eggUnitPrice = priceEgg(eggSpecies);
  const estimatedEggValue = goodEggs * eggUnitPrice;

  const sizeValues = useMemo(() => {
    const vals = sizeCatalog.map((c) => c.value);
    return vals.length > 0 ? vals : ["Jumbo", "Extra", "Grande", "Mediano", "Pequeño"];
  }, [sizeCatalog]);

  const eggDistribution = useMemo(() => {
    if (eggSpecies !== "gallina") {
      const defaultSize = eggSpecies === "codorniz" ? "Codorniz estándar" : "Pato estándar";
      return goodEggs > 0 ? { [defaultSize]: goodEggs } : {};
    }
    return distributeEggSizes(goodEggs, sizeValues, eggHistory);
  }, [eggSpecies, goodEggs, sizeValues, eggHistory]);

  const eggLayingBatches = useMemo(() => {
    return batches.filter(
      (b) =>
        b.species === eggSpecies &&
        b.purpose === "postura_huevo" &&
        b.currentQuantity > 0 &&
        ["activo", "listo_sacrificio"].includes(b.status),
    );
  }, [batches, eggSpecies]);

  const lastEggRecord = useMemo(() => {
    if (eggLocationId) {
      const inLoc = eggHistory.find((r) => r.locationId === eggLocationId && (r.species || "gallina") === eggSpecies);
      if (inLoc) return inLoc;
    }
    return eggHistory.find((r) => (r.species || "gallina") === eggSpecies) || eggHistory[0] || null;
  }, [eggHistory, eggLocationId, eggSpecies]);

  const lastFeedRecord = useMemo(() => {
    const outgoing = feedHistory.filter((m) => !m.isEntry);
    if (feedLocationId) {
      const inLoc = outgoing.find((m) => m.locationId === feedLocationId);
      if (inLoc) return inLoc;
    }
    return outgoing[0] || null;
  }, [feedHistory, feedLocationId]);

  const activeHens = useMemo(() => {
    const base = hens.filter((h) => !["muerta", "vendida", "sacrificada"].includes(h.status));
    if (!mortLocationId) return base;
    const inLoc = base.filter((h) => h.locationId === mortLocationId);
    return inLoc.length > 0 ? inLoc : base;
  }, [hens, mortLocationId]);

  const activeRoosters = useMemo(() => {
    const base = roosters.filter((r) => !["muerta", "muerto", "vendido", "vendida", "sacrificado"].includes(r.status));
    if (!mortLocationId) return base;
    const inLoc = base.filter((r) => r.locationId === mortLocationId);
    return inLoc.length > 0 ? inLoc : base;
  }, [roosters, mortLocationId]);

  const activeMortBatches = useMemo(() => {
    const targetSpecies = BATCH_SPECIES_BY_TYPE[mortBirdType];
    const base = batches.filter(
      (b) => (!targetSpecies || b.species === targetSpecies) && b.status !== "cerrado" && b.currentQuantity > 0,
    );
    if (!mortLocationId) return base;
    const inLoc = base.filter((b) => b.locationId === mortLocationId);
    return inLoc.length > 0 ? inLoc : base;
  }, [batches, mortBirdType, mortLocationId]);

  const selectedFeedObj = useMemo(() => feeds.find((f) => f.id === feedId) || null, [feeds, feedId]);

  const applyLastEggRecord = () => {
    if (!lastEggRecord) return;
    const total = Number(lastEggRecord.totalCollected || 0);
    setTrays(Math.floor(total / 30));
    setLooseEggs(total % 30);
    setBrokenEggs(Number(lastEggRecord.broken || 0));
    setIncubEggs(Number(lastEggRecord.forIncubation || 0));
    if (lastEggRecord.locationId) setEggLocationId(lastEggRecord.locationId);
    if (lastEggRecord.species) setEggSpecies(lastEggRecord.species);
    if (lastEggRecord.batchId) setEggBatchId(lastEggRecord.batchId);
    setError("");
  };

  const applyLastFeedRecord = () => {
    if (!lastFeedRecord) return;
    setFeedId(lastFeedRecord.feedId);
    setFeedQty(String(Number(lastFeedRecord.quantity || 1)));
    if (lastFeedRecord.locationId) setFeedLocationId(lastFeedRecord.locationId);
    setError("");
  };

  const submitEggs = async (overrideValidation = false) => {
    setError("");
    const loc = eggLocationId || effectiveDefaultLocation;
    if (!loc) return setError("Selecciona el lugar donde recogiste los huevos.");
    if (totalEggsCollected <= 0) return setError("Ingresa al menos 1 huevo recogido.");
    if (brokenEggs + incubEggs > totalEggsCollected) {
      return setError("Los rotos más incubación no pueden superar el total recogido.");
    }
    if (autoEggs + surplusEggs > goodEggs) {
      return setError("Autoconsumo + excedente no puede superar los huevos aprovechables.");
    }
    if (eggSpecies !== "gallina" && !eggBatchId) {
      return setError(`Selecciona un lote de postura de ${eggSpecies}.`);
    }

    const sizesList = Object.entries(eggDistribution)
      .filter(([, q]) => q > 0)
      .map(([size, quantity]) => ({ size, quantity }));

    setSaving(true);
    try {
      const result = await syncManager.executeMutation({
        endpoint: "/api/produccion/huevos",
        method: "POST",
        entity: "huevos",
        description: `Recolección rápida de ${totalEggsCollected} huevos`,
        payload: {
          date: eggDate,
          species: eggSpecies,
          batchId: eggSpecies === "gallina" ? null : eggBatchId,
          locationId: loc,
          totalCollected: totalEggsCollected,
          broken: brokenEggs,
          forIncubation: incubEggs,
          quantityAutoconsumo: autoEggs,
          quantityExcedente: surplusEggs,
          referenceUnitPrice: String(eggUnitPrice),
          notes: eggNotes.trim() || null,
          sizes: sizesList,
          details: sizesList,
          overrideValidation,
        },
      });

      if (!result.ok && !result.offline) {
        if (result.status === 409) {
          setEggOverLimitMsg(result.error || "La cantidad supera el máximo esperado para las aves en postura.");
          return;
        }
        setError(result.error || "No se pudo guardar la recolección.");
        return;
      }

      const locName = locations.find((l) => l.id === loc)?.name || "la granja";
      setEggOverLimitMsg("");
      setSuccessInfo({
        title: `${totalEggsCollected} huevos registrados en ${locName}`,
        subtitle: `Valor estimado: $${estimatedEggValue.toLocaleString("es-CO")} (${goodEggs} aprovechables)`,
        offline: result.offline,
      });
      window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_SAVED_EVENT, { detail: { mode: "huevos" } }));
    } finally {
      setSaving(false);
    }
  };

  const submitFeed = async () => {
    setError("");
    const loc = feedLocationId || effectiveDefaultLocation;
    const qty = Number(feedQty);
    if (!loc) return setError("Selecciona el lugar donde entregaste alimento.");
    if (!feedId) return setError("Selecciona un alimento del inventario.");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Ingresa una cantidad válida mayor a 0.");

    setSaving(true);
    try {
      const feedLabel = selectedFeedObj?.name || "alimento";
      const unitLabel = selectedFeedObj?.unit || "kg";
      const result = await syncManager.executeMutation({
        endpoint: "/api/produccion/alimentacion/movimientos",
        method: "POST",
        entity: "alimentacion",
        description: `Consumo rápido de ${qty} ${unitLabel} de ${feedLabel}`,
        payload: {
          feedId,
          quantity: String(qty),
          isEntry: false,
          movementType: "consumo_manual",
          locationId: loc,
          date: feedDate,
          notes: feedNotes.trim() || null,
        },
      });

      if (!result.ok && !result.offline) {
        setError(result.error || "No se pudo registrar el consumo.");
        return;
      }

      const locName = locations.find((l) => l.id === loc)?.name || "la granja";
      setSuccessInfo({
        title: `${qty} ${unitLabel} de ${feedLabel} registrados`,
        subtitle: `Entregado en ${locName}`,
        offline: result.offline,
      });
      window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_SAVED_EVENT, { detail: { mode: "alimentacion" } }));
    } finally {
      setSaving(false);
    }
  };

  const submitMortality = async () => {
    setError("");
    const loc = mortLocationId || effectiveDefaultLocation;
    if (!loc) return setError("Selecciona el lugar donde ocurrió la baja.");
    const isBatch = mortBirdType in BATCH_SPECIES_BY_TYPE;
    if (mortBirdType === "gallina" && !mortHenId) return setError("Selecciona la gallina.");
    if (mortBirdType === "gallo" && !mortRoosterId) return setError("Selecciona el gallo.");
    if (isBatch && !mortBatchId) return setError("Selecciona el lote.");
    const qty = isBatch ? Math.max(1, Math.round(Number(mortQty || 1))) : 1;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        date: mortDate,
        birdType: mortBirdType,
        cause: mortCause,
        locationId: loc,
        quantity: qty,
        description: mortNotes.trim() || undefined,
      };
      if (mortBirdType === "gallina") payload.henId = mortHenId;
      if (mortBirdType === "gallo") payload.roosterId = mortRoosterId;
      if (isBatch) payload.batchId = mortBatchId;

      const result = await syncManager.executeMutation({
        endpoint: "/api/produccion/mortalidad",
        method: "POST",
        entity: "mortalidad",
        description: `Baja rápida de ${qty} ${mortBirdType} (${mortCause})`,
        payload,
      });

      if (!result.ok && !result.offline) {
        setError(result.error || "No se pudo registrar la mortalidad.");
        return;
      }

      const causeLabel = MORTALITY_CAUSES.find((c) => c.value === mortCause)?.label || mortCause;
      setSuccessInfo({
        title: `Baja registrada (${qty})`,
        subtitle: `Causa: ${causeLabel}`,
        offline: result.offline,
      });
      window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_SAVED_EVENT, { detail: { mode: "mortalidad" } }));
    } finally {
      setSaving(false);
    }
  };

  const submitExpense = async () => {
    setError("");
    const amount = Number(expAmount);
    if (!expDescription.trim()) return setError("Describe brevemente el gasto.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Ingresa un monto mayor a 0.");

    setSaving(true);
    try {
      const res = await apiFetch("/api/finanzas/finanzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: expDate,
          type: "egreso",
          category: categoriesList.includes(expCategory) ? expCategory : categoriesList[0] || "Otro egreso",
          description: expDescription.trim(),
          amount,
          counterparty: expCounterparty.trim() || null,
          isCredit: false,
        }),
      });
      const isQueued = res.headers.get("X-Gallinero-Offline-Queued") === "1";
      if (!res.ok && !isQueued) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo guardar el gasto.");
        return;
      }

      setSuccessInfo({
        title: `Gasto guardado: $${amount.toLocaleString("es-CO")}`,
        subtitle: `${expCategory} · ${expDescription.trim()}`,
        offline: isQueued,
      });
      window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_SAVED_EVENT, { detail: { mode: "gasto" } }));
    } finally {
      setSaving(false);
    }
  };

  const submitSale = async () => {
    setError("");
    const qty = Math.round(Number(saleQty));
    const price = Number(salePrice);
    if (!saleSize) return setError("Selecciona el tamaño de huevo a vender.");
    if (!Number.isFinite(qty) || qty < 1) return setError("Cantidad mínima: 1 huevo.");
    if (!Number.isFinite(price) || price <= 0) return setError("Ingresa un precio unitario válido.");

    setSaving(true);
    try {
      const res = await apiFetch("/api/finanzas/finanzas/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: saleDate,
          buyer: saleBuyer.trim() || null,
          notes: null,
          isCredit: false,
          dueDate: null,
          items: [{ size: saleSize, quantity: qty, presentations: qty, pricePerUnit: price, presentation: null }],
        }),
      });
      const isQueued = res.headers.get("X-Gallinero-Offline-Queued") === "1";
      if (!res.ok && !isQueued) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo registrar la venta.");
        return;
      }

      setSuccessInfo({
        title: `Venta guardada: $${(qty * price).toLocaleString("es-CO")}`,
        subtitle: `${qty} huevos ${saleSize}${saleBuyer.trim() ? ` · ${saleBuyer.trim()}` : ""}`,
        offline: isQueued,
      });
      window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_SAVED_EVENT, { detail: { mode: "venta" } }));
    } finally {
      setSaving(false);
    }
  };

  const availableSizes = eggInventory.filter((s) => s.available > 0);
  const filteredExpenseCategories = expenseCategories.filter((c) => c !== "Compra de alimento");
  const categoriesList = filteredExpenseCategories.length > 0 ? filteredExpenseCategories : DEFAULT_EXPENSE_CATEGORIES;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Registro rápido">
      <div className="space-y-4">
        {!online && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <WifiOff className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>Sin internet: tu registro se guardará en el teléfono y se enviará al reconectar.</span>
          </div>
        )}

        {/* Mode selector strip */}
        <div className="grid grid-cols-5 gap-1.5 rounded-xl bg-slate-100 p-1">
          {MODE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.mode;
            return (
              <button
                key={tab.mode}
                type="button"
                onClick={() => {
                  setMode(tab.mode);
                  setError("");
                  setSuccessInfo(null);
                  setEggOverLimitMsg("");
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all ${
                  active ? "bg-white text-green-700 shadow-xs" : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {eggOverLimitMsg && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Confirmación de postura alta</p>
            <p className="text-xs leading-relaxed">{eggOverLimitMsg}</p>
            <div className="flex gap-2">
              <Button type="button" onClick={() => void submitEggs(true)} disabled={saving}>
                Confirmar y guardar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEggOverLimitMsg("")}>
                Corregir cantidad
              </Button>
            </div>
          </div>
        )}

        {successInfo ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">{successInfo.title}</p>
              <p className="mt-1 text-sm text-slate-600">{successInfo.subtitle}</p>
              {successInfo.offline && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Guardado en modo offline · pendiente por sincronizar
                </p>
              )}
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSuccessInfo(null);
                  setError("");
                }}
              >
                Registrar otro
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <>
            {mode === "huevos" && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {EGG_SPECIES_OPTIONS.map((sp) => (
                      <button
                        key={sp.value}
                        type="button"
                        onClick={() => {
                          setEggSpecies(sp.value);
                          setEggBatchId("");
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          eggSpecies === sp.value
                            ? "border-yellow-500 bg-yellow-100 text-yellow-900"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                  {lastEggRecord && (
                    <button
                      type="button"
                      onClick={applyLastEggRecord}
                      className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Igual que ayer ({lastEggRecord.totalCollected})</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FarmLocationSelect
                    value={eggLocationId || effectiveDefaultLocation}
                    onChange={setEggLocationId}
                    label="Galpón / ubicación"
                    help=""
                  />
                  <Input
                    label="Fecha"
                    type="date"
                    value={eggDate}
                    onChange={(e) => setEggDate(e.target.value)}
                  />
                </div>

                {eggSpecies !== "gallina" && (
                  <Select
                    label="Lote en postura"
                    value={eggBatchId}
                    onChange={(e) => setEggBatchId(e.target.value)}
                  >
                    <option value="">Selecciona un lote de {eggSpecies}…</option>
                    {eggLayingBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} ({b.currentQuantity} aves)
                      </option>
                    ))}
                  </Select>
                )}

                {/* Cubetas + sueltos counter */}
                <div className="rounded-xl border border-yellow-200 bg-yellow-50/70 p-3.5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1 block text-xs font-semibold text-slate-700">Cubetas (×30)</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTrays((t) => Math.max(0, t - 1))}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          aria-label="Restar una cubeta"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={trays}
                          onChange={(e) => setTrays(Math.max(0, Number(e.target.value || 0)))}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white text-center text-base font-bold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => setTrays((t) => t + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          aria-label="Sumar una cubeta"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="mb-1 block text-xs font-semibold text-slate-700">Huevos sueltos</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLooseEggs((l) => Math.max(0, l - 1))}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          aria-label="Restar un huevo suelto"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={looseEggs}
                          onChange={(e) => setLooseEggs(Math.max(0, Number(e.target.value || 0)))}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white text-center text-base font-bold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => setLooseEggs((l) => l + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          aria-label="Sumar un huevo suelto"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 5, 10, 30].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => {
                          const next = totalEggsCollected + inc;
                          setTrays(Math.floor(next / 30));
                          setLooseEggs(next % 30);
                        }}
                        className="rounded-lg border border-yellow-300 bg-white px-2.5 py-1 text-xs font-semibold text-yellow-800 hover:bg-yellow-100"
                      >
                        +{inc}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setTrays(0);
                        setLooseEggs(0);
                      }}
                      className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      Limpiar
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-yellow-200 pt-2 text-xs">
                    <span className="font-semibold text-slate-700">
                      Total: <strong className="text-base text-slate-900">{totalEggsCollected}</strong> huevos
                      {goodEggs !== totalEggsCollected ? ` (${goodEggs} útiles)` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                      <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                      ~${estimatedEggValue.toLocaleString("es-CO")}
                    </span>
                  </div>
                </div>

                {/* Collapsible details */}
                <button
                  type="button"
                  onClick={() => setShowEggDetails((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  <span>Rotos, incubación o nota opcional</span>
                  {showEggDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showEggDetails && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <Input label="Rotos" type="number" min={0} value={brokenEggs} onChange={(e) => setBrokenEggs(Math.max(0, Number(e.target.value || 0)))} />
                      <Input label="Incubación" type="number" min={0} value={incubEggs} onChange={(e) => setIncubEggs(Math.max(0, Number(e.target.value || 0)))} />
                      <Input label="Autoconsumo" type="number" min={0} value={autoEggs} onChange={(e) => setAutoEggs(Math.max(0, Number(e.target.value || 0)))} />
                      <Input label="Excedente" type="number" min={0} value={surplusEggs} onChange={(e) => setSurplusEggs(Math.max(0, Number(e.target.value || 0)))} />
                    </div>
                    <Input label="Nota breve" value={eggNotes} onChange={(e) => setEggNotes(e.target.value)} placeholder="Ej: recolección de la mañana" />
                  </div>
                )}

                <Button type="button" onClick={() => void submitEggs(false)} disabled={saving} className="w-full py-2.5">
                  {saving ? "Guardando..." : "Guardar huevos"}
                </Button>
              </div>
            )}

            {mode === "alimentacion" && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">Registra alimento entregado sin salir</span>
                  {lastFeedRecord && (
                    <button
                      type="button"
                      onClick={applyLastFeedRecord}
                      className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Igual que ayer ({Number(lastFeedRecord.quantity)} {lastFeedRecord.feedUnit || "kg"})</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FarmLocationSelect
                    value={feedLocationId || effectiveDefaultLocation}
                    onChange={setFeedLocationId}
                    label="Galpón / ubicación"
                    help=""
                  />
                  <Input label="Fecha" type="date" value={feedDate} onChange={(e) => setFeedDate(e.target.value)} />
                </div>

                <Select label="Alimento del inventario" value={feedId} onChange={(e) => setFeedId(e.target.value)}>
                  <option value="">Selecciona un alimento…</option>
                  {feeds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({Number(f.currentStock).toFixed(1)} {f.unit} disp.)
                    </option>
                  ))}
                </Select>

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2.5">
                  <Input
                    label={`Cantidad entregada (${selectedFeedObj?.unit || "kg"})`}
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={feedQty}
                    onChange={(e) => setFeedQty(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[0.5, 1, 5, 10, 25].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => {
                          const base = Number(feedQty || 0);
                          setFeedQty(String(Math.round((base + inc) * 10) / 10));
                        }}
                        className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        +{inc} {selectedFeedObj?.unit || "kg"}
                      </button>
                    ))}
                  </div>
                </div>

                <Input label="Nota breve (opcional)" value={feedNotes} onChange={(e) => setFeedNotes(e.target.value)} placeholder="Ej: ración de la tarde" />

                <Button type="button" onClick={() => void submitFeed()} disabled={saving} className="w-full py-2.5">
                  {saving ? "Guardando..." : "Guardar consumo"}
                </Button>
              </div>
            )}

            {mode === "mortalidad" && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FarmLocationSelect
                    value={mortLocationId || effectiveDefaultLocation}
                    onChange={(loc) => {
                      setMortLocationId(loc);
                      setMortHenId("");
                      setMortRoosterId("");
                      setMortBatchId("");
                    }}
                    label="Ubicación"
                    help=""
                  />
                  <Input label="Fecha" type="date" value={mortDate} onChange={(e) => setMortDate(e.target.value)} />
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Tipo de ave / lote</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MORTALITY_BIRD_TYPES.map((bt) => (
                      <button
                        key={bt.value}
                        type="button"
                        onClick={() => {
                          setMortBirdType(bt.value);
                          setMortHenId("");
                          setMortRoosterId("");
                          setMortBatchId("");
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          mortBirdType === bt.value
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {bt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {mortBirdType === "gallina" && (
                  <Select
                    label="Gallina"
                    value={mortHenId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMortHenId(val);
                      const matched = hens.find((h) => h.id === val);
                      if (matched?.locationId) setMortLocationId(matched.locationId);
                    }}
                  >
                    <option value="">Selecciona una gallina…</option>
                    {activeHens.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.code}{h.breed ? ` · ${h.breed}` : ""}
                      </option>
                    ))}
                  </Select>
                )}

                {mortBirdType === "gallo" && (
                  <Select
                    label="Gallo"
                    value={mortRoosterId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMortRoosterId(val);
                      const matched = roosters.find((r) => r.id === val);
                      if (matched?.locationId) setMortLocationId(matched.locationId);
                    }}
                  >
                    <option value="">Selecciona un gallo…</option>
                    {activeRoosters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code}
                      </option>
                    ))}
                  </Select>
                )}

                {mortBirdType in BATCH_SPECIES_BY_TYPE && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <Select
                        label="Lote"
                        value={mortBatchId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMortBatchId(val);
                          const matched = batches.find((b) => b.id === val);
                          if (matched?.locationId) setMortLocationId(matched.locationId);
                        }}
                      >
                        <option value="">Selecciona un lote…</option>
                        {activeMortBatches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} ({b.currentQuantity} disp.)
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Input label="Cantidad" type="number" min={1} value={mortQty} onChange={(e) => setMortQty(e.target.value)} />
                  </div>
                )}

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Causa (1 toque)</span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {MORTALITY_CAUSES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setMortCause(c.value)}
                        className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
                          mortCause === c.value
                            ? "border-red-500 bg-red-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Input label="Nota breve (opcional)" value={mortNotes} onChange={(e) => setMortNotes(e.target.value)} placeholder="Observación clínica o suceso" />

                <Button type="button" variant="danger" onClick={() => void submitMortality()} disabled={saving} className="w-full py-2.5">
                  {saving ? "Guardando..." : "Registrar baja"}
                </Button>
              </div>
            )}

            {mode === "gasto" && (
              <div className="space-y-3.5">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Categoría</span>
                  <div className="flex flex-wrap gap-1.5">
                    {categoriesList.slice(0, 8).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExpCategory(cat)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          expCategory === cat
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Valor pagado ($)"
                    type="number"
                    min="1"
                    step="100"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="Ej: 85000"
                  />
                  <Input label="Fecha" type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
                </div>

                <Input
                  label="Concepto / qué pagaste"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Ej: Bulto de ponedora, vacunas, transporte..."
                />

                <Input
                  label="Proveedor / a quién pagaste (opcional)"
                  value={expCounterparty}
                  onChange={(e) => setExpCounterparty(e.target.value)}
                  placeholder="Agropecuaria o persona"
                />

                <Button type="button" onClick={() => void submitExpense()} disabled={saving} className="w-full py-2.5">
                  {saving ? "Guardando..." : "Guardar gasto"}
                </Button>
              </div>
            )}

            {mode === "venta" && (
              <div className="space-y-3.5">
                {availableSizes.length > 0 ? (
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">Tamaño disponible</span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSizes.map((item) => (
                        <button
                          key={item.size}
                          type="button"
                          onClick={() => {
                            setSaleSize(item.size);
                            if (item.price) setSalePrice(String(item.price));
                          }}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            saleSize === item.size
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
                          }`}
                        >
                          {item.size}: {item.available} disp.
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Input label="Tamaño de huevo" value={saleSize} onChange={(e) => setSaleSize(e.target.value)} placeholder="Ej: Grande, Extra, Mediano" />
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input label="Huevos" type="number" min={1} value={saleQty} onChange={(e) => setSaleQty(e.target.value)} />
                  <Input label="Precio/u ($)" type="number" min={1} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                  <Input label="Fecha" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { qty: 6, label: "6 huevos" },
                    { qty: 12, label: "1 docena (12)" },
                    { qty: 30, label: "1 cubeta (30)" },
                    { qty: 60, label: "2 cubetas (60)" },
                  ].map((preset) => (
                    <button
                      key={preset.qty}
                      type="button"
                      onClick={() => setSaleQty(String(preset.qty))}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <Input
                  label="Comprador (opcional)"
                  value={saleBuyer}
                  onChange={(e) => setSaleBuyer(e.target.value)}
                  list="quick-capture-buyers"
                  placeholder="Nombre del cliente o tienda"
                />
                <datalist id="quick-capture-buyers">
                  {buyerOptions.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>

                <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                  <span>Total venta:</span>
                  <strong>${(Math.max(0, Number(saleQty || 0)) * Math.max(0, Number(salePrice || 0))).toLocaleString("es-CO")}</strong>
                </div>

                <Button type="button" onClick={() => void submitSale()} disabled={saving} className="w-full py-2.5">
                  {saving ? "Guardando..." : "Registrar venta"}
                </Button>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_VOICE_EVENT));
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Mic className="h-3.5 w-3.5 text-green-700" aria-hidden="true" />
                <span>¿Prefieres dictarlo? Abrir nota de voz</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

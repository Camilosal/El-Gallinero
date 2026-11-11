"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Button, Card, Table, Modal, Input, Select, Textarea, EmptyState, StatCard, Badge } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import KgSaleTab from "./_components/KgSaleTab";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useActionQuery } from "@/lib/useActionQuery";

// ─── Types ───
interface SaleItem {
  id?: string;
  size: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: string;
  presentation: string | null;
}

interface Sale {
  id: string;
  date: string;
  quantity: number;
  pricePerUnit: string;
  totalAmount: string;
  size: string | null;
  presentation: string | null;
  buyer: string | null;
  notes: string | null;
  isCredit?: boolean;
  items: SaleItem[];
}

interface ChickenSale {
  id: string;
  date: string;
  birdType: string;
  quantity: number;
  weightKg: string | null;
  pricePerUnit: string;
  priceMode: string;
  totalAmount: string;
  buyer: string | null;
  presentation: string | null;
  henId: string | null;
  roosterId?: string | null;
  batchId?: string | null;
  isCredit?: boolean;
  dueDate?: string | null;
  notes: string | null;
  hen?: {
    id: string;
    code: string;
    weight: string;
    status: string;
  } | null;
  rooster?: {
    id: string;
    code: string;
    status: string;
  } | null;
  batch?: {
    id: string;
    code: string;
    status: string;
  } | null;
}

interface Hen {
  id: string;
  code: string;
  weight: string;
  status: string;
  birthDate: string;
}

interface Rooster {
  id: string;
  code: string;
  weight: string | null;
  status: string;
}

interface Batch {
  id: string;
  code: string;
  currentQuantity: number;
  status: string;
}

interface InventorySize {
  size: string;
  price: number | null;
  produced: number;
  sold: number;
  available: number;
}

interface SaleFormItem {
  key: string;
  size: string;
  presentations: number;
  presentation: string;
  pricePerUnit: string;
}

const birdTypeLabels: Record<string, string> = {
  gallina_descarte: "🐔 Gallina descarte",
  pollo: "🐓 Pollo",
  gallo: "🐓 Gallo",
  pollito: "🐥 Pollito",
};

type Tab = "huevos" | "aves" | "carne" | "gallinaza";

function parseSalesTab(value: string | null): Tab {
  return value === "huevos" || value === "aves" || value === "carne" || value === "gallinaza"
    ? value
    : "huevos";
}

export default function VentasPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando ventas...</div>}>
      <VentasContent />
    </Suspense>
  );
}

function VentasContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTab = searchParams.get("tab");
  const tab = parseSalesTab(requestedTab);

  const selectTab = (nextTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    params.delete("nuevo");
    router.replace(`/dashboard/finanzas/ventas?${params.toString()}`, { scroll: false });
  };

  // ─── Egg sales state ───
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [error, setError] = useState("");
  const [inventory, setInventory] = useState<InventorySize[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    buyer: "",
    notes: "",
    items: [{ key: "1", size: "", presentations: 1, presentation: "", pricePerUnit: "500" }] as SaleFormItem[],
  });
  const [isCredit, setIsCredit] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [eggSearch, setEggSearch] = useState("");

  // ─── Chicken sales state ───
  const [chickenSales, setChickenSales] = useState<ChickenSale[]>([]);
  const [hens, setHens] = useState<Hen[]>([]);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBirds, setLoadingBirds] = useState(true);
  const [birdModalOpen, setBirdModalOpen] = useState(false);
  const [editingBird, setEditingBird] = useState<ChickenSale | null>(null);
  const [birdError, setBirdError] = useState("");
  const [birdForm, setBirdForm] = useState({
    date: new Date().toISOString().split("T")[0],
    birdType: "gallina_descarte",
    quantity: "1",
    weightKg: "",
    priceMode: "por_ave",
    pricePerUnit: "25000",
    buyer: "",
    presentation: "",
    henId: "",
    roosterId: "",
    batchId: "",
    notes: "",
  });
  const [birdIsCredit, setBirdIsCredit] = useState(false);
  const [birdDueDate, setBirdDueDate] = useState("");
  const [birdSearch, setBirdSearch] = useState("");

  // ─── Catalogs ───
  const { values: buyerOptions } = useCatalog("comprador");
  const { items: sizeOptions } = useCatalog("tamano_huevo");
  const { items: presentOptions } = useCatalog("presentacion_venta");
  const { values: birdTypeOptions } = useCatalog("tipo_ave", ["gallina_descarte", "pollo", "gallo", "pollito"]);
  const saleableSizeOptions = useMemo(() => {
    const bySize = new Map<string, { id: string; value: string; price: string | null }>();
    sizeOptions.forEach((option) => bySize.set(option.value, option));
    inventory.forEach((item) => {
      if (!bySize.has(item.size)) {
        bySize.set(item.size, {
          id: `inventory-${item.size}`,
          value: item.size,
          price: item.price === null ? null : String(item.price),
        });
      }
    });
    return [...bySize.values()];
  }, [inventory, sizeOptions]);

  // ─── Load data ───
  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/finanzas/finanzas/ventas").then((r) => r.json()),
      apiFetch("/api/produccion/huevos/inventario").then((r) => r.json()),
      apiFetch("/api/finanzas/finanzas/ventas-aves").then((r) => r.json()),
      apiFetch("/api/produccion/gallinas").then((r) => r.json()),
      apiFetch("/api/produccion/gallos").then((r) => r.json()),
      apiFetch("/api/produccion/pollos").then((r) => r.json()),
    ]).then(([salesData, invData, birdData, hensData, gallosData, lotesData]) => {
      setSales(salesData);
      setInventory(invData.summary?.sizes || []);
      setChickenSales(Array.isArray(birdData) ? birdData : []);
      setHens(Array.isArray(hensData) ? hensData
        .filter((h: Hen) => h.status === "activa" || h.status === "empollando" || h.status === "recomendada_sacrificio")
        .sort((a: Hen, b: Hen) => Number(b.status === "recomendada_sacrificio") - Number(a.status === "recomendada_sacrificio")) : []);
      setRoosters(Array.isArray(gallosData) ? gallosData.filter((r: Rooster) => r.status === "activo" || r.status === "enfermo") : []);
      setBatches(Array.isArray(lotesData) ? lotesData.filter((b: Batch) => b.status === "activo" || b.status === "listo_sacrificio") : []);
      setLoading(false);
      setLoadingBirds(false);
    }).catch(() => { setLoading(false); setLoadingBirds(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Egg sale helpers ───
  const getItemUnits = (item: SaleFormItem) => presentOptions.find((o) => o.value === item.presentation)?.units ?? 1;
  const getItemEggs = (item: SaleFormItem) => item.presentations * getItemUnits(item);
  const getItemTotal = (item: SaleFormItem) => item.presentations * Number(item.pricePerUnit);
  const getPresentationLabel = (item: SaleFormItem) => {
    if (!item.presentation) return "unid.";
    return item.presentation.toLowerCase();
  };
  const getAvailable = (size: string) => inventory.find((i) => i.size === size)?.available ?? 0;
  const totalEggsAllItems = form.items.reduce((sum, item) => sum + getItemEggs(item), 0);
  const totalAmountAllItems = form.items.reduce((sum, item) => sum + getItemTotal(item), 0);

  // ─── Egg sale CRUD ───
  const openNew = () => {
    setEditing(null);
    setError("");
    setIsCredit(false);
    setDueDate("");
    setForm({
      date: new Date().toISOString().split("T")[0],
      buyer: "",
      notes: "",
      items: [{ key: "1", size: "", presentations: 1, presentation: "", pricePerUnit: "500" }],
    });
    setModalOpen(true);
  };

  const openEdit = (s: Sale) => {
    setEditing(s);
    setError("");
    const editItems: SaleFormItem[] = s.items.length > 0
      ? s.items.map((item, idx) => {
          const units = presentOptions.find((o) => o.value === item.presentation)?.units ?? null;
          const presentations = item.presentation && units && units > 0 && item.quantity % units === 0
            ? item.quantity / units
            : item.quantity;
          return { key: String(idx + 1), size: item.size, presentations, presentation: item.presentation || "", pricePerUnit: String(item.pricePerUnit) };
        })
      : [{ key: "1", size: s.size || "", presentations: 1, presentation: s.presentation || "", pricePerUnit: s.pricePerUnit }];
    setForm({ date: s.date, buyer: s.buyer || "", notes: s.notes || "", items: editItems });
    setModalOpen(true);
  };

  const updateItem = (key: string, changes: Partial<SaleFormItem>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, ...changes };
        if (changes.size) {
          const sizeOpt = saleableSizeOptions.find((o) => o.value === changes.size);
          if (sizeOpt?.price) {
            const units = getItemUnits(updated);
            updated.pricePerUnit = String(Number(sizeOpt.price) * units);
          }
        }
        if (changes.presentation) {
          const sizeOpt = saleableSizeOptions.find((o) => o.value === updated.size);
          const newUnits = presentOptions.find((o) => o.value === changes.presentation)?.units ?? 1;
          if (sizeOpt?.price) {
            updated.pricePerUnit = String(Number(sizeOpt.price) * newUnits);
          }
        }
        return updated;
      }),
    }));
  };

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, { key: String(Date.now()), size: "", presentations: 1, presentation: "", pricePerUnit: "500" }] }));
  };

  const removeItem = (key: string) => {
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((i) => i.key !== key) : f.items }));
  };

  const getRemainingAvailable = (size: string, currentKey?: string) => {
    const base = getAvailable(size);
    const usedByOtherItems = form.items
      .filter((i) => i.size === size && i.key !== currentKey)
      .reduce((sum, i) => sum + getItemEggs(i), 0);
    return base - usedByOtherItems;
  };

  const saveEggSale = async () => {
    setError("");
    for (const item of form.items) {
      if (!item.size) { setError("Selecciona el tamaño del huevo en cada línea"); return; }
      const eggs = getItemEggs(item);
      if (eggs < 1) { setError(`Cantidad inválida para tamaño ${item.size}`); return; }
      const remaining = getRemainingAvailable(item.size, item.key);
      if (eggs > remaining) { setError(`No hay suficientes huevos tamaño ${item.size}. Disponibles: ${remaining}`); return; }
    }
    const payload = {
      date: form.date, buyer: form.buyer || null, notes: form.notes || null,
      isCredit, dueDate: dueDate || null,
      items: form.items.map((item) => ({ size: item.size, quantity: getItemEggs(item), presentations: item.presentations, pricePerUnit: Number(item.pricePerUnit), presentation: item.presentation || null })),
    };
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...payload, id: editing.id } : payload;
    const res = await apiFetch("/api/finanzas/finanzas/ventas", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error || "Error al guardar la venta"); return; }
    setModalOpen(false);
    setIsCredit(false);
    setDueDate("");
    load();
  };

  const removeEggSale = async (id: string) => {
    if (!confirm("¿Eliminar esta venta?")) return;
    await apiFetch(`/api/finanzas/finanzas/ventas?id=${id}`, { method: "DELETE" });
    load();
  };

  // ─── Chicken sale CRUD ───
  const openNewBird = () => {
    setEditingBird(null);
    setBirdError("");
    setBirdIsCredit(false);
    setBirdDueDate("");
    setBirdForm({ date: new Date().toISOString().split("T")[0], birdType: "gallina_descarte", quantity: "1", weightKg: "", priceMode: "por_ave", pricePerUnit: "25000", buyer: "", presentation: "", henId: "", roosterId: "", batchId: "", notes: "" });
    setBirdModalOpen(true);
  };
  useActionQuery(searchParams.get("tab") === "carne" ? null : searchParams.get("nuevo"), {
    "1": () => {
      if (searchParams.get("tab") === "aves") openNewBird();
      else if (searchParams.get("tab") === "huevos") openNew();
    },
  });

  const openEditBird = (s: ChickenSale) => {
    setEditingBird(s);
    setBirdError("");
    setBirdIsCredit(!!s.isCredit);
    setBirdDueDate(s.dueDate || "");
    setBirdForm({ date: s.date, birdType: s.birdType, quantity: String(s.quantity), weightKg: s.weightKg || "", priceMode: s.priceMode, pricePerUnit: s.pricePerUnit, buyer: s.buyer || "", presentation: s.presentation || "", henId: s.henId || "", roosterId: s.roosterId || "", batchId: s.batchId || "", notes: s.notes || "" });
    setBirdModalOpen(true);
  };

  const handleBirdHenSelect = (henId: string) => {
    if (henId) {
      const hen = hens.find((h) => h.id === henId);
      if (hen) {
        setBirdForm({ ...birdForm, birdType: "gallina_descarte", henId, roosterId: "", batchId: "", weightKg: hen.weight, quantity: "1" });
      }
    } else {
      setBirdForm({ ...birdForm, henId: "" });
    }
  };

  const handleBirdRoosterSelect = (roosterId: string) => {
    if (roosterId) {
      const rooster = roosters.find((r) => r.id === roosterId);
      setBirdForm({ ...birdForm, roosterId, henId: "", batchId: "", birdType: "gallo", weightKg: rooster?.weight || "", quantity: "1" });
    } else {
      setBirdForm({ ...birdForm, roosterId: "" });
    }
  };

  const handleBirdBatchSelect = (batchId: string) => {
    if (batchId) {
      const batch = batches.find((b) => b.id === batchId);
      setBirdForm({ ...birdForm, batchId, henId: "", roosterId: "", birdType: "pollo", quantity: String(batch?.currentQuantity || 1) });
    } else {
      setBirdForm({ ...birdForm, batchId: "" });
    }
  };

  const birdTotal = () => {
    const qty = Number(birdForm.quantity) || 0;
    const price = Number(birdForm.pricePerUnit) || 0;
    if (birdForm.priceMode === "por_kg" && birdForm.weightKg) {
      return (price * Number(birdForm.weightKg)).toFixed(0);
    }
    return (price * qty).toFixed(0);
  };

  const saveBirdSale = async () => {
    setBirdError("");
    const qty = Number(birdForm.quantity);
    if (!birdForm.birdType) { setBirdError("Tipo de ave requerido"); return; }
    if (!birdForm.henId && !birdForm.roosterId && !birdForm.batchId) { setBirdError("Debe seleccionar una gallina, un gallo o un lote para descontar del inventario"); return; }
    if (!Number.isSafeInteger(qty) || qty < 1) { setBirdError("La cantidad debe ser un entero mayor que cero"); return; }
    if ((birdForm.henId || birdForm.roosterId) && qty !== 1) { setBirdError("La venta de una gallina o un gallo debe tener cantidad 1"); return; }
    const price = Number(birdForm.pricePerUnit);
    if (!price || price <= 0) { setBirdError("Precio inválido"); return; }

    const payload = {
      date: birdForm.date,
      birdType: birdForm.birdType,
      quantity: qty,
      weightKg: birdForm.weightKg ? Number(birdForm.weightKg) : null,
      priceMode: birdForm.priceMode,
      pricePerUnit: price,
      buyer: birdForm.buyer || null,
      presentation: birdForm.presentation || null,
      notes: birdForm.notes || null,
      isCredit: birdIsCredit,
      dueDate: birdDueDate || null,
      ...(birdForm.henId ? { henId: birdForm.henId } : {}),
      ...(birdForm.roosterId ? { roosterId: birdForm.roosterId } : {}),
      ...(birdForm.batchId ? { batchId: birdForm.batchId } : {}),
      ...(editingBird ? { id: editingBird.id } : {}),
    };

    const method = editingBird ? "PUT" : "POST";
    const res = await apiFetch("/api/finanzas/finanzas/ventas-aves", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setBirdError(data.error || "Error al guardar"); return; }
    setBirdModalOpen(false);
    setBirdIsCredit(false);
    setBirdDueDate("");
    load();
  };

  const removeBirdSale = async (id: string) => {
    if (!confirm("¿Eliminar esta venta?")) return;
    await apiFetch(`/api/finanzas/finanzas/ventas-aves?id=${id}`, { method: "DELETE" });
    load();
  };

  // ─── Stats ───
  const totalRevenue = sales.reduce((s, r) => s + Number(r.totalAmount), 0);
  const totalEggs = sales.reduce((s, r) => s + r.quantity, 0);
  const avgPrice = totalEggs > 0 ? (totalRevenue / totalEggs).toFixed(0) : "0";

  const totalBirdRevenue = chickenSales.reduce((s, r) => s + Number(r.totalAmount), 0);
  const totalBirds = chickenSales.reduce((s, r) => s + r.quantity, 0);
  const totalBirdWeight = chickenSales.reduce((s, r) => s + (Number(r.weightKg) || 0), 0);

  // Chart data (combined)
  const chartMap = new Map<string, { huevos: number; aves: number }>();
  sales.forEach((s) => {
    const key = new Date(s.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
    const prev = chartMap.get(key) || { huevos: 0, aves: 0 };
    chartMap.set(key, { ...prev, huevos: prev.huevos + Number(s.totalAmount) });
  });
  chickenSales.forEach((s) => {
    const key = new Date(s.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
    const prev = chartMap.get(key) || { huevos: 0, aves: 0 };
    chartMap.set(key, { ...prev, aves: prev.aves + Number(s.totalAmount) });
  });
  const chartData = Array.from(chartMap.entries()).map(([f, v]) => ({ fecha: f, ...v })).reverse();

  const formatSaleItems = (s: Sale) => {
    if (s.items.length > 0) return s.items.map((i) => `${i.quantity} ${i.size}`).join(", ");
    return `${s.quantity} ${s.size || "—"}`;
  };

  const filteredSales = useMemo(() => {
    if (!eggSearch.trim()) return sales;
    return sales.filter((sale) => {
      const detail =
        sale.items.length > 0
          ? sale.items
              .map((item) => `${item.quantity} ${item.size} ${item.presentation ?? ""}`)
              .join(" ")
          : `${sale.quantity} ${sale.size ?? ""}`;
      return matchesTextQuery(eggSearch, [
        sale.date,
        new Date(sale.date + "T12:00:00").toLocaleDateString("es"),
        detail,
        sale.totalAmount,
        sale.buyer,
        sale.notes,
        sale.isCredit ? "credito" : "",
      ]);
    });
  }, [sales, eggSearch]);

  const filteredChickenSales = useMemo(() => {
    if (!birdSearch.trim()) return chickenSales;
    return chickenSales.filter((sale) =>
      matchesTextQuery(birdSearch, [
        sale.date,
        new Date(sale.date + "T12:00:00").toLocaleDateString("es"),
        sale.hen?.code,
        sale.rooster?.code,
        sale.batch?.code,
        birdTypeLabels[sale.birdType] || sale.birdType,
        sale.weightKg,
        sale.pricePerUnit,
        sale.priceMode === "por_kg" ? "por kg" : "por ave",
        sale.totalAmount,
        sale.buyer,
        sale.presentation,
        sale.notes,
      ]),
    );
  }, [chickenSales, birdSearch]);

  return (
    <div>
      <PageHeader
        title="💰 Ventas"
        description="Gestión de ventas de huevos, aves, carne y gallinaza"
        help="Registra todas las ventas del gallinero organizadas por tipo.\n\n• Huevos: venta de huevos por tamaño. El stock se descuenta automáticamente del inventario.\n• Aves: venta de gallinas, gallos o lotes completos.\n• Carne: venta de carne producida del sacrificio.\n• Gallinaza: venta de abono.\n• Puedes registrar ventas a crédito y gestionar cobros desde Cuentas."
        actions={
          <div className="flex gap-2">
            {tab === "huevos" && <Button onClick={openNew}>+ Nueva Venta de Huevos</Button>}
            {tab === "aves" && <Button onClick={openNewBird}>+ Nueva Venta de Aves</Button>}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => selectTab("huevos")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "huevos" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🥚 Huevos
        </button>
        <button onClick={() => selectTab("aves")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "aves" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🐔 Aves
        </button>
        <button onClick={() => selectTab("carne")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "carne" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🍗 Carne
        </button>
        <button onClick={() => selectTab("gallinaza")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "gallinaza" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🌱 Gallinaza
        </button>
      </div>

      {/* ─── TAB: HUEVOS ─── */}
      {tab === "huevos" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="💵" label="Ingresos Huevos" value={`$${totalRevenue.toLocaleString()}`} color="green" />
            <StatCard icon="🥚" label="Huevos Vendidos" value={totalEggs} color="yellow" />
            <StatCard icon="📊" label="Precio Prom./Huevo" value={`$${avgPrice}`} color="blue" />
            <StatCard icon="🛒" label="Total Ventas" value={sales.length} color="purple" />
          </div>

          {inventory.some((i) => i.available > 0) && (
            <Card className="mb-6">
              <h3 className="font-semibold text-slate-700 mb-3">📦 Inventario Disponible</h3>
              <div className="flex flex-wrap gap-3">
                {inventory.filter((i) => i.available > 0).map((i) => (
                  <div key={i.size} className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm text-green-700 font-medium">{i.size}</span>
                    <span className="ml-2 text-lg font-bold text-green-800">{i.available}</span>
                    <span className="text-xs text-green-600 ml-1">uds</span>
                    {i.price && <span className="text-xs text-green-600 ml-2">${i.price}/u</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {chartData.length > 0 && (
            <Card className="mb-6">
              <h3 className="font-semibold text-slate-700 mb-4">📊 Ingresos por Ventas</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="huevos" fill="#eab308" radius={[4, 4, 0, 0]} name="Huevos" stackId="a" />
                  <Bar dataKey="aves" fill="#22c55e" radius={[4, 4, 0, 0]} name="Aves" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <TableSearch
              value={eggSearch}
              onChange={setEggSearch}
              placeholder="Buscar por fecha, detalle o comprador..."
              resultCount={filteredSales.length}
              totalCount={sales.length}
              className="mb-4"
            />
            {loading ? (
              <p className="text-center py-8 text-slate-400">Cargando...</p>
            ) : filteredSales.length === 0 ? (
              <EmptyState
                icon="🥚"
                message={
                  eggSearch.trim()
                    ? "No hay ventas que coincidan con la búsqueda"
                    : "No hay ventas de huevos registradas"
                }
              />
            ) : (
              <Table headers={["Fecha", "Detalle", "Total", "Comprador", ""]}>
                {filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{new Date(s.date + "T12:00:00").toLocaleDateString("es")}</td>
                    <td className="px-4 py-3 font-semibold text-sm">{formatSaleItems(s)}</td>
                    <td className="px-4 py-3 font-bold text-green-600">${Number(s.totalAmount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      {s.buyer || "—"}
                      {s.isCredit && <Badge color="orange">Crédito</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => removeEggSale(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ─── TAB: AVES ─── */}
      {tab === "aves" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="💵" label="Ingresos Aves" value={`$${totalBirdRevenue.toLocaleString()}`} color="green" />
            <StatCard icon="🐔" label="Aves Vendidas" value={totalBirds} color="yellow" />
            <StatCard icon="⚖️" label="Peso Total" value={`${totalBirdWeight.toFixed(1)} kg`} color="blue" />
            <StatCard icon="🛒" label="Total Ventas" value={chickenSales.length} color="purple" />
          </div>

          {chartData.length > 0 && (
            <Card className="mb-6">
              <h3 className="font-semibold text-slate-700 mb-4">📊 Ingresos por Ventas</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="huevos" fill="#eab308" radius={[4, 4, 0, 0]} name="Huevos" stackId="a" />
                  <Bar dataKey="aves" fill="#22c55e" radius={[4, 4, 0, 0]} name="Aves" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <TableSearch
              value={birdSearch}
              onChange={setBirdSearch}
              placeholder="Buscar por fecha, ave, tipo o comprador..."
              resultCount={filteredChickenSales.length}
              totalCount={chickenSales.length}
              className="mb-4"
            />
            {loadingBirds ? (
              <p className="text-center py-8 text-slate-400">Cargando...</p>
            ) : filteredChickenSales.length === 0 ? (
              <EmptyState
                icon="🐔"
                message={
                  birdSearch.trim()
                    ? "No hay ventas que coincidan con la búsqueda"
                    : "No hay ventas de aves registradas"
                }
              />
            ) : (
              <Table headers={["Fecha", "Ave", "Tipo", "Peso", "Precio", "Total", "Comprador", ""]}>
                {filteredChickenSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{new Date(s.date + "T12:00:00").toLocaleDateString("es")}</td>
                    <td className="px-4 py-3">
                      {s.hen ? (
                        <span className="text-sm font-medium text-blue-600">🐔 {s.hen.code}</span>
                      ) : s.rooster ? (
                        <span className="text-sm font-medium text-red-600">🐓 {s.rooster.code}</span>
                      ) : s.batch ? (
                        <span className="text-sm font-medium text-orange-600">📦 {s.batch.code}</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{birdTypeLabels[s.birdType] || s.birdType}</td>
                    <td className="px-4 py-3 text-sm">{s.weightKg ? `${s.weightKg} kg` : "—"}</td>
                    <td className="px-4 py-3 text-sm">${Number(s.pricePerUnit).toLocaleString()}/{s.priceMode === "por_kg" ? "kg" : "ave"}</td>
                    <td className="px-4 py-3 font-bold text-green-600">${Number(s.totalAmount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{s.buyer || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEditBird(s)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => removeBirdSale(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ─── TAB: CARNE ─── */}
      {tab === "carne" && (
        <KgSaleTab
          apiEndpoint="/api/produccion/carne/ventas"
          labels={{
            emptyIcon: "🍗",
            emptyMessage: "No hay ventas de carne registradas",
            revenueLabel: "Ingresos Carne",
            kgLabel: "Total Kg Vendidos",
            newButton: "+ Nueva Venta de Carne",
            modalTitleNew: "🍗 Nueva Venta de Carne",
            modalTitleEdit: "✏️ Editar Venta de Carne",
            quantityLabel: "Cantidad (kg)",
            priceLabel: "Precio por kg ($)",
            tableHeaders: ["Fecha", "Cantidad", "Precio/kg", "Total", "Comprador", ""],
          }}
        />
      )}

      {/* ─── TAB: GALLINAZA ─── */}
      {tab === "gallinaza" && (
        <KgSaleTab
          apiEndpoint="/api/produccion/gallinaza/ventas"
          labels={{
            emptyIcon: "🌱",
            emptyMessage: "No hay ventas de gallinaza registradas",
            revenueLabel: "Ingresos Gallinaza",
            kgLabel: "Total Kg Vendidos",
            newButton: "+ Nueva Venta de Gallinaza",
            modalTitleNew: "🌱 Nueva Venta de Gallinaza",
            modalTitleEdit: "✏️ Editar Venta de Gallinaza",
            quantityLabel: "Cantidad (kg)",
            priceLabel: "Precio por kg ($)",
            tableHeaders: ["Fecha", "Cantidad", "Precio/kg", "Total", "Comprador", ""],
          }}
        />
      )}

      {/* ─── Modal: Egg Sale ─── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "✏️ Editar Venta de Huevos" : "🥚 Nueva Venta de Huevos"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Comprador" value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} placeholder="Nombre del cliente" list="catalog-compradores" />
          </div>
          <datalist id="catalog-compradores">
            {buyerOptions.map((b) => <option key={b} value={b} />)}
          </datalist>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isCredit" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} className="rounded" />
            <label htmlFor="isCredit" className="text-sm font-medium text-gray-700">Venta a crédito</label>
          </div>
          {isCredit && (
            <div>
              <label className="text-sm font-medium text-gray-700">Fecha vencimiento</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Tamaños y cantidades</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline font-medium">+ Agregar tamaño</button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, idx) => {
                const eggs = getItemEggs(item);
                const remaining = item.size ? getRemainingAvailable(item.size, item.key) : 0;
                const exceeds = item.size && eggs > remaining;
                const units = getItemUnits(item);
                const catalogPrice = saleableSizeOptions.find((o) => o.value === item.size)?.price
                  ? Number(saleableSizeOptions.find((o) => o.value === item.size)!.price)
                  : null;

                return (
                  <div key={item.key} className={`p-3 rounded-lg border ${exceeds ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">Tamaño {idx + 1}</span>
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.key)} className="text-xs text-red-500 hover:underline">Quitar</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select label="Tamaño" value={item.size} onChange={(e) => updateItem(item.key, { size: e.target.value })}>
                        <option value="">— Selecciona —</option>
                        {saleableSizeOptions.map((o) => (
                          <option key={o.id} value={o.value}>{o.value}{o.price ? ` ($${Number(o.price).toLocaleString()})` : ""}</option>
                        ))}
                      </Select>
                      <div>
                        <Input label="Cantidad (presentaciones)" type="number" min="1" value={item.presentations} onChange={(e) => updateItem(item.key, { presentations: parseInt(e.target.value) || 0 })} />
                        <div className="flex flex-wrap gap-1 mt-1">
                          {[1, 2, 3, 5, 10].map((n) => (
                            <button key={n} type="button" onClick={() => updateItem(item.key, { presentations: n })} className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${item.presentations === n ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>{n}</button>
                          ))}
                        </div>
                      </div>
                      <Select label="Presentación" value={item.presentation} onChange={(e) => updateItem(item.key, { presentation: e.target.value })}>
                        <option value="">Unidad (1)</option>
                        {item.presentation && !presentOptions.some((o) => o.value === item.presentation) && (
                          <option value={item.presentation}>{item.presentation}</option>
                        )}
                        {presentOptions.map((o) => (
                          <option key={o.id} value={o.value}>{o.value} ({o.units ?? 1} uds)</option>
                        ))}
                      </Select>
                      <div>
                        <Input label={`Precio por ${getPresentationLabel(item)} ($)`} type="number" step="1" value={item.pricePerUnit} onChange={(e) => updateItem(item.key, { pricePerUnit: e.target.value })} />
                        {catalogPrice !== null && Number(item.pricePerUnit) !== catalogPrice && (
                          <button type="button" onClick={() => updateItem(item.key, { pricePerUnit: String(catalogPrice) })} className="text-xs text-blue-600 hover:underline mt-1">Usar precio catálogo: ${catalogPrice}/unid.</button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-slate-600">
                        = <strong>{eggs}</strong> huevos ({item.presentations} {getPresentationLabel(item)} × {units} uds) → <strong>${getItemTotal(item).toLocaleString()}</strong>
                      </span>
                      {item.size && (
                        <span className={`text-xs font-medium ${exceeds ? "text-red-600" : "text-green-600"}`}>
                          Disp: {remaining} {exceeds && "⚠️ Excede disponible"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
            <p>🥚 Total de huevos: <strong className="text-lg">{totalEggsAllItems.toLocaleString()}</strong></p>
            <p className="mt-1">💵 Total de la venta: <strong className="text-xl">${totalAmountAllItems.toLocaleString()}</strong></p>
            {totalEggsAllItems >= 12 && (
              <p className="mt-1 text-xs">≈ ${Math.round(totalAmountAllItems / totalEggsAllItems * 12).toLocaleString()} por docena</p>
            )}
          </div>

          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={saveEggSale} disabled={totalEggsAllItems < 1 || form.items.some((i) => !i.size) || form.items.some((i) => i.size && getItemEggs(i) > getRemainingAvailable(i.size, i.key))}>
              {editing ? "Actualizar Venta" : "Registrar Venta"}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Modal: Bird Sale ─── */}
      <Modal open={birdModalOpen} onClose={() => setBirdModalOpen(false)} title={editingBird ? "✏️ Editar Venta de Aves" : "🐔 Nueva Venta de Aves"}>
        <div className="space-y-4">
          {birdError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{birdError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={birdForm.date} onChange={(e) => setBirdForm({ ...birdForm, date: e.target.value })} />
            <Select label="Tipo de ave" value={birdForm.birdType} onChange={(e) => setBirdForm({ ...birdForm, birdType: e.target.value })}>
              {birdTypeOptions.map((t) => (
                <option key={t} value={t}>{birdTypeLabels[t] || t}</option>
              ))}
            </Select>
          </div>
          <Select label="Gallina" value={birdForm.henId} onChange={(e) => handleBirdHenSelect(e.target.value)}>
            <option value="">— Sin seleccionar —</option>
            {hens.map((h) => (
              <option key={h.id} value={h.id}>🐔 {h.code} — {h.weight} kg{h.status === "recomendada_sacrificio" ? " ⚠️ Recomendada sacrificio" : ""}</option>
            ))}
          </Select>
          {birdForm.henId && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              ℹ️ Se seleccionó la gallina <strong>{hens.find((h) => h.id === birdForm.henId)?.code}</strong>. El peso se pre-llenó con su peso actual.
            </div>
          )}
          <Select label="Gallo" value={birdForm.roosterId} onChange={(e) => handleBirdRoosterSelect(e.target.value)}>
            <option value="">— Sin gallo —</option>
            {roosters.map((r) => (
              <option key={r.id} value={r.id}>🐓 {r.code}{r.weight ? ` — ${r.weight} kg` : ""}</option>
            ))}
          </Select>
          <Select label="Lote de pollos" value={birdForm.batchId} onChange={(e) => handleBirdBatchSelect(e.target.value)}>
            <option value="">— Sin lote —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>🐤 {b.code} — {b.currentQuantity} disponibles{b.status === "listo_sacrificio" ? " ✅ Listo" : ""}</option>
            ))}
          </Select>
          {!birdForm.henId && !birdForm.roosterId && !birdForm.batchId && (
            <p className="text-xs text-slate-500">Seleccione una gallina, un gallo o un lote (obligatorio para descontar del inventario).</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad (aves)" type="number" min="1" value={birdForm.quantity} onChange={(e) => setBirdForm({ ...birdForm, quantity: e.target.value })} />
            <Input label="Peso total (kg)" type="number" step="0.1" value={birdForm.weightKg} onChange={(e) => setBirdForm({ ...birdForm, weightKg: e.target.value })} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Precio por" value={birdForm.priceMode} onChange={(e) => setBirdForm({ ...birdForm, priceMode: e.target.value })}>
              <option value="por_ave">Por ave</option>
              <option value="por_kg">Por kg</option>
            </Select>
            <Input label={`Precio ($ ${birdForm.priceMode === "por_kg" ? "/kg" : "/ave"})`} type="number" step="1" value={birdForm.pricePerUnit} onChange={(e) => setBirdForm({ ...birdForm, pricePerUnit: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Comprador" value={birdForm.buyer} onChange={(e) => setBirdForm({ ...birdForm, buyer: e.target.value })} placeholder="Nombre del cliente" list="catalog-compradores-bird" />
            <Input label="Presentación" value={birdForm.presentation} onChange={(e) => setBirdForm({ ...birdForm, presentation: e.target.value })} placeholder="Ej: entera, despresada, por kg" />
          </div>
          <datalist id="catalog-compradores-bird">
            {buyerOptions.map((b) => <option key={b} value={b} />)}
          </datalist>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="birdIsCredit" checked={birdIsCredit} onChange={(e) => setBirdIsCredit(e.target.checked)} className="rounded" />
            <label htmlFor="birdIsCredit" className="text-sm font-medium text-gray-700">Venta a crédito</label>
          </div>
          {birdIsCredit && (
            <div>
              <label className="text-sm font-medium text-gray-700">Fecha vencimiento</label>
              <input type="date" value={birdDueDate} onChange={(e) => setBirdDueDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500" />
            </div>
          )}

          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
            <p>🐔 Total aves: <strong className="text-lg">{birdForm.quantity}</strong></p>
            {birdForm.weightKg && <p>Peso: <strong>{birdForm.weightKg} kg</strong></p>}
            <p className="mt-1">💵 Total de la venta: <strong className="text-xl">${birdTotal()}</strong></p>
          </div>

          <Textarea label="Notas" value={birdForm.notes} onChange={(e) => setBirdForm({ ...birdForm, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={saveBirdSale} disabled={!birdForm.henId && !birdForm.roosterId && !birdForm.batchId}>
              {editingBird ? "Actualizar Venta" : "Registrar Venta"}
            </Button>
            <Button variant="secondary" onClick={() => setBirdModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

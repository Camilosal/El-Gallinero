"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, Egg, Package, PawPrint, ShoppingCart, Sprout, TrendingDown, Wheat, Wrench } from "lucide-react";
import { PageHeader, Card, Table, Badge, StatCard, EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { feedCategoryLabel, isPurchasedFeedCategory } from "@/lib/feed-classification";

interface FoodItem {
  feedId: string;
  name: string;
  category: string;
  feedType: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  estimatedValue: number;
  isLow: boolean;
}

interface SupplyItem {
  supplyId: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  estimatedValue: number;
  isLow: boolean;
  supplier: string | null;
  expiryDate: string | null;
}

interface MeatItem {
  id: string;
  date: string;
  source: string;
  birdType: string;
  species: string;
  quantityKg: number;
  availableKg: number;
  estimatedPriceKg: number;
  estimatedValue: number;
}

interface EggSize {
  size: string;
  price: number | null;
  available: number;
  produced: number;
  sold: number;
  value: number;
}

interface BirdsData {
  hens: {
    active: number;
    laying: number;
    broody: number;
    sick: number;
    discard: number;
    recommendedSlaughter: number;
    sold: number;
    slaughtered: number;
    dead: number;
    total: number;
  };
  roosters: { active: number; sick: number; sold: number; slaughtered: number; dead: number; total: number };
  batches: { batchId: string; code: string; breed: string; currentQuantity: number; startDate: string; avgWeightKg: number }[];
  totalBirdsInProduction: number;
  totalBatches: number;
  totalAnimals: number;
  totalBirds: number;
  species: { species: string; label: string; icon: string; count: number }[];
}

interface ConsolidatedData {
  generatedAt: string;
  periodDays: number;
  summary: {
    totalFeeds: number;
    lowStockFeeds: number;
    totalHensActive: number;
    totalHensLaying: number;
    totalHensRegistered: number;
    totalRoostersActive: number;
    totalAnimalsActive: number;
    totalBirdsActive: number;
    totalEggsAvailable: number;
    totalManureKg: number;
    totalValue: number;
    foodValue: number;
    eggValue: number;
    birdsValue: number;
    totalBirdsWeightKg: number;
    totalSupplies: number;
    lowStockSupplies: number;
    totalMeatKg: number;
    suppliesValue: number;
    meatValue: number;
    manureValue: number;
    totalDeaths: number;
  };
  foods: FoodItem[];
  eggs: EggSize[];
  birds: BirdsData;
  supplies: SupplyItem[];
  meat: MeatItem[];
  mortality: { byCause: Record<string, number>; totalDeaths: number };
  manure: { currentStockKg: number; lastAccumulatedDate: string | null };
  movements: {
    entriesByType: Record<string, number>;
    exitsByType: Record<string, number>;
    totalEntries: number;
    totalExits: number;
  };
}

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

const COLORS = ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#a855f7", "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#64748b"];

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtKg = (n: number) => `${Math.round(n).toLocaleString()} kg`;

export default function BalancePage() {
  const [data, setData] = useState<ConsolidatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [foodSearch, setFoodSearch] = useState("");
  const [supplySearch, setSupplySearch] = useState("");
  const [eggSearch, setEggSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [meatSearch, setMeatSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/inventarios/huevos/consolidado?days=${period}`);
        const result = await res.json();
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const entryChart = data
    ? Object.entries(data.movements.entriesByType).map(([k, v]) => ({ name: movementTypeLabels[k] || k, value: Math.round(v * 100) / 100 }))
    : [];
  const exitChart = data
    ? Object.entries(data.movements.exitsByType).map(([k, v]) => ({ name: movementTypeLabels[k] || k, value: Math.round(v * 100) / 100 }))
    : [];

  const filteredFoods = useMemo(() => {
    const foods = data?.foods ?? [];
    if (!foodSearch.trim()) return foods;
    return foods.filter((food) =>
      matchesTextQuery(foodSearch, [
        food.name,
        food.category,
        food.feedType,
        food.unit,
        food.currentStock,
        food.minStock,
        food.costPerUnit,
        food.isLow ? "stock bajo" : "",
      ]),
    );
  }, [data, foodSearch]);

  const filteredSupplies = useMemo(() => {
    const supplies = data?.supplies ?? [];
    if (!supplySearch.trim()) return supplies;
    return supplies.filter((supply) =>
      matchesTextQuery(supplySearch, [
        supply.name,
        supply.category,
        supply.unit,
        supply.currentStock,
        supply.minStock,
        supply.supplier,
        supply.expiryDate,
        supply.isLow ? "stock bajo" : "",
      ]),
    );
  }, [data, supplySearch]);

  const filteredEggs = useMemo(() => {
    const eggs = data?.eggs ?? [];
    if (!eggSearch.trim()) return eggs;
    return eggs.filter((egg) =>
      matchesTextQuery(eggSearch, [
        egg.size,
        egg.price,
        egg.produced,
        egg.sold,
        egg.available,
        egg.value,
      ]),
    );
  }, [data, eggSearch]);

  const filteredBatches = useMemo(() => {
    const batches = data?.birds.batches ?? [];
    if (!batchSearch.trim()) return batches;
    return batches.filter((batch) =>
      matchesTextQuery(batchSearch, [
        batch.code,
        batch.breed,
        batch.currentQuantity,
        batch.startDate,
        batch.avgWeightKg,
      ]),
    );
  }, [data, batchSearch]);

  const filteredMeat = useMemo(() => {
    const meat = data?.meat ?? [];
    if (!meatSearch.trim()) return meat;
    return meat.filter((item) =>
      matchesTextQuery(meatSearch, [
        item.date,
        item.source,
        item.birdType,
        item.species,
        item.quantityKg,
        item.availableKg,
        item.estimatedPriceKg,
        item.estimatedValue,
      ]),
    );
  }, [data, meatSearch]);

  return (
    <div>
      <PageHeader
        title="Inventarios y Valorización"
        description="Todo el inventario del gallinero y su valor: animales, huevos, carne, gallinaza, alimentos e insumos."
        help="Esta es la vista completa de existencias para valorizar la granja. Incluye animales en pie (gallinas, gallos, pollos, codornices, patos y conejos), huevos disponibles, carne, gallinaza, alimentos e insumos. El valor total suma todas las categorías con los precios de Catálogos y los costos registrados. Los indicadores en rojo señalan stock bajo. Usa los accesos rápidos para gestionar cada categoría y este balance para ver el capital invertido en inventario."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/dashboard/animales" className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100">
          <PawPrint className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Animales</span>
        </Link>
        <Link href="/dashboard/inventarios/huevos" className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-700 hover:bg-yellow-100">
          <Egg className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Huevos</span>
        </Link>
        <Link href="/dashboard/inventarios/carne" className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          <AppIcon icon="meat" className="w-3.5 h-3.5" />
          <span>Carne</span>
        </Link>
        <Link href="/dashboard/inventarios/gallinaza" className="inline-flex items-center gap-1.5 rounded-full bg-lime-50 px-3 py-1.5 text-xs font-semibold text-lime-700 hover:bg-lime-100">
          <Sprout className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Gallinaza</span>
        </Link>
        <Link href="/dashboard/inventarios/alimentacion" className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
          <Wheat className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Alimentos</span>
        </Link>
        <Link href="/dashboard/inventarios/insumos" className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100">
          <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Insumos</span>
        </Link>
      </div>

      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Período de movimientos:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : !data ? (
        <Card><EmptyState icon="scale" message="No se pudo cargar el balance" /></Card>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="money" label="Valor Total Inventario" value={fmtMoney(data.summary.totalValue)} color="green" />
            <StatCard icon="wheat" label="Alimentos" value={`${data.summary.totalFeeds} (${data.summary.lowStockFeeds} bajos)`} color="blue" />
            <StatCard icon="paw" label="Animales en Inventario" value={data.summary.totalAnimalsActive} color="yellow" />
            <StatCard icon="egg" label="Huevos Disponibles" value={data.summary.totalEggsAvailable} color="purple" />
          </div>

          {/* Desglose de valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><Wheat className="w-4 h-4 text-amber-600" aria-hidden="true" /><span>Valor en Alimentos</span></p>
              <p className="text-2xl font-bold text-blue-600">{fmtMoney(data.summary.foodValue)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><Egg className="w-4 h-4 text-amber-500" aria-hidden="true" /><span>Valor en Huevos</span></p>
              <p className="text-2xl font-bold text-purple-600">{fmtMoney(data.summary.eggValue)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><PawPrint className="w-4 h-4 text-orange-600" aria-hidden="true" /><span>Valor Animales en Pie</span></p>
              <p className="text-2xl font-bold text-orange-600">{fmtMoney(data.summary.birdsValue)}</p>
              <p className="text-xs text-slate-400">{data.summary.totalBirdsWeightKg} kg en pie, valorados con precios de Catálogos</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><Wrench className="w-4 h-4 text-cyan-600" aria-hidden="true" /><span>Valor en Insumos</span></p>
              <p className="text-2xl font-bold text-cyan-600">{fmtMoney(data.summary.suppliesValue)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><AppIcon icon="meat" className="w-4 h-4 text-red-600" /><span>Valor en Carne</span></p>
              <p className="text-2xl font-bold text-red-600">{fmtMoney(data.summary.meatValue)}</p>
              <p className="text-xs text-slate-400">{data.summary.totalMeatKg} kg disponibles · precio estimado por especie</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><Sprout className="w-4 h-4 text-green-600" aria-hidden="true" /><span>Valor Gallinaza</span></p>
              <p className="text-2xl font-bold text-green-600">{fmtMoney(data.summary.manureValue)}</p>
              <p className="text-xs text-slate-400">{fmtKg(data.summary.totalManureKg)} en stock</p>
            </Card>
          </div>

          {/* Alimentos */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Wheat className="w-4 h-4 text-amber-600" aria-hidden="true" />
              <span>Inventario de Alimentos</span>
            </h3>
            <TableSearch
              value={foodSearch}
              onChange={setFoodSearch}
              placeholder="Buscar por alimento, categoría o stock..."
              resultCount={filteredFoods.length}
              totalCount={data.foods.length}
              className="mb-4"
            />
            {filteredFoods.length === 0 ? (
              <EmptyState
                icon="wheat"
                message={
                  foodSearch.trim()
                    ? "No hay alimentos que coincidan con la búsqueda"
                    : "No hay alimentos registrados"
                }
              />
            ) : (
              <Table headers={["Alimento", "Categoría", "Stock", "Mínimo", "Costo/Unidad", "Valor Estimado"]}>
                {filteredFoods.map((f) => (
                  <tr key={f.feedId} className={f.isLow ? "bg-red-50" : "hover:bg-slate-50"}>
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge color={isPurchasedFeedCategory(f.category) ? "blue" : "green"}>
                        <span className="inline-flex items-center gap-1">
                          {isPurchasedFeedCategory(f.category) ? (
                            <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Sprout className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{feedCategoryLabel(f.category)}</span>
                        </span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold">{f.currentStock} {f.unit}</td>
                    <td className="px-4 py-3 text-sm">{f.minStock} {f.unit}</td>
                    <td className="px-4 py-3">${f.costPerUnit.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{fmtMoney(f.estimatedValue)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          {/* Insumos */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-slate-600" aria-hidden="true" />
              <span>Insumos</span>
            </h2>
            <div className="flex gap-4 mb-3 text-sm">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">{data.supplies.length} items</span>
              <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">Valor: ${data.summary.suppliesValue?.toLocaleString()}</span>
              {data.summary.lowStockSupplies > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{data.summary.lowStockSupplies} stock bajo</span>
                </span>
              )}
            </div>
            <TableSearch
              value={supplySearch}
              onChange={setSupplySearch}
              placeholder="Buscar por nombre, categoría o proveedor..."
              resultCount={filteredSupplies.length}
              totalCount={data.supplies.length}
              className="mb-3"
            />
            {filteredSupplies.length === 0 ? (
              <EmptyState
                icon="wrench"
                message={
                  supplySearch.trim()
                    ? "No hay insumos que coincidan con la búsqueda"
                    : "No hay insumos registrados"
                }
              />
            ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="py-2">Nombre</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Valor</th>
              </tr></thead>
              <tbody>
                {filteredSupplies.map((s) => (
                  <tr key={s.supplyId} className={`border-b ${s.isLow ? 'bg-red-50' : ''}`}>
                    <td className="py-2 font-medium">{s.name}</td>
                    <td>{s.category}</td>
                    <td>{s.currentStock} {s.unit}</td>
                    <td>{s.minStock}</td>
                    <td>${s.estimatedValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          {/* Huevos */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Egg className="w-4 h-4 text-amber-500" aria-hidden="true" />
              <span>Huevos Disponibles por Tamaño (PEPS)</span>
            </h3>
            <TableSearch
              value={eggSearch}
              onChange={setEggSearch}
              placeholder="Buscar por tamaño o disponibilidad..."
              resultCount={filteredEggs.length}
              totalCount={data.eggs.length}
              className="mb-4"
            />
            {filteredEggs.length === 0 ? (
              <EmptyState
                icon="egg"
                message={
                  eggSearch.trim()
                    ? "No hay tamaños que coincidan con la búsqueda"
                    : "No hay producción de huevos registrada"
                }
              />
            ) : (
              <Table headers={["Tamaño", "Precio", "Producido", "Vendido", "Disponible", "Valor"]}>
                {filteredEggs.map((s) => (
                  <tr key={s.size} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><Badge color="green">{s.size}</Badge></td>
                    <td className="px-4 py-3">{s.price != null ? `$${s.price.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">{s.produced}</td>
                    <td className="px-4 py-3 text-slate-500">{s.sold}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{s.available}</td>
                    <td className="px-4 py-3 font-semibold">{fmtMoney(s.value)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          {/* Aves */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <PawPrint className="w-4 h-4 text-slate-600" aria-hidden="true" />
                    <span>Animales por Estado</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Inventario vigente: animales no vendidos, faenados ni muertos.</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-indigo-700">{data.birds.totalAnimals}</p>
                  <p className="text-xs text-slate-500">animales en inventario</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {data.birds.species.map((s) => (
                  <div key={s.species} className="rounded-lg bg-slate-50 p-2 text-center">
                    <div className={`mx-auto flex justify-center ${s.count > 0 ? "text-slate-700" : "opacity-40 text-slate-400"}`}>
                      <AppIcon icon={s.icon} className="w-5 h-5" />
                    </div>
                    <p className={`mt-1 text-lg font-bold ${s.count > 0 ? "text-slate-800" : "text-slate-300"}`}>{s.count}</p>
                    <p className={`text-[11px] ${s.count > 0 ? "text-slate-600" : "text-slate-400"}`}>{s.label}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estado de las gallinas ({data.birds.hens.active} en inventario)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="p-3 bg-emerald-50 rounded-lg"><p className="text-slate-500 text-xs">En postura</p><p className="text-xl font-bold text-emerald-700">{data.birds.hens.laying}</p></div>
                <div className="p-3 bg-purple-50 rounded-lg"><p className="text-slate-500 text-xs">Empollando</p><p className="text-xl font-bold text-purple-700">{data.birds.hens.broody}</p></div>
                <div className="p-3 bg-yellow-50 rounded-lg"><p className="text-slate-500 text-xs">Enfermas</p><p className="text-xl font-bold text-yellow-700">{data.birds.hens.sick}</p></div>
                <div className="p-3 bg-orange-50 rounded-lg"><p className="text-slate-500 text-xs">Recomendadas sacrificio</p><p className="text-xl font-bold text-orange-700">{data.birds.hens.recommendedSlaughter}</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <AppIcon icon="rooster" className="w-3.5 h-3.5 text-slate-600" />
                  <span>Gallos en inventario: <strong className="text-slate-700">{data.birds.roosters.active}</strong></span>
                </span>
                <span>
                  Fuera del inventario: <strong className="text-slate-700">{data.birds.hens.sold + data.birds.hens.slaughtered + data.birds.hens.dead} gallinas</strong>
                  {" "}({data.birds.hens.sold} vendidas · {data.birds.hens.slaughtered} faena · {data.birds.hens.dead} muertas)
                </span>
              </div>
              {data.mortality.totalDeaths > 0 && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <span className="font-semibold text-red-700 inline-flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" aria-hidden="true" />
                    <span>Mortalidad: {data.mortality.totalDeaths} muertes</span>
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(data.mortality.byCause).map(([cause, count]) => (
                      <span key={cause} className="text-xs text-red-600">{cause.replace(/_/g, ' ')}: {count}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.birds.batches.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <span>Lotes de engorde activos</span>
                  </p>
                  <TableSearch
                    value={batchSearch}
                    onChange={setBatchSearch}
                    placeholder="Buscar por código o raza..."
                    resultCount={filteredBatches.length}
                    totalCount={data.birds.batches.length}
                    className="mb-3"
                  />
                  {filteredBatches.length === 0 ? (
                    <EmptyState
                      icon="package"
                      message={
                        batchSearch.trim()
                          ? "No hay lotes que coincidan con la búsqueda"
                          : "No hay lotes de engorde activos"
                      }
                    />
                  ) : (
                  <Table headers={["Código", "Raza", "Cantidad", "Peso Prom."]}>
                    {filteredBatches.map((b) => (
                      <tr key={b.batchId} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium">{b.code}</td>
                        <td className="px-4 py-2">{b.breed}</td>
                        <td className="px-4 py-2 font-semibold">{b.currentQuantity}</td>
                        <td className="px-4 py-2">{b.avgWeightKg} kg</td>
                      </tr>
                    ))}
                  </Table>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-green-600" aria-hidden="true" />
                <span>Gallinaza</span>
              </h3>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-green-50 rounded-xl flex-1">
                  <p className="text-slate-500 text-xs">Stock acumulado</p>
                  <p className="text-2xl font-bold text-green-700">{fmtKg(data.manure.currentStockKg)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl flex-1">
                  <p className="text-slate-500 text-xs">Última acumulación</p>
                  <p className="text-lg font-bold text-slate-700">
                    {data.manure.lastAccumulatedDate ? new Date(data.manure.lastAccumulatedDate + "T12:00:00").toLocaleDateString("es") : "—"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Carne */}
          {data.meat.length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <AppIcon icon="meat" className="w-5 h-5 text-slate-600" />
                <span>Inventario de Carne</span>
              </h2>
              <div className="flex gap-4 mb-3 text-sm">
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full">{data.summary.totalMeatKg} kg disponibles</span>
              </div>
              <TableSearch
                value={meatSearch}
                onChange={setMeatSearch}
                placeholder="Buscar por fecha, origen o tipo de ave..."
                resultCount={filteredMeat.length}
                totalCount={data.meat.length}
                className="mb-3"
              />
              {filteredMeat.length === 0 ? (
                <EmptyState
                  icon="meat"
                  message={
                    meatSearch.trim()
                      ? "No hay lotes que coincidan con la búsqueda"
                      : "No hay inventario de carne"
                  }
                />
              ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500">
                  <th className="py-2">Fecha</th><th>Origen</th><th>Especie</th><th>Kg</th><th>Disponible</th><th>Precio estimado/kg</th><th>Valor estimado</th>
                </tr></thead>
                <tbody>
                  {filteredMeat.map((m) => (
                    <tr key={m.id} className="border-b">
                      <td className="py-2">{m.date}</td>
                      <td>{m.source}</td>
                      <td>{m.species}</td>
                      <td>{m.quantityKg} kg</td>
                      <td>{m.availableKg} kg</td>
                      <td>{fmtMoney(m.estimatedPriceKg)}</td>
                      <td className="font-medium">{fmtMoney(m.estimatedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}

          {/* Movimientos por motivo */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-600" aria-hidden="true" />
              <span>Entradas y Salidas por Motivo (últimos {data.periodDays} días)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">Movimientos de alimento clasificados por tipo de operación</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1.5">
                  <ArrowDown className="w-4 h-4" aria-hidden="true" />
                  <span>Entradas: {data.movements.totalEntries} kg</span>
                </p>
                {entryChart.length === 0 ? (
                  <EmptyState icon="incoming" message="Sin entradas en el período" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={entryChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {entryChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
                  <span>Salidas: {data.movements.totalExits} kg</span>
                </p>
                {exitChart.length === 0 ? (
                  <EmptyState icon="outgoing" message="Sin salidas en el período" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={exitChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {exitChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

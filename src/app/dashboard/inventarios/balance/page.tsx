"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Table, Badge, StatCard, EmptyState } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

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
  quantityKg: number;
  availableKg: number;
  costPerKg: number;
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
  species: { species: string; label: string; count: number }[];
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
  compra: "🛒 Compra",
  donacion: "🎁 Donación",
  traslado: "🚚 Traslado",
  produccion_propia: "🌿 Producción propia",
  ajuste: "⚖️ Ajuste",
  consumo_programa: "⚙️ Consumo por programa",
  consumo_manual: "🍽️ Consumo manual",
  venta: "💰 Venta",
  uso_interno: "🏠 Uso interno",
  merma: "🗑️ Merma",
  otro: "📄 Otro",
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
        item.quantityKg,
        item.availableKg,
        item.costPerKg,
      ]),
    );
  }, [data, meatSearch]);

  return (
    <div>
      <PageHeader
        title="⚖️ Balance de Inventario"
        description="Vista consolidada de todos los stocks del gallinero: alimentos, huevos, aves y gallinaza"
        help="Vista consolidada de todo el inventario del gallinero en un solo lugar: alimentos (stock actual, valor, alertas de mínimo), huevos (disponible por tamaño), aves (gallinas, pollos, patos, codornices, conejos) y gallinaza. Los indicadores en rojo señalan stock bajo. Incluye gráfico de distribución de valor por categoría para ver dónde se concentra el capital invertido en inventario."
      />

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
        <Card><EmptyState icon="⚖️" message="No se pudo cargar el balance" /></Card>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="💰" label="Valor Total Inventario" value={fmtMoney(data.summary.totalValue)} color="green" />
            <StatCard icon="🌾" label="Alimentos" value={`${data.summary.totalFeeds} (${data.summary.lowStockFeeds} bajos)`} color="blue" />
            <StatCard icon="🐾" label="Animales Activos" value={data.summary.totalAnimalsActive} color="yellow" />
            <StatCard icon="🥚" label="Huevos Disponibles" value={data.summary.totalEggsAvailable} color="purple" />
          </div>

          {/* Desglose de valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-slate-500">🌾 Valor en Alimentos</p>
              <p className="text-2xl font-bold text-blue-600">{fmtMoney(data.summary.foodValue)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">🥚 Valor en Huevos</p>
              <p className="text-2xl font-bold text-purple-600">{fmtMoney(data.summary.eggValue)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">🐔 Valor Aves en Pie</p>
              <p className="text-2xl font-bold text-orange-600">{fmtMoney(data.summary.birdsValue)}</p>
              <p className="text-xs text-slate-400">{data.summary.totalBirdsWeightKg} kg en pie, valorados con precios de Catálogos</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">🧰 Valor en Insumos</p>
              <p className="text-2xl font-bold text-cyan-600">{fmtMoney(data.summary.suppliesValue)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">🍗 Valor en Carne</p>
              <p className="text-2xl font-bold text-red-600">{fmtMoney(data.summary.meatValue)}</p>
              <p className="text-xs text-slate-400">{data.summary.totalMeatKg} kg disponibles</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">🌱 Valor Gallinaza</p>
              <p className="text-2xl font-bold text-green-600">{fmtMoney(data.summary.manureValue)}</p>
              <p className="text-xs text-slate-400">{fmtKg(data.summary.totalManureKg)} en stock</p>
            </Card>
          </div>

          {/* Alimentos */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">🌾 Inventario de Alimentos</h3>
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
                icon="🌾"
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
                      <Badge color={f.category === "suplementario" ? "blue" : "green"}>
                        {f.category === "suplementario" ? "🛒 Suplementario" : "🌿 Granja"}
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
            <h2 className="text-lg font-bold text-gray-800 mb-3">🧰 Insumos</h2>
            <div className="flex gap-4 mb-3 text-sm">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">{data.supplies.length} items</span>
              <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">Valor: ${data.summary.suppliesValue?.toLocaleString()}</span>
              {data.summary.lowStockSupplies > 0 && (
                <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full">⚠ {data.summary.lowStockSupplies} stock bajo</span>
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
                icon="🧰"
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
            <h3 className="font-semibold text-slate-700 mb-3">🥚 Huevos Disponibles por Tamaño (PEPS)</h3>
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
                icon="🥚"
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
              <h3 className="font-semibold text-slate-700 mb-3">🐔 Animales por Estado</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-3 bg-green-50 rounded-lg"><p className="text-slate-500 text-xs">Gallinas en inventario</p><p className="text-xl font-bold text-green-700">{data.birds.hens.active}</p></div>
                <div className="p-3 bg-emerald-50 rounded-lg"><p className="text-slate-500 text-xs">Gallinas en postura</p><p className="text-xl font-bold text-emerald-700">{data.birds.hens.laying}</p></div>
                <div className="p-3 bg-purple-50 rounded-lg"><p className="text-slate-500 text-xs">Empollando</p><p className="text-xl font-bold text-purple-700">{data.birds.hens.broody}</p></div>
                <div className="p-3 bg-yellow-50 rounded-lg"><p className="text-slate-500 text-xs">Enfermas</p><p className="text-xl font-bold text-yellow-700">{data.birds.hens.sick}</p></div>
                <div className="p-3 bg-orange-50 rounded-lg"><p className="text-slate-500 text-xs">Recomendadas sacrificio</p><p className="text-xl font-bold text-orange-700">{data.birds.hens.recommendedSlaughter}</p></div>
                <div className="p-3 bg-red-50 rounded-lg"><p className="text-slate-500 text-xs">Vendidas / Faena</p><p className="text-xl font-bold text-red-700">{data.birds.hens.sold + data.birds.hens.slaughtered}</p></div>
                <div className="p-3 bg-blue-50 rounded-lg"><p className="text-slate-500 text-xs">Gallos en inventario</p><p className="text-xl font-bold text-blue-700">{data.birds.roosters.active}</p></div>
                <div className="p-3 bg-indigo-50 rounded-lg"><p className="text-slate-500 text-xs">Animales en inventario</p><p className="text-xl font-bold text-indigo-700">{data.birds.totalAnimals}</p></div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Inventario vigente: {data.birds.species.filter((s) => s.count > 0).map((s) => `${s.count} ${s.label.toLowerCase()}`).join(" · ") || "sin animales"}
              </p>
              {data.mortality.totalDeaths > 0 && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <span className="font-semibold text-red-700">📉 Mortalidad: {data.mortality.totalDeaths} muertes</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(data.mortality.byCause).map(([cause, count]) => (
                      <span key={cause} className="text-xs text-red-600">{cause.replace(/_/g, ' ')}: {count}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.birds.batches.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-600 mb-2">📦 Lotes de engorde activos</p>
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
                      icon="📦"
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
              <h3 className="font-semibold text-slate-700 mb-3">🌱 Gallinaza</h3>
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
              <h2 className="text-lg font-bold text-gray-800 mb-3">🍗 Inventario de Carne</h2>
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
                  icon="🍗"
                  message={
                    meatSearch.trim()
                      ? "No hay lotes que coincidan con la búsqueda"
                      : "No hay inventario de carne"
                  }
                />
              ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500">
                  <th className="py-2">Fecha</th><th>Origen</th><th>Tipo Ave</th><th>Kg</th><th>Disponible</th>
                </tr></thead>
                <tbody>
                  {filteredMeat.map((m) => (
                    <tr key={m.id} className="border-b">
                      <td className="py-2">{m.date}</td>
                      <td>{m.source}</td>
                      <td>{m.birdType}</td>
                      <td>{m.quantityKg} kg</td>
                      <td>{m.availableKg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}

          {/* Movimientos por motivo */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-1">📦 Entradas y Salidas por Motivo (últimos {data.periodDays} días)</h3>
            <p className="text-xs text-slate-400 mb-4">Movimientos de alimento clasificados por tipo de operación</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-green-700 mb-2">📥 Entradas: {data.movements.totalEntries} kg</p>
                {entryChart.length === 0 ? (
                  <EmptyState icon="📥" message="Sin entradas en el período" />
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
                <p className="text-sm font-medium text-red-700 mb-2">📤 Salidas: {data.movements.totalExits} kg</p>
                {exitChart.length === 0 ? (
                  <EmptyState icon="📤" message="Sin salidas en el período" />
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

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, Badge, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

// ─── Types ───
interface EggInventory {
  summary: {
    produced: number;
    sold: number;
    lost: number;
    available: number;
    sizes: { size: string; price: number | null; available: number; produced: number; sold: number }[];
  };
  aging: { label: string; count: number }[];
  estimatedValue: number;
}

interface MeatInventory {
  summary: { produced: number; sold: number; lost: number; available: number };
}

interface ManureInventory {
  summary: { produced: number; sold: number; adjusted: number; available: number };
  estimatedDailyKg: number;
}

interface FeedItem {
  feedId: string;
  name: string;
  currentStock: number;
  minStock: number;
  unit: string;
  isLow: boolean;
}

interface SupplyItem {
  supplyId: string;
  name: string;
  currentStock: number;
  minStock: number;
  unit: string;
  isLow: boolean;
}

interface BalanceData {
  summary: {
    totalFeeds: number;
    lowStockFeeds: number;
    totalHensActive: number;
    totalEggsAvailable: number;
    totalManureKg: number;
    totalValue: number;
    totalSupplies: number;
    lowStockSupplies: number;
    totalMeatKg: number;
  };
  foods: FeedItem[];
  supplies: SupplyItem[];
}

export default function InventarioTab() {
  const [eggData, setEggData] = useState<EggInventory | null>(null);
  const [meatData, setMeatData] = useState<MeatInventory | null>(null);
  const [manureData, setManureData] = useState<ManureInventory | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [eggRes, meatRes, manureRes, balanceRes] = await Promise.all([
        apiFetch("/api/produccion/huevos/inventario"),
        apiFetch("/api/inventarios/carne"),
        apiFetch("/api/inventarios/gallinaza"),
        apiFetch("/api/inventarios/huevos/consolidado?days=30"),
      ]);
      if (eggRes.ok) setEggData(await eggRes.json());
      if (meatRes.ok) setMeatData(await meatRes.json());
      if (manureRes.ok) setManureData(await manureRes.json());
      if (balanceRes.ok) setBalanceData(await balanceRes.json());
    } catch (e) {
      console.error("Error loading inventory:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const expiringEggs = eggData?.aging.find((a) => a.label === ">21 días")?.count || 0;
  const oldEggs = eggData?.aging.find((a) => a.label === "15-21 días")?.count || 0;
  const lowFeeds = balanceData?.foods.filter((f) => f.isLow) || [];
  const lowSupplies = balanceData?.supplies.filter((s) => s.isLow) || [];

  return (
    <div className="space-y-6">
      {/* Header with links to detailed views */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📦 Inventario Consolidado</h2>
          <p className="text-sm text-slate-500">Vista rápida de todos los stocks. Para gestión detallada, usa los enlaces de abajo.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/inventarios/huevos" className="text-xs px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors">
            Detalle Huevos →
          </Link>
          <Link href="/dashboard/inventarios/balance" className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
            Balance Completo →
          </Link>
        </div>
      </div>

      {/* Alert banner */}
      {(expiringEggs > 0 || lowFeeds.length > 0 || lowSupplies.length > 0) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
          <p className="font-semibold text-red-700 text-sm">⚠️ Alertas de Inventario</p>
          {expiringEggs > 0 && (
            <p className="text-sm text-red-600">• {expiringEggs} huevos tienen más de 21 días — vender o usar pronto</p>
          )}
          {oldEggs > 0 && (
            <p className="text-sm text-orange-600">• {oldEggs} huevos entre 15-21 días — monitorear</p>
          )}
          {lowFeeds.map((f) => (
            <p key={f.feedId} className="text-sm text-red-600">
              • Alimento <strong>{f.name}</strong>: {f.currentStock} {f.unit} (mínimo: {f.minStock})
            </p>
          ))}
          {lowSupplies.map((s) => (
            <p key={s.supplyId} className="text-sm text-orange-600">
              • Insumo <strong>{s.name}</strong>: {s.currentStock} {s.unit} (mínimo: {s.minStock})
            </p>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat icon="🥚" label="Huevos disp." value={eggData?.summary.available ?? 0} />
        <MiniStat icon="🍗" label="Carne (kg)" value={`${(meatData?.summary.available ?? 0).toFixed(1)}`} />
        <MiniStat icon="🌱" label="Gallinaza (kg)" value={`${(manureData?.summary.available ?? 0).toFixed(0)}`} />
        <MiniStat
          icon="🌾"
          label="Alimentos"
          value={balanceData?.summary.totalFeeds ?? 0}
          alert={balanceData?.summary.lowStockFeeds ?? 0}
        />
        <MiniStat
          icon="🧰"
          label="Insumos"
          value={balanceData?.summary.totalSupplies ?? 0}
          alert={balanceData?.summary.lowStockSupplies ?? 0}
        />
        <MiniStat icon="💰" label="Valor total" value={`$${(balanceData?.summary.totalValue ?? 0).toLocaleString()}`} />
      </div>

      {/* Detailed sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Egg inventory */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">🥚 Huevos por Tamaño</h3>
            <Link href="/dashboard/inventarios/huevos" className="text-xs text-blue-600 hover:underline">Ver todo →</Link>
          </div>
          {eggData && eggData.summary.available > 0 ? (
            <div className="space-y-2">
              {eggData.summary.sizes.filter((s) => s.available > 0).map((s) => (
                <div key={s.size} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge color="green">{s.size}</Badge>
                    <span className="text-sm font-medium">{s.available} disp.</span>
                  </div>
                  {s.price != null && (
                    <span className="text-xs text-slate-500">${s.price.toLocaleString()}/und</span>
                  )}
                </div>
              ))}
              {expiringEggs > 0 && (
                <p className="text-xs text-red-600 mt-2">⚠️ {expiringEggs} huevos por vencer (&gt;21 días)</p>
              )}
              <p className="text-xs text-slate-400 mt-1">Valor estimado: ${eggData.estimatedValue.toLocaleString()}</p>
            </div>
          ) : (
            <EmptyState icon="🥚" message="Sin huevos en inventario" />
          )}
        </Card>

        {/* Feed inventory */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">🌾 Alimento</h3>
            <Link href="/dashboard/inventarios/balance" className="text-xs text-blue-600 hover:underline">Ver todo →</Link>
          </div>
          {balanceData && balanceData.foods.length > 0 ? (
            <div className="space-y-2">
              {balanceData.foods.map((f) => (
                <div key={f.feedId} className={`p-2 rounded-lg ${f.isLow ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{f.name}</span>
                    <span className={`text-sm font-bold ${f.isLow ? "text-red-600" : "text-green-600"}`}>
                      {f.currentStock} {f.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                    <span>Mín: {f.minStock} {f.unit}</span>
                    {f.isLow && <span className="text-red-600 font-semibold">⚠ Stock bajo</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="🌾" message="Sin alimentos registrados" />
          )}
        </Card>

        {/* Meat inventory */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">🍗 Carne</h3>
            <Link href="/dashboard/inventarios/carne" className="text-xs text-blue-600 hover:underline">Ver todo →</Link>
          </div>
          {meatData && meatData.summary.available > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm">Producido total</span>
                <span className="text-sm font-bold">{meatData.summary.produced.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm">Vendido</span>
                <span className="text-sm font-bold text-blue-600">{meatData.summary.sold.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm font-medium">Disponible</span>
                <span className="text-lg font-bold text-green-700">{meatData.summary.available.toFixed(1)} kg</span>
              </div>
              {meatData.summary.lost > 0 && (
                <p className="text-xs text-red-500">Perdido: {meatData.summary.lost.toFixed(1)} kg</p>
              )}
            </div>
          ) : (
            <EmptyState icon="🍗" message="Sin carne en inventario" />
          )}
        </Card>

        {/* Manure inventory */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">🌱 Gallinaza</h3>
            <Link href="/dashboard/inventarios/gallinaza" className="text-xs text-blue-600 hover:underline">Ver todo →</Link>
          </div>
          {manureData && (manureData.summary.available > 0 || manureData.summary.produced > 0) ? (
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm font-medium">Stock disponible</span>
                <span className="text-lg font-bold text-green-700">{manureData.summary.available.toFixed(0)} kg</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-sm">Producido total</span>
                <span className="text-sm font-medium">{manureData.summary.produced.toFixed(0)} kg</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-sm">Vendido</span>
                <span className="text-sm font-medium text-blue-600">{manureData.summary.sold.toFixed(0)} kg</span>
              </div>
              {manureData.estimatedDailyKg > 0 && (
                <p className="text-xs text-slate-500">Producción estimada: {manureData.estimatedDailyKg.toFixed(2)} kg/día</p>
              )}
            </div>
          ) : (
            <EmptyState icon="🌱" message="Sin gallinaza en inventario" />
          )}
        </Card>
      </div>

      {/* Low stock supplies */}
      {lowSupplies.length > 0 && (
        <Card className="border-orange-200">
          <h3 className="font-semibold text-slate-700 mb-3">🧰 Insumos con Stock Bajo</h3>
          <div className="space-y-2">
            {lowSupplies.map((s) => (
              <div key={s.supplyId} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-sm">
                  <span className="text-red-600 font-bold">{s.currentStock}</span>
                  <span className="text-slate-500"> / {s.minStock} {s.unit}</span>
                </span>
              </div>
            ))}
          </div>
          <Link href="/dashboard/inventarios/insumos" className="text-xs text-blue-600 hover:underline mt-3 inline-block">
            Gestionar insumos →
          </Link>
        </Card>
      )}
    </div>
  );
}

// ─── Mini stat component ───
function MiniStat({ icon, label, value, alert }: { icon: string; label: string; value: string | number; alert?: number }) {
  return (
    <div className={`p-3 rounded-xl border text-center ${alert && alert > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="text-lg">{icon}</p>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
      {alert !== undefined && alert > 0 && (
        <p className="text-[10px] text-red-600 font-semibold mt-0.5">⚠ {alert} bajo{alert > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

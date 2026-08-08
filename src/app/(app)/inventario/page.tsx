"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Table, Badge, StatCard, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface EggLot {
  id: string;
  date: string;
  size: string;
  initial: number;
  sold: number;
  remaining: number;
  ageDays: number;
}

interface SizeSummary {
  size: string;
  price: number | null;
  produced: number;
  sold: number;
  available: number;
  value: number;
}

interface InventoryData {
  summary: {
    produced: number;
    sold: number;
    available: number;
    sizes: SizeSummary[];
  };
  lots: EggLot[];
  aging: { label: string; count: number }[];
  oldestLot: EggLot | null;
  estimatedValue: number;
}

export default function InventarioPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch("/api/huevos/inventario").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const riskLots = data?.lots.filter((l) => l.remaining > 0 && l.ageDays > 14) || [];
  const expiring = data?.aging.find((a) => a.label === ">21 días")?.count || 0;

  return (
    <div>
      <PageHeader
        title="📦 Inventario de Huevos"
        description="Cruce entre producción, ventas y disponibilidad por tamaño, con consumo PEPS (primero lo más antiguo)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🥚" label="Huevos Producidos" value={data?.summary.produced ?? 0} color="blue" />
        <StatCard icon="💰" label="Huevos Vendidos" value={data?.summary.sold ?? 0} color="purple" />
        <StatCard icon="📦" label="Disponibles" value={data?.summary.available ?? 0} color="green" />
        <StatCard icon="⏱️" label="Valor Estimado" value={`$${(data?.estimatedValue ?? 0).toLocaleString()}`} color="yellow" />
      </div>

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : data && data.summary.produced > 0 ? (
        <>
          {expiring > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <p className="font-semibold">⚠️ Atención: {expiring} huevos tienen más de 21 días de edad.</p>
              <p className="mt-1">Prioriza su venta o uso antes de que pierdan calidad. El sistema PEPS ya los marca como siguientes en salir.</p>
            </div>
          )}

          <Card className="mb-6">
            <h3 className="font-semibold text-slate-700 mb-4">🧊 Edad del Inventario Disponible</h3>
            {data.aging.every((a) => a.count === 0) ? (
              <p className="text-sm text-slate-500">No hay huevos disponibles en inventario.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {data.aging.map((b) => {
                  const pct = data.summary.available > 0 ? Math.round((b.count / data.summary.available) * 100) : 0;
                  const isOld = b.label === ">21 días" || b.label === "15-21 días";
                  return (
                    <div key={b.label} className={`p-3 rounded-xl border ${isOld && b.count > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                      <p className="text-xs text-slate-500">{b.label}</p>
                      <p className={`text-2xl font-bold ${isOld && b.count > 0 ? "text-red-600" : "text-slate-700"}`}>{b.count}</p>
                      <p className="text-xs text-slate-400">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            )}
            {data.oldestLot && (
              <p className="mt-4 text-sm text-slate-500">
                🥚 Lote más antiguo: <strong>{new Date(data.oldestLot.date + "T12:00:00").toLocaleDateString("es")}</strong> ({data.oldestLot.size}, {data.oldestLot.ageDays} días, {data.oldestLot.remaining} disponibles)
              </p>
            )}
          </Card>

          <Card className="mb-6">
            <h3 className="font-semibold text-slate-700 mb-4">📊 Resumen por Tamaño</h3>
            <Table headers={["Tamaño", "Precio", "Producido", "Vendido", "Disponible", "Valor"]}>
              {data.summary.sizes.map((s) => (
                <tr key={s.size} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Badge color="green">{s.size}</Badge></td>
                  <td className="px-4 py-3">{s.price != null ? `$${s.price.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3">{s.produced}</td>
                  <td className="px-4 py-3">{s.sold}</td>
                  <td className="px-4 py-3 font-bold text-green-600">{s.available}</td>
                  <td className="px-4 py-3">${s.value.toLocaleString()}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-700 mb-1">🗂️ Movimiento de Inventario (PEPS)</h3>
            <p className="text-xs text-slate-400 mb-4">Las ventas se descuentan primero de los lotes más antiguos de cada tamaño</p>
            <Table headers={["Fecha Lote", "Tamaño", "Inicial", "Vendido", "Disponible", "Edad", "Estado"]}>
              {data.lots.map((l) => {
                const isOld = l.remaining > 0 && l.ageDays > 14;
                const isExpiring = l.remaining > 0 && l.ageDays > 21;
                return (
                  <tr key={l.id + l.size} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{new Date(l.date + "T12:00:00").toLocaleDateString("es")}</td>
                    <td className="px-4 py-3"><Badge color="green">{l.size}</Badge></td>
                    <td className="px-4 py-3">{l.initial}</td>
                    <td className="px-4 py-3 text-slate-500">{l.sold}</td>
                    <td className="px-4 py-3 font-semibold">{l.remaining}</td>
                    <td className="px-4 py-3 text-sm">{l.ageDays} días</td>
                    <td className="px-4 py-3">
                      {l.remaining === 0 ? (
                        <Badge color="gray">Agotado</Badge>
                      ) : isExpiring ? (
                        <Badge color="red">Por vencer</Badge>
                      ) : isOld ? (
                        <Badge color="orange">Vender pronto</Badge>
                      ) : (
                        <Badge color="green">Disponible</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState icon="📦" message="Registra producción de huevos para ver el inventario PEPS" />
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader, Card, Table, StatCard, EmptyState, Button } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface MeatLot {
  id: string;
  date: string;
  birdType: string;
  quantityKg: number;
  soldKg: number;
  lostKg: number;
  remainingKg: number;
  ageDays: number;
}

interface InventoryData {
  summary: {
    produced: number;
    sold: number;
    lost: number;
    available: number;
    value: number;
  };
  lots: MeatLot[];
  oldestLot: MeatLot | null;
  estimatedValue: number;
}

const birdTypeLabels: Record<string, string> = {
  gallina_descarte: "Gallina",
  pollo: "Pollo",
  gallo: "Gallo",
};

export default function InventarioCarnePage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch("/api/inventarios/carne").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="🍗 Inventario de Carne"
        description="Stock de carne disponible: producido (sacrificio) - vendido - perdido. Consumo FIFO."
        help="Inventario de carne disponible proveniente de sacrificios. Se muestra lo producido, vendido, perdido y restante por lote. Usa consumo FIFO (First In, First Out). Desde aquí puedes registrar ventas directamente o ver el historial de lotes. El valor estimado se calcula con el costo de producción."
        actions={
          <div className="flex gap-2">
            <Link href="/finanzas/ventas?tab=carne"><Button>+ Registrar Venta</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🍗" label="Producido (kg)" value={(data?.summary.produced ?? 0).toFixed(1)} color="green" />
        <StatCard icon="💰" label="Vendido (kg)" value={(data?.summary.sold ?? 0).toFixed(1)} color="blue" />
        <StatCard icon="📦" label="Disponible (kg)" value={(data?.summary.available ?? 0).toFixed(1)} color="yellow" />
        <StatCard icon="🗑️" label="Perdido (kg)" value={(data?.summary.lost ?? 0).toFixed(1)} color="red" />
      </div>

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : data && data.summary.produced > 0 ? (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Lotes de Carne (FIFO)</h3>
          {data.lots.length === 0 ? (
            <EmptyState icon="🍗" message="No hay lotes en inventario" />
          ) : (
            <Table headers={["Fecha", "Origen", "Producido (kg)", "Vendido (kg)", "Perdido (kg)", "Disponible (kg)", "Edad (días)"]}>
              {data.lots.map((lot) => (
                <tr key={lot.id} className={`hover:bg-slate-50 ${lot.remainingKg <= 0 ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">{new Date(lot.date + "T12:00:00").toLocaleDateString("es")}</td>
                  <td className="px-4 py-3 text-sm">{birdTypeLabels[lot.birdType] || lot.birdType}</td>
                  <td className="px-4 py-3">{lot.quantityKg.toFixed(1)}</td>
                  <td className="px-4 py-3">{lot.soldKg.toFixed(1)}</td>
                  <td className="px-4 py-3">{lot.lostKg.toFixed(1)}</td>
                  <td className="px-4 py-3 font-bold text-green-600">{lot.remainingKg.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={lot.ageDays > 30 ? "text-red-600 font-semibold" : lot.ageDays > 14 ? "text-yellow-600" : "text-slate-600"}>
                      {lot.ageDays} días
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          <EmptyState icon="🍗" message="No hay producción de carne registrada. Registra sacrificios desde Producción → Carne." />
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader, Card, Table, StatCard, EmptyState, Button } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface InventoryData {
  summary: {
    produced: number;
    sold: number;
    adjusted: number;
    available: number;
    value: number;
  };
  productionHistory: { date: string; kgProduced: number; source: string }[];
  salesHistory: { date: string; quantityKg: number; totalAmount: number }[];
  estimatedDailyKg: number;
}

const dateFmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });

export default function InventarioGallinazaPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch("/api/inventarios/gallinaza").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="🌱 Inventario de Gallinaza"
        description="Stock de abono disponible: producido + ajustes - vendido."
        help="Controla el inventario de gallinaza (abono orgánico). La producción se estima automáticamente según el número de aves y factores de conversión. Se pueden hacer ajustes manuales (por limpieza, humedad, etc.) y registrar ventas. Muestra historial de producción y ventas, stock disponible y valor estimado. Desde aquí puedes ir a 'Factores y Ajustes' para configurar los parámetros de estimación."
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/operaciones/gallinaza"><Button>Factores y Ajustes</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🌱" label="Producido (kg)" value={(data?.summary.produced ?? 0).toFixed(1)} color="green" />
        <StatCard icon="💰" label="Vendido (kg)" value={(data?.summary.sold ?? 0).toFixed(1)} color="blue" />
        <StatCard icon="📦" label="Disponible (kg)" value={(data?.summary.available ?? 0).toFixed(1)} color="yellow" />
        <StatCard icon="📊" label="Est. Diario (kg/día)" value={(data?.estimatedDailyKg ?? 0).toFixed(2)} color="purple" />
      </div>

      {(data?.summary.adjusted ?? 0) !== 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          Ajustes netos: <strong>{(data?.summary.adjusted ?? 0).toFixed(1)} kg</strong>
          {(data?.summary.adjusted ?? 0) > 0 ? " (mediciones reales agregadas)" : " (retiros registrados)"}
        </div>
      )}

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : data && (data.summary.produced > 0 || data.salesHistory.length > 0) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Historial de Producción</h3>
            {data.productionHistory.length === 0 ? (
              <EmptyState icon="🌱" message="No hay registros de producción" />
            ) : (
              <Table headers={["Fecha", "Kg Producidos", "Fuente"]}>
                {data.productionHistory.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{dateFmt(p.date)}</td>
                    <td className="px-4 py-3 font-medium">{p.kgProduced.toFixed(1)} kg</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={p.source === "real" ? "text-green-600" : "text-slate-500"}>
                        {p.source === "real" ? "Medición real" : "Estimado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Historial de Ventas</h3>
            {data.salesHistory.length === 0 ? (
              <EmptyState icon="💰" message="No hay ventas registradas" />
            ) : (
              <Table headers={["Fecha", "Kg Vendidos", "Total"]}>
                {data.salesHistory.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{dateFmt(s.date)}</td>
                    <td className="px-4 py-3 font-medium">{s.quantityKg.toFixed(1)} kg</td>
                    <td className="px-4 py-3 text-green-600 font-bold">${s.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState icon="🌱" message="No hay datos de gallinaza. La producción se estima automáticamente según los factores por etapa." />
        </Card>
      )}
    </div>
  );
}

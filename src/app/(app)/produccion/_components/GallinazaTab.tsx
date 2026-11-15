"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Banknote, Calculator, Ruler, Scale, Settings } from "lucide-react";
import { PageHeader, HeroActionButton, Button, Card, Table, Modal, Input, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import ContactField from "@/components/contacts/ContactField";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";

interface EstimationGroup {
  key: string;
  label: string;
  count: number;
  kgPerBirdPerDay: number;
  factorId: string | null;
  kgPerDay: number;
}

interface ManureSale {
  id: string;
  date: string;
  quantityKg: string;
  pricePerKg: string;
  totalAmount: string;
  presentation: string | null;
  buyer: string | null;
  notes: string | null;
}

interface ManureAdjustment {
  id: string;
  date: string;
  deltaKg: string;
  reason: string;
}

interface ManureData {
  estimation: { groups: EstimationGroup[]; totalKgPerDay: number };
  inventory: { currentStockKg: number; asOfDate: string };
  sales: ManureSale[];
  adjustments: ManureAdjustment[];
}

const dateFmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });

export default function GallinazaPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ManureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saleModal, setSaleModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [error, setError] = useState("");
  const [saleForm, setSaleForm] = useState({ date: new Date().toISOString().split("T")[0], quantityKg: "", pricePerKg: "", presentation: "", buyer: "", notes: "" });
  const [adjustForm, setAdjustForm] = useState({ date: new Date().toISOString().split("T")[0], deltaKg: "", reason: "" });
  const [salesSearch, setSalesSearch] = useState("");
  const [adjustSearch, setAdjustSearch] = useState("");

  const load = useCallback(() => {
    apiFetch("/api/operaciones/gallinaza")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useActionQuery(searchParams.get("nuevo"), {
    venta: () => { setError(""); setSaleModal(true); },
    ajuste: () => { setError(""); setAdjustModal(true); },
  });

  const saveSale = async () => {
    setError("");
    const qty = Number(saleForm.quantityKg);
    if (data && qty > data.inventory.currentStockKg) {
      setError(`Stock insuficiente (disponible: ${data.inventory.currentStockKg.toFixed(2)} kg)`);
      return;
    }
    const res = await apiFetch("/api/operaciones/gallinaza", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sale", ...saleForm, quantityKg: qty, pricePerKg: Number(saleForm.pricePerKg) }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Error al registrar la venta");
      return;
    }
    setSaleModal(false);
    setSaleForm({ date: new Date().toISOString().split("T")[0], quantityKg: "", pricePerKg: "", presentation: "", buyer: "", notes: "" });
    load();
  };

  const saveAdjust = async () => {
    setError("");
    const res = await apiFetch("/api/operaciones/gallinaza", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "adjust", ...adjustForm, deltaKg: Number(adjustForm.deltaKg) }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Error al registrar el ajuste");
      return;
    }
    setAdjustModal(false);
    setAdjustForm({ date: new Date().toISOString().split("T")[0], deltaKg: "", reason: "" });
    load();
  };

  const removeSale = async (id: string) => {
    if (!confirm("¿Eliminar esta venta? Se repondrá el stock y se eliminará el ingreso en finanzas.")) return;
    await apiFetch(`/api/operaciones/gallinaza?saleId=${id}`, { method: "DELETE" });
    load();
  };

  const removeAdjust = async (id: string) => {
    if (!confirm("¿Eliminar este ajuste? Se revertirá su efecto en el stock.")) return;
    await apiFetch(`/api/operaciones/gallinaza?adjustId=${id}`, { method: "DELETE" });
    load();
  };

  const filteredSales = useMemo(() => {
    const sales = data?.sales ?? [];
    if (!salesSearch.trim()) return sales;
    return sales.filter((sale) =>
      matchesTextQuery(salesSearch, [
        sale.date,
        dateFmt(sale.date),
        sale.quantityKg,
        sale.pricePerKg,
        sale.totalAmount,
        sale.presentation,
        sale.buyer,
        sale.notes,
      ]),
    );
  }, [data, salesSearch]);

  const filteredAdjustments = useMemo(() => {
    const adjustments = data?.adjustments ?? [];
    if (!adjustSearch.trim()) return adjustments;
    return adjustments.filter((adjustment) =>
      matchesTextQuery(adjustSearch, [
        adjustment.date,
        dateFmt(adjustment.date),
        adjustment.deltaKg,
        adjustment.reason,
      ]),
    );
  }, [data, adjustSearch]);

  if (loading || !data) {
    return <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>;
  }

  // Fecha de corte para métricas de 30 días.
  const cutoff = new Date(new Date(data.inventory.asOfDate + "T12:00:00").getTime() - 30 * 86400000).toISOString().split("T")[0];
  const revenue30 = data.sales.filter((s) => s.date >= cutoff).reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const saleTotal = Number(saleForm.quantityKg) > 0 && Number(saleForm.pricePerKg) > 0
    ? (Number(saleForm.quantityKg) * Number(saleForm.pricePerKg)).toFixed(2)
    : "";
  const monthlyEstimate = Math.round(data.estimation.totalKgPerDay * 30 * 100) / 100;
  const realPositive30 = data.adjustments.filter((a) => a.date >= cutoff && Number(a.deltaKg) > 0)
    .reduce((sum, a) => sum + Number(a.deltaKg), 0);

  return (
    <div>
      <PageHeader
        theme="gallinaza"
        title="Producción de Gallinaza"
        description="Estimación según aves y etapa, inventario de abono y ventas integradas con finanzas"
        help="Gestiona la producción y venta de gallinaza (abono).\n\n• La estimación se calcula automáticamente según las aves por etapa y los factores de producción (kg/ave/día) configurados en Catálogos.\n• Los factores se editan únicamente desde Configuración → Catálogos → Factores de gallinaza.\n• Usa 'Ajustes' para corregir el stock cuando haces mediciones reales de la pila de compostaje.\n• Registra ventas de gallinaza y el ingreso se refleja automáticamente en finanzas."
        actions={
          <div className="flex flex-wrap gap-2">
            <HeroActionButton tone="glass" onClick={() => { setError(""); setAdjustModal(true); }}>± Ajuste</HeroActionButton>
            <HeroActionButton tone="solid" onClick={() => { setError(""); setSaleModal(true); }}>+ Registrar Venta</HeroActionButton>
          </div>
        }
      />

      {/* StatCards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-6">
        <StatCard icon="sprout" label="Estimación diaria" value={`${data.estimation.totalKgPerDay} kg/día`} color="green" />
        <StatCard icon="package" label="Stock disponible" value={`${data.inventory.currentStockKg.toFixed(2)} kg`} color="yellow" />
        <StatCard icon="money" label="Ingresos gallinaza (30 días)" value={`$${revenue30.toLocaleString()}`} color="blue" />
      </div>

      {/* Estimado vs real */}
      <Card className="mb-6 !p-4">
        <div className="flex flex-col sm:flex-row justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <Ruler className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Estimación mensual: <strong className="text-green-700">{monthlyEstimate} kg</strong> ({data.estimation.totalKgPerDay} kg/día × 30)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <Scale className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Ajustes reales positivos (30 días): <strong className="text-blue-700">{realPositive30.toFixed(2)} kg</strong></span>
          </span>
          <span className="text-xs text-slate-400 self-center">Se registra una estimación al consultar el inventario cada día. Los días sin registro no se reconstruyen; usa los ajustes para reflejar mediciones reales.</span>
        </div>
      </Card>

      {/* Factores de producción (solo lectura; se editan en Catálogos) */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Factores de Producción (kg/ave/día)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Variables vigentes usadas para estimar la producción diaria. Para modificarlos, hazlo desde Catálogos.
            </p>
          </div>
          <Link href="/configuracion/catalogos?tab=gallinaza">
            <Button variant="secondary">Editar factores en Catálogos →</Button>
          </Link>
        </div>
        <Table headers={["Grupo", "Aves", "Factor kg/ave/día", "Aporte kg/día"]}>
          {data.estimation.groups.map((g) => (
            <tr key={g.key} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-medium">{g.label}</td>
              <td className="px-4 py-3 text-sm">{g.count}</td>
              <td className="px-4 py-3 text-sm font-mono text-slate-700">{g.kgPerBirdPerDay}</td>
              <td className="px-4 py-3 text-sm font-semibold text-green-700">{g.kgPerDay}</td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Ventas */}
      <Card className="mb-6">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-green-600" aria-hidden="true" />
          <span>Ventas de Gallinaza</span>
        </h3>
        <TableSearch
          value={salesSearch}
          onChange={setSalesSearch}
          placeholder="Buscar por fecha, comprador o presentación..."
          resultCount={filteredSales.length}
          totalCount={data.sales.length}
          className="mb-4"
        />
        {filteredSales.length === 0 ? (
          <EmptyState
            icon="sprout"
            message={
              salesSearch.trim()
                ? "No hay ventas que coincidan con la búsqueda"
                : "Aún no hay ventas de gallinaza"
            }
          />
        ) : (
          <Table headers={["Fecha", "Cantidad", "Precio/kg", "Presentación", "Comprador", "Total", ""]}>
            {filteredSales.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{dateFmt(s.date)}</td>
                <td className="px-4 py-3 text-sm">{Number(s.quantityKg).toLocaleString()} kg</td>
                <td className="px-4 py-3 text-sm">${Number(s.pricePerKg).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">{s.presentation || "—"}</td>
                <td className="px-4 py-3 text-sm">{s.buyer || "—"}</td>
                <td className="px-4 py-3 font-bold text-green-600">${Number(s.totalAmount).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => removeSale(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Ajustes */}
      <Card>
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span>Ajustes de Inventario</span>
        </h3>
        <TableSearch
          value={adjustSearch}
          onChange={setAdjustSearch}
          placeholder="Buscar por fecha o motivo..."
          resultCount={filteredAdjustments.length}
          totalCount={data.adjustments.length}
          className="mb-4"
        />
        {filteredAdjustments.length === 0 ? (
          <EmptyState
            icon="scale"
            message={
              adjustSearch.trim()
                ? "No hay ajustes que coincidan con la búsqueda"
                : "Sin ajustes registrados"
            }
          />
        ) : (
          <Table headers={["Fecha", "Ajuste", "Motivo", ""]}>
            {filteredAdjustments.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{dateFmt(a.date)}</td>
                <td className={`px-4 py-3 text-sm font-bold ${Number(a.deltaKg) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {Number(a.deltaKg) >= 0 ? "+" : ""}{Number(a.deltaKg).toLocaleString()} kg
                </td>
                <td className="px-4 py-3 text-sm">{a.reason}</td>
                <td className="px-4 py-3">
                  <button onClick={() => removeAdjust(a.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Modal: Venta */}
      <Modal open={saleModal} onClose={() => setSaleModal(false)} title="Registrar Venta de Gallinaza">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha" help="Fecha de la venta." type="date" value={saleForm.date} onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad (kg)" help={`Cantidad de gallinaza vendida en kg. Stock disponible: ${data.inventory.currentStockKg.toFixed(2)} kg.`} type="number" step="0.01" min="0" value={saleForm.quantityKg} onChange={(e) => setSaleForm({ ...saleForm, quantityKg: e.target.value })} placeholder={`Disp: ${data.inventory.currentStockKg.toFixed(2)} kg`} />
            <Input label="Precio por kg ($)" help="Precio de venta por kilogramo de gallinaza." type="number" step="0.01" min="0" value={saleForm.pricePerKg} onChange={(e) => setSaleForm({ ...saleForm, pricePerKg: e.target.value })} placeholder="Ej: 800" />
          </div>
          <Input label="Presentación" help="Cómo se presenta la gallinaza: bulto, costal, granel, etc." value={saleForm.presentation} onChange={(e) => setSaleForm({ ...saleForm, presentation: e.target.value })} placeholder="Ej: Bulto 25 kg" list="gallinaza-presentaciones" />
          <datalist id="gallinaza-presentaciones">
            <option value="Bulto 25 kg" />
            <option value="Costal 50 kg" />
            <option value="Granel" />
          </datalist>
          <ContactField
            role="cliente"
            label="Comprador"
            help="Persona o finca que compra la gallinaza."
            value={saleForm.buyer}
            onChange={(name) => setSaleForm({ ...saleForm, buyer: name })}
            placeholder="Nombre del comprador"
          />
          <Textarea label="Notas" help="Observaciones sobre esta venta." value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} />
          {saleTotal && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
              <span>Total: <strong className="text-xl">${Number(saleTotal).toLocaleString()}</strong> ({saleForm.quantityKg} kg × ${Number(saleForm.pricePerKg).toLocaleString()})</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={saveSale} disabled={!saleForm.quantityKg || !saleForm.pricePerKg}>Registrar Venta</Button>
            <Button variant="secondary" onClick={() => setSaleModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Ajuste */}
      <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="Ajuste de Inventario">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha" help="Fecha del ajuste." type="date" value={adjustForm.date} onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })} />
          <Input label="Ajuste en kg (usa negativo para retirar)" help="Cantidad a ajustar: positivo para agregar stock, negativo para retirar." type="number" step="0.01" value={adjustForm.deltaKg} onChange={(e) => setAdjustForm({ ...adjustForm, deltaKg: e.target.value })} placeholder="Ej: 15 o -5" />
          <Textarea label="Motivo" help="Razón del ajuste. Ej: 'Medición real de la pila de compostaje'." value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="Ej: Medición real de la pila de compostaje" required />
          <div className="flex gap-3">
            <Button onClick={saveAdjust} disabled={!adjustForm.deltaKg || Number(adjustForm.deltaKg) === 0 || !adjustForm.reason}>Aplicar Ajuste</Button>
            <Button variant="secondary" onClick={() => setAdjustModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

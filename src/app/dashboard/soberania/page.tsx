"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Bird, CalendarDays, Egg, Feather, Rabbit } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { PageHeader, Button, Card, StatCard, Table, Modal, Input, Select, Textarea, EmptyState, Badge } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";

interface AutoconsumoLog {
  id: string;
  date: string;
  species: string;
  productType: string;
  quantity: string;
  unit: string;
  marketReferencePrice: string;
  savingsAmount: string;
  destinationHousehold: string | null;
  batchId: string | null;
  slaughterId: string | null;
  notes: string | null;
  createdAt: string;
  batch?: { id: string; code: string; breed: string } | null;
}

interface SoberaniaData {
  metrics: {
    totalSavings: number;
    totalMeatKg: number;
    totalEggs: number;
    totalEntries: number;
  };
  bySpecies: Record<string, { meatKg: number; eggs: number; savings: number }>;
  monthlyTrends: { month: string; savings: number; meatKg: number; eggs: number }[];
  logs: AutoconsumoLog[];
}

const speciesConfig: Record<string, { label: string; icon: string; badgeColor: string }> = {
  gallina: { label: "Gallina", icon: "hen", badgeColor: "yellow" },
  pollo: { label: "Pollo de engorde", icon: "chick", badgeColor: "blue" },
  codorniz: { label: "Codorniz", icon: "egg", badgeColor: "purple" },
  pato: { label: "Pato", icon: "duck", badgeColor: "green" },
  conejo: { label: "Conejo", icon: "rabbit", badgeColor: "earth" },
  cuy: { label: "Cuy", icon: "paw-print", badgeColor: "pink" },
};

const productTypeLabels: Record<string, string> = {
  carne_canal: "Carne en canal",
  huevo: "Huevos",
  visceras_subproducto: "Vísceras / Menudencias",
  abono_huerta: "Abono para huerta",
};

export default function SoberaniaPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SoberaniaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    species: "conejo",
    productType: "carne_canal",
    quantity: "1",
    unit: "kg",
    marketReferencePrice: "28000",
    destinationHousehold: "Familia Granja",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const url = speciesFilter !== "all"
        ? `/api/soberania?species=${speciesFilter}`
        : "/api/soberania";
      const res = await apiFetch(url);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      console.error("Error loading soberania data:", e);
    } finally {
      setLoading(false);
    }
  }, [speciesFilter]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);
  useActionQuery(searchParams.get("nuevo"), { consumo: () => setModalOpen(true) });

  const filteredLogs = useMemo(() => {
    const logs = data?.logs ?? [];
    if (!search.trim()) return logs;
    return logs.filter((log) => {
      const species = speciesConfig[log.species];
      return matchesTextQuery(search, [
        log.date,
        species?.label,
        log.species,
        productTypeLabels[log.productType] || log.productType,
        log.quantity,
        log.unit,
        log.marketReferencePrice,
        log.savingsAmount,
        log.batch?.code,
        log.destinationHousehold,
        log.notes,
      ]);
    });
  }, [data, search]);

  // Actualizar precio de referencia sugerido al cambiar especie o producto
  const handleSpeciesOrProductChange = (newSpecies: string, newProduct: string) => {
    let suggestedPrice = "20000";
    let suggestedUnit = "kg";

    if (newProduct === "huevo") {
      suggestedUnit = "unidades";
      suggestedPrice = newSpecies === "codorniz" ? "300" : "600";
    } else if (newProduct === "carne_canal") {
      suggestedUnit = "kg";
      if (newSpecies === "cuy") suggestedPrice = "36000";
      else if (newSpecies === "conejo") suggestedPrice = "28000";
      else if (newSpecies === "pato") suggestedPrice = "24000";
      else if (newSpecies === "codorniz") suggestedPrice = "32000";
      else suggestedPrice = "14000"; // pollo/gallina
    } else if (newProduct === "abono_huerta") {
      suggestedUnit = "kg";
      suggestedPrice = "1000";
    }

    setForm((prev) => ({
      ...prev,
      species: newSpecies,
      productType: newProduct,
      unit: suggestedUnit,
      marketReferencePrice: suggestedPrice,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch("/api/soberania", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          marketReferencePrice: Number(form.marketReferencePrice),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setModalOpen(false);
      setForm({
        date: new Date().toISOString().split("T")[0],
        species: "conejo",
        productType: "carne_canal",
        quantity: "1",
        unit: "kg",
        marketReferencePrice: "28000",
        destinationHousehold: "Familia Granja",
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este registro de consumo familiar?")) return;
    try {
      const res = await apiFetch(`/api/soberania?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error("Error deleting log:", e);
    }
  };

  const calculatedSavings = (Number(form.quantity) || 0) * (Number(form.marketReferencePrice) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Soberanía Alimentaria y Autoconsumo"
        description="Gestión integral de la proteína producida para el hogar y cuantificación del ahorro económico en la canasta familiar."
        help="Este módulo mide el impacto directo de la granja en la alimentación de la familia. Cada huevo o kilo de carne de pollo, pato, conejo, cuy o codorniz que se queda en casa se valoriza al precio que costaría comprarlo en el mercado, calculando el ahorro real generado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/produccion/plan-parvada"
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50"
            >
              <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Plan de Parvada</span>
            </Link>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              + Registrar Consumo Hogar
            </Button>
          </div>
        }
      />

      {/* Tarjetas de Métricas Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          icon="money"
          label="Ahorro en Canasta Familiar"
          value={`$ ${data?.metrics.totalSavings.toLocaleString("es-CO") || "0"}`}
          color="green"
        />
        <StatCard
          icon="meat"
          label="Carne para el Hogar"
          value={`${data?.metrics.totalMeatKg || 0} kg`}
          color="blue"
        />
        <StatCard
          icon="egg"
          label="Huevos para la Mesa"
          value={`${data?.metrics.totalEggs || 0} uds`}
          color="yellow"
        />
        <StatCard
          icon="home"
          label="Raciones Registradas"
          value={data?.metrics.totalEntries || 0}
          color="purple"
        />
      </div>

      {/* Tarjetas de Aporte Multiespecie */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Gallinas / Pollos */}
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Bird className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Gallinas y Pollos</h3>
              <p className="text-xs text-slate-500">Huevos y carne tradicional</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Carne canal:</span>
              <span className="font-semibold">{((data?.bySpecies.gallina?.meatKg || 0) + (data?.bySpecies.pollo?.meatKg || 0)).toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Huevos:</span>
              <span className="font-semibold">{data?.bySpecies.gallina?.eggs || 0} uds</span>
            </div>
            <div className="flex justify-between text-green-700 font-medium pt-1">
              <span>Ahorro generado:</span>
              <span>$ {((data?.bySpecies.gallina?.savings || 0) + (data?.bySpecies.pollo?.savings || 0)).toLocaleString("es-CO")}</span>
            </div>
          </div>
        </Card>

        {/* Codornices */}
        <Card className="border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
              <Egg className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Codornices</h3>
              <p className="text-xs text-slate-500">Huevos miniatura y carne gourmet</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Carne canal:</span>
              <span className="font-semibold">{(data?.bySpecies.codorniz?.meatKg || 0).toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Huevos:</span>
              <span className="font-semibold">{data?.bySpecies.codorniz?.eggs || 0} uds</span>
            </div>
            <div className="flex justify-between text-green-700 font-medium pt-1">
              <span>Ahorro generado:</span>
              <span>$ {(data?.bySpecies.codorniz?.savings || 0).toLocaleString("es-CO")}</span>
            </div>
          </div>
        </Card>

        {/* Patos */}
        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Feather className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Patos de Engorde</h3>
              <p className="text-xs text-slate-500">Carne rústica hipercalórica</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Carne canal:</span>
              <span className="font-semibold">{(data?.bySpecies.pato?.meatKg || 0).toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rendimiento:</span>
              <span className="font-semibold">~70% en canal</span>
            </div>
            <div className="flex justify-between text-green-700 font-medium pt-1">
              <span>Ahorro generado:</span>
              <span>$ {(data?.bySpecies.pato?.savings || 0).toLocaleString("es-CO")}</span>
            </div>
          </div>
        </Card>

        {/* Conejos */}
        <Card className="border-l-4 border-l-stone-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 shrink-0">
              <Rabbit className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Conejos de Engorde</h3>
              <p className="text-xs text-slate-500">Carne magra y abono huerta</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Carne canal:</span>
              <span className="font-semibold">{(data?.bySpecies.conejo?.meatKg || 0).toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Subproducto:</span>
              <span className="font-semibold">Conejaza para huerta</span>
            </div>
            <div className="flex justify-between text-green-700 font-medium pt-1">
              <span>Ahorro generado:</span>
              <span>$ {(data?.bySpecies.conejo?.savings || 0).toLocaleString("es-CO")}</span>
            </div>
          </div>
        </Card>

        {/* Cuyes */}
        <Card className="border-l-4 border-l-pink-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center text-pink-700 shrink-0">
              <AppIcon icon="paw-print" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Cuyes / Curíes</h3>
              <p className="text-xs text-slate-500">Proteína tradicional andina</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Carne canal:</span>
              <span className="font-semibold">{(data?.bySpecies.cuy?.meatKg || 0).toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Subproducto:</span>
              <span className="font-semibold">Cuyaza para compostaje</span>
            </div>
            <div className="flex justify-between text-green-700 font-medium pt-1">
              <span>Ahorro generado:</span>
              <span>$ {(data?.bySpecies.cuy?.savings || 0).toLocaleString("es-CO")}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráfico de Tendencia Mensual */}
      {data?.monthlyTrends && data.monthlyTrends.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">
            Evolución del Ahorro Familiar y Proteína Cosechada (COP vs Kg)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrends} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" orientation="left" stroke="#16a34a" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#2563eb" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (name === "Ahorro ($ COP)") return [`$ ${Number(value).toLocaleString("es-CO")}`, name];
                    if (name === "Carne (kg)") return [`${value} kg`, name];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="savings" name="Ahorro ($ COP)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="meatKg" name="Carne (kg)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Filtros y Tabla de Registros */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-slate-800">Historial de Consumo Familiar</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Filtrar especie:</label>
            <select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="all">Todas las especies</option>
              <option value="gallina">Gallinas</option>
              <option value="pollo">Pollos</option>
              <option value="codorniz">Codornices</option>
              <option value="pato">Patos</option>
              <option value="conejo">Conejos</option>
              <option value="cuy">Cuyes</option>
            </select>
          </div>
        </div>

        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por especie, producto o destino..."
          resultCount={filteredLogs.length}
          totalCount={data?.logs?.length ?? 0}
          className="mb-4"
        />
        {loading ? (
          <div className="py-12 text-center text-slate-400">Cargando datos de soberanía...</div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon="home"
            message={
              search.trim()
                ? "No hay registros que coincidan con la búsqueda"
                : "No hay registros de consumo familiar para el filtro seleccionado. Al faenar o registrar cosecha con destino autoconsumo aparecerán aquí."
            }
          />
        ) : (
          <Table headers={["Fecha", "Especie", "Producto", "Cantidad", "Valor Ref. Mercado", "Ahorro Estimado", "Lote / Destino", "Acciones"]}>
            {filteredLogs.map((log) => {
              const sp = speciesConfig[log.species] || { label: log.species, icon: "paw-print", badgeColor: "blue" };
              return (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{log.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <AppIcon icon={sp.icon} className="w-4 h-4 text-slate-600" />
                      <span>{sp.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {productTypeLabels[log.productType] || log.productType}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                    {log.quantity} {log.unit}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    $ {Number(log.marketReferencePrice).toLocaleString("es-CO")} /{log.unit}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-bold text-green-700">
                    $ {Number(log.savingsAmount).toLocaleString("es-CO")}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {log.batch?.code ? `Lote ${log.batch.code}` : log.destinationHousehold || "Familia Granja"}
                    {log.notes && <p className="text-slate-400 italic truncate max-w-xs">{log.notes}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                      title="Eliminar registro"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* Modal Registrar Consumo Hogar */}
      <Modal open={modalOpen} title="Registrar Consumo Hogar (Autoconsumo)" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Fecha"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />

              <Select
                label="Especie"
                value={form.species}
                onChange={(e) => handleSpeciesOrProductChange(e.target.value, form.productType)}
              >
                <option value="conejo">Conejo</option>
                <option value="cuy">Cuy</option>
                <option value="codorniz">Codorniz</option>
                <option value="pato">Pato</option>
                <option value="pollo">Pollo</option>
                <option value="gallina">Gallina</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Tipo de Producto"
                value={form.productType}
                onChange={(e) => handleSpeciesOrProductChange(form.species, e.target.value)}
              >
                <option value="carne_canal">Carne en canal</option>
                <option value="huevo">Huevos</option>
                <option value="visceras_subproducto">Vísceras / Menudencias</option>
                <option value="abono_huerta">Abono para huerta</option>
              </Select>

              <Input
                label="Cantidad"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />

              <Input
                label="Unidad"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Precio Ref. Mercado ($ COP)"
                help="Lo que costaría comprar esta unidad o kg en el mercado local"
                type="number"
                step="100"
                required
                value={form.marketReferencePrice}
                onChange={(e) => setForm({ ...form, marketReferencePrice: e.target.value })}
              />

              <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex flex-col justify-center">
                <span className="text-xs text-green-700 font-medium">Ahorro familiar calculado:</span>
                <span className="text-lg font-bold text-green-800">
                  $ {calculatedSavings.toLocaleString("es-CO")}
                </span>
              </div>
            </div>

            <Input
              label="Destino en el Hogar"
              value={form.destinationHousehold}
              onChange={(e) => setForm({ ...form, destinationHousehold: e.target.value })}
            />

            <Textarea
              label="Notas / Observaciones"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ej: Faena de 1 conejo para el almuerzo del domingo"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Guardando..." : "Registrar Ahorro"}
              </Button>
            </div>
          </form>
        </Modal>
    </div>
  );
}

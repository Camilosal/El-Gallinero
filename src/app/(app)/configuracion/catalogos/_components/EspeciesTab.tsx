"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Table, Textarea } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { invalidateSpeciesParamsCache } from "@/lib/use-species-params";

interface SpeciesItem {
  id: string;
  category: string;
  value: string;
  price: string | null;
  units: number | null;
  tipo: string | null;
  minWeeks: number | null;
  maxWeeks: number | null;
  expectedEggsPerHen: string | null;
  dailyFeedG: number | null;
  targetWeightKg: string | null;
  feedCostPerKg: string | null;
  initialUnitCostCop: string | null;
  pointOfLayUnitValueCop: string | null;
  breederUnitValueCop: string | null;
  feedConversionRatio: string | null;
  systemType: string | null;
  description: string | null;
  eggPrice: string | null;
  sortOrder: number;
  isActive: boolean;
}

const SPECIES = [
  { value: "gallina", label: "Gallina" },
  { value: "pollo", label: "Pollo" },
  { value: "codorniz", label: "Codorniz" },
  { value: "pato", label: "Pato" },
  { value: "conejo", label: "Conejo" },
  { value: "cuy", label: "Cuy" },
];

const SYSTEMS = ["piso", "jaula", "pastoreo", "baterias", "mixto"];

const EMPTY = {
  tipo: "gallina",
  value: "",
  price: "",
  units: "",
  minWeeks: "",
  maxWeeks: "",
  expectedEggsPerHen: "",
  dailyFeedG: "",
  targetWeightKg: "",
  feedCostPerKg: "",
  initialUnitCostCop: "",
  pointOfLayUnitValueCop: "",
  breederUnitValueCop: "",
  feedConversionRatio: "",
  systemType: "piso",
  description: "",
  eggPrice: "",
  isActive: "true",
};

export default function EspeciesTab({ mode = "all" }: { mode?: "all" | "prices" }) {
  const pricesOnly = mode === "prices";
  const [items, setItems] = useState<SpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SpeciesItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/catalogos")
      .then((r) => r.json())
      .then((data: SpeciesItem[]) => setItems(data.filter((item) => item.category === "params_especie")))
      .catch(() => setError("No se pudieron cargar los parámetros por especie"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const set = (key: keyof typeof EMPTY, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (item: SpeciesItem) => {
    setEditing(item);
    setForm({
      tipo: item.tipo || "gallina",
      value: item.value,
      price: item.price || "",
      units: item.units != null ? String(item.units) : "",
      minWeeks: item.minWeeks != null ? String(item.minWeeks) : "",
      maxWeeks: item.maxWeeks != null ? String(item.maxWeeks) : "",
      expectedEggsPerHen: item.expectedEggsPerHen || "",
      dailyFeedG: item.dailyFeedG != null ? String(item.dailyFeedG) : "",
      targetWeightKg: item.targetWeightKg || "",
      feedCostPerKg: item.feedCostPerKg || "",
      initialUnitCostCop: item.initialUnitCostCop || "",
      pointOfLayUnitValueCop: item.pointOfLayUnitValueCop || "",
      breederUnitValueCop: item.breederUnitValueCop || "",
      feedConversionRatio: item.feedConversionRatio || "",
      systemType: item.systemType || "piso",
      description: item.description || "",
      eggPrice: item.eggPrice || "",
      isActive: item.isActive ? "true" : "false",
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    if (!form.value.trim()) {
      setError("La raza o nombre es obligatorio");
      return;
    }
    const payload = {
      category: "params_especie",
      ...form,
      isActive: form.isActive === "true",
    };
    const res = await apiFetch("/api/configuracion/catalogos", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Error al guardar");
      return;
    }
    invalidateSpeciesParamsCache();
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este parámetro de especie?")) return;
    await apiFetch(`/api/configuracion/catalogos?id=${id}`, { method: "DELETE" });
    invalidateSpeciesParamsCache();
    load();
  };

  const toggle = async (item: SpeciesItem) => {
    await apiFetch("/api/configuracion/catalogos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, value: item.value, isActive: !item.isActive }),
    });
    invalidateSpeciesParamsCache();
    load();
  };

  const masterItems = pricesOnly
    ? Array.from(items.reduce((bySpecies, item) => {
        const species = item.tipo || "gallina";
        const current = bySpecies.get(species);
        if (!current || (!current.isActive && item.isActive)) bySpecies.set(species, item);
        return bySpecies;
      }, new Map<string, SpeciesItem>()).values())
    : items;

  const visibleItems = masterItems.filter((item) =>
    matchesTextQuery(search, [
      item.tipo,
      item.value,
      item.description,
      item.systemType,
      item.price,
      item.targetWeightKg,
      item.initialUnitCostCop,
      item.pointOfLayUnitValueCop,
      item.breederUnitValueCop,
      item.isActive ? "activo" : "inactivo",
    ]),
  );

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" aria-hidden="true" />
              {pricesOnly ? "Precios y costos por especie" : "Parámetros productivos por especie"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {pricesOnly
                ? "Cada especie aparece una vez. Estos valores alimentan los cálculos y prellenan operaciones nuevas; el precio final de venta sigue siendo ajustable."
                : "Definen el ciclo, peso, conversión alimenticia, rendimiento en canal y precios usados por las calculadoras, el inventario y la valoración de animales."}
            </p>
          </div>
          {!pricesOnly && <Button onClick={openNew}>+ Agregar especie / raza</Button>}
        </div>
      </Card>

      <Card>
        {items.length > 0 && (
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar especie, raza, sistema o parámetro..."
            resultCount={visibleItems.length}
            totalCount={masterItems.length}
            className="mb-4"
          />
        )}
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : items.length === 0 ? (
          <EmptyState icon="chart" message="No hay parámetros por especie" />
        ) : visibleItems.length === 0 ? (
          <EmptyState icon="chart" message="No hay especies o razas que coincidan con la búsqueda" />
        ) : (
          <Table headers={pricesOnly
            ? ["Especie", "Raza / nombre", "$/kg canal", "Costo alimento/kg", "Costo inicial/animal", "Valor postura", "Pie de cría", "$/huevo", "Estado", ""]
            : ["Especie", "Raza / nombre", "$/kg canal", "Rdto.", "Ciclo", "Peso", "Consumo", "FCR", "Huevos/día", "$/huevo", "Estado", ""]}>
            {visibleItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium capitalize">{item.tipo || "—"}</td>
                <td className="px-4 py-3">{item.value}</td>
                <td className="px-4 py-3">{item.price ? `$${Number(item.price).toLocaleString()}` : "—"}</td>
                {pricesOnly ? (
                  <>
                    <td className="px-4 py-3">{item.feedCostPerKg ? `$${Number(item.feedCostPerKg).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">{item.initialUnitCostCop ? `$${Number(item.initialUnitCostCop).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">{item.pointOfLayUnitValueCop ? `$${Number(item.pointOfLayUnitValueCop).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">{item.breederUnitValueCop ? `$${Number(item.breederUnitValueCop).toLocaleString()}` : "—"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">{item.units != null ? `${item.units}%` : "—"}</td>
                    <td className="px-4 py-3 text-xs">{item.minWeeks ?? "—"} sem / {item.maxWeeks ?? "—"} días</td>
                    <td className="px-4 py-3">{item.targetWeightKg ? `${item.targetWeightKg} kg` : "—"}</td>
                    <td className="px-4 py-3">{item.dailyFeedG ? `${item.dailyFeedG} g` : "—"}</td>
                    <td className="px-4 py-3">{item.feedConversionRatio || "—"}</td>
                    <td className="px-4 py-3">{item.expectedEggsPerHen || "—"}</td>
                  </>
                )}
                <td className="px-4 py-3">{item.eggPrice ? `$${Number(item.eggPrice).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3"><Badge color={item.isActive ? "green" : "gray"}>{item.isActive ? "Activo" : "Inactivo"}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">Editar</button>
                    <button onClick={() => toggle(item)} className="text-slate-600 hover:underline">{item.isActive ? "Desactivar" : "Activar"}</button>
                    <button onClick={() => remove(item.id)} className="text-red-600 hover:underline">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={pricesOnly ? "Editar precios y costos de especie" : editing ? "Editar especie / raza" : "Agregar especie / raza"}>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Especie" value={form.tipo} onChange={(e) => set("tipo", e.target.value)} disabled={pricesOnly}>
              {SPECIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Input label="Raza / nombre" value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="Ej: Cobb 500" autoFocus disabled={pricesOnly} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio $/kg canal" type="number" min="0" step="100" value={form.price} onChange={(e) => set("price", e.target.value)} />
            {pricesOnly ? (
              <Input label="Costo alimento ($/kg)" type="number" min="0" step="10" value={form.feedCostPerKg} onChange={(e) => set("feedCostPerKg", e.target.value)} />
            ) : (
              <Input label="Rendimiento canal (%)" type="number" min="0" max="100" step="1" value={form.units} onChange={(e) => set("units", e.target.value)} />
            )}
          </div>
          {!pricesOnly && <div className="grid grid-cols-2 gap-3">
            <Input label="Semanas de ciclo" type="number" min="1" step="1" value={form.minWeeks} onChange={(e) => set("minWeeks", e.target.value)} />
            <Input label="Días de ciclo" type="number" min="1" step="1" value={form.maxWeeks} onChange={(e) => set("maxWeeks", e.target.value)} />
          </div>}
          {!pricesOnly && <div className="grid grid-cols-2 gap-3">
            <Input label="Peso objetivo (kg)" type="number" min="0" step="0.01" value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} />
            <Input label="Consumo (g/animal/día)" type="number" min="0" step="1" value={form.dailyFeedG} onChange={(e) => set("dailyFeedG", e.target.value)} />
          </div>}
          {!pricesOnly && <div className="grid grid-cols-2 gap-3">
            <Input label="Costo alimento ($/kg)" type="number" min="0" step="10" value={form.feedCostPerKg} onChange={(e) => set("feedCostPerKg", e.target.value)} />
            <Input label="Conversión alimenticia (FCR)" type="number" min="0" step="0.01" value={form.feedConversionRatio} onChange={(e) => set("feedConversionRatio", e.target.value)} />
          </div>}
          {!pricesOnly && <div className="grid grid-cols-2 gap-3">
            <Select label="Sistema de producción" value={form.systemType} onChange={(e) => set("systemType", e.target.value)}>
              {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Huevos/hembra/día" type="number" min="0" max="1" step="0.01" value={form.expectedEggsPerHen} onChange={(e) => set("expectedEggsPerHen", e.target.value)} />
          </div>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio de referencia por huevo ($)" type="number" min="0" step="10" value={form.eggPrice} onChange={(e) => set("eggPrice", e.target.value)} />
            <Select label="Estado" value={form.isActive} onChange={(e) => set("isActive", e.target.value)}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          </div>
          {pricesOnly && <div className="grid grid-cols-2 gap-3">
            <Input label="Costo inicial por animal ($)" type="number" min="0" step="100" value={form.initialUnitCostCop} onChange={(e) => set("initialUnitCostCop", e.target.value)} />
            <Input label="Valor unitario al inicio de postura ($)" type="number" min="0" step="100" value={form.pointOfLayUnitValueCop} onChange={(e) => set("pointOfLayUnitValueCop", e.target.value)} />
            <Input label="Valor unitario de pie de cría ($)" type="number" min="0" step="100" value={form.breederUnitValueCop} onChange={(e) => set("breederUnitValueCop", e.target.value)} />
          </div>}
          {!pricesOnly && <Textarea label="Descripción / notas" value={form.description} onChange={(e) => set("description", e.target.value)} />}
          <div className="flex gap-3 pt-2">
            <Button onClick={save}>{editing ? "Actualizar" : "Agregar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

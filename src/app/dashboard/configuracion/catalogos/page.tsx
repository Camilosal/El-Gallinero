"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import ParametrosTab from "./_components/ParametrosTab";
import EspeciesTab from "./_components/EspeciesTab";
import VacunasTab from "./_components/VacunasTab";
import PesosTab from "./_components/PesosTab";
import GallinazaTab from "./_components/GallinazaTab";
import AlimentacionTab from "./_components/AlimentacionTab";
import { MANAGED_SPECIES } from "@/lib/animal-breeds";

interface CatalogItem {
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
  sortOrder: number;
  isActive: boolean;
}

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "raza", label: "Razas por especie", icon: "🐾" },
  { key: "comprador", label: "Compradores", icon: "🤝" },
  { key: "proveedor", label: "Proveedores", icon: "🚚" },
  { key: "tamano_huevo", label: "Tamaños de huevo", icon: "🥚" },
  { key: "presentacion_venta", label: "Presentaciones de venta", icon: "📦" },
  { key: "presentacion_compra", label: "Presentaciones de compra", icon: "🛒" },
  { key: "enfermedad", label: "Enfermedades", icon: "🦠" },
  { key: "unidad_medida", label: "Unidades de medida", icon: "⚖️" },
  { key: "categoria_ingreso", label: "Cat. Ingresos", icon: "📥" },
  { key: "categoria_egreso", label: "Cat. Egresos", icon: "📤" },
  { key: "tipo_sanidad", label: "Tipos sanitarios", icon: "💊" },
  { key: "tipo_mantenimiento", label: "Tareas de mantenimiento", icon: "🔧" },
  { key: "estado_gallina", label: "Estados de gallina", icon: "🐓" },
  { key: "categoria_alimento", label: "Cat. Alimento", icon: "🌿" },
  { key: "tipo_alimento", label: "Tipos de alimento", icon: "🌾" },
  { key: "tipo_ave", label: "Tipos de ave", icon: "🐓" },
  { key: "etapa_crecimiento", label: "Etapas de Crecimiento", icon: "🌱" },
];

function ListasTab() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("raza");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [value, setValue] = useState("");
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("");
  const [tipo, setTipo] = useState("");
  const [minWeeks, setMinWeeks] = useState("");
  const [maxWeeks, setMaxWeeks] = useState("");
  const [expectedEggsPerHen, setExpectedEggsPerHen] = useState("");
  const [dailyFeedG, setDailyFeedG] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [feedCostPerKg, setFeedCostPerKg] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    apiFetch("/api/configuracion/catalogos").then((r) => r.json()).then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((i) => i.category === activeCat);
  const activeCount = filtered.filter((i) => i.isActive).length;

  const searched = useMemo(() => {
    if (!search.trim()) return filtered;
    return filtered.filter((item) =>
      matchesTextQuery(search, [
        item.value,
        item.price,
        item.units,
        item.sortOrder,
        item.isActive ? "activo" : "inactivo",
      ]),
    );
  }, [filtered, search]);

  const openNew = () => {
    setEditing(null);
    setValue("");
    setPrice("");
    setUnits("");
    setTipo("");
    setMinWeeks("");
    setMaxWeeks("");
    setExpectedEggsPerHen("");
    setDailyFeedG("");
    setTargetWeightKg("");
    setFeedCostPerKg("");
    setError("");
    setModalOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setValue(item.value);
    setPrice(item.price || "");
    setUnits(item.units != null ? String(item.units) : "");
    setTipo(activeCat === "raza" ? item.tipo || "gallina" : item.tipo || "");
    setMinWeeks(item.minWeeks != null ? String(item.minWeeks) : "");
    setMaxWeeks(item.maxWeeks != null ? String(item.maxWeeks) : "");
    setExpectedEggsPerHen(item.expectedEggsPerHen || "");
    setDailyFeedG(item.dailyFeedG != null ? String(item.dailyFeedG) : "");
    setTargetWeightKg(item.targetWeightKg || "");
    setFeedCostPerKg(item.feedCostPerKg || "");
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    const v = value.trim();
    if (!v) { setError("El valor no puede estar vacío"); return; }
    if (activeCat === "raza" && !tipo) { setError("Selecciona la especie asociada a esta raza"); return; }
    const method = editing ? "PUT" : "POST";
    const body = editing
      ? { id: editing.id, value: v, price, units, tipo, minWeeks, maxWeeks, expectedEggsPerHen, dailyFeedG, targetWeightKg, feedCostPerKg }
      : { category: activeCat, value: v, price, units, tipo, minWeeks, maxWeeks, expectedEggsPerHen, dailyFeedG, targetWeightKg, feedCostPerKg };
    const res = await apiFetch("/api/configuracion/catalogos", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar");
      return;
    }
    setModalOpen(false);
    load();
  };

  const toggle = async (item: CatalogItem) => {
    await apiFetch("/api/configuracion/catalogos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, value: item.value, isActive: !item.isActive }) });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este valor?")) return;
    await apiFetch(`/api/configuracion/catalogos?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveCat(c.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              activeCat === c.key ? "bg-green-700 text-white border-green-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="mr-1">{c.icon}</span>
            {c.label}
            <span className={`ml-1.5 text-xs ${activeCat === c.key ? "text-green-200" : "text-slate-400"}`}>
              {items.filter((i) => i.category === c.key).length}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-700">
              {CATEGORIES.find((c) => c.key === activeCat)?.icon} {CATEGORIES.find((c) => c.key === activeCat)?.label}
            </h3>
            <p className="text-xs text-slate-400">{activeCount} activos de {filtered.length}</p>
          </div>
          <Button onClick={openNew}>+ Agregar</Button>
        </div>

        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="🗂️" message="No hay valores en este catálogo" />
        ) : (
          <>
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar valor en este catálogo..."
            resultCount={searched.length}
            totalCount={filtered.length}
            className="mb-4"
          />
          {searched.length === 0 ? (
            <EmptyState
              icon="🗂️"
              message={
                search.trim()
                  ? "No hay valores que coincidan con la búsqueda"
                  : "No hay valores en este catálogo"
              }
            />
          ) : (
          <Table headers={
            activeCat === "raza"
              ? ["Raza / tipo", "Especie", "Precio", "Unidades", "Orden", "Estado", ""]
              : activeCat === "etapa_crecimiento"
              ? ["Etapa", "Especie (tipo)", "Sem. Mín", "Sem. Máx", "Huevos/día", "Estado", ""]
              : activeCat === "params_especie"
              ? ["Especie / Raza", "$/kg canal", "Rdto. canal %", "Ciclo sem.", "g/día/ave", "Estado", ""]
              : ["Valor", "Precio", "Unidades", "Orden", "Estado", ""]
          }>
            {searched.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{item.value}</td>
                {activeCat === "raza" ? (
                  <>
                    <td className="px-4 py-3 text-sm">{MANAGED_SPECIES.find((species) => species.value === (item.tipo || "gallina"))?.label || item.tipo || "Gallina"}</td>
                    <td className="px-4 py-3 text-sm">{item.price ? `$${Number(item.price).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.units != null ? item.units : "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{item.sortOrder}</td>
                  </>
                ) : activeCat === "etapa_crecimiento" ? (
                  <>
                    <td className="px-4 py-3 text-sm">{item.tipo || "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.minWeeks != null ? `${item.minWeeks} sem` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.maxWeeks != null ? `${item.maxWeeks} sem` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.expectedEggsPerHen ? item.expectedEggsPerHen : "—"}</td>
                  </>
                ) : activeCat === "params_especie" ? (
                  <>
                    <td className="px-4 py-3 text-sm">{item.price ? `$${Number(item.price).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.units != null ? `${item.units}%` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.minWeeks != null ? `${item.minWeeks}` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.dailyFeedG != null ? `${item.dailyFeedG} g` : "—"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-sm">{item.price ? `$${Number(item.price).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{item.units != null ? item.units : "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{item.sortOrder}</td>
                  </>
                )}
                <td className="px-4 py-3">
                  <Badge color={item.isActive ? "green" : "gray"}>{item.isActive ? "Activo" : "Inactivo"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => toggle(item)} className="text-slate-600 hover:underline text-xs">
                      {item.isActive ? "Desactivar" : "Activar"}
                    </button>
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(item.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          )}
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "✏️ Editar valor" : `➕ Agregar a ${CATEGORIES.find((c) => c.key === activeCat)?.label}`}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input
            label="Valor"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nombre del valor"
            autoFocus
            help="El texto que aparecerá en el campo de selección del catálogo"
          />
          <Input
            label={
              activeCat === "params_especie"
                ? "Precio de mercado $/kg canal (COP)"
                : activeCat === "tamano_huevo"
                ? "Precio ($) — se usará al vender"
                : "Precio ($) — opcional"
            }
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: 600"
            help="Precio asociado a este valor. Para tamaños de huevo se usa como precio de venta."
          />
          {activeCat === "presentacion_venta" && (
            <Input
              label="Unidades por presentación"
              type="number"
              min="1"
              step="1"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="Ej: docena = 12, caja x30 = 30"
              help="Cuántas unidades contiene esta presentación (ej: docena = 12)"
            />
          )}
          {activeCat === "raza" && (
            <Select label="Especie asociada" value={tipo} onChange={(e) => setTipo(e.target.value)} help="Esta raza solo aparecerá al registrar o filtrar animales de la especie seleccionada.">
              {MANAGED_SPECIES.map((species) => <option key={species.value} value={species.value}>{species.label}</option>)}
            </Select>
          )}
          {/* Especie/tipo — para parámetros y etapas */}
          {(activeCat === "params_especie" || activeCat === "etapa_crecimiento") && (
            <Input
              label="Especie (tipo)"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Ej: pollo, gallina, codorniz, pato, conejo"
              help="Especie o subtipo al que pertenece este registro"
            />
          )}
          {/* Campos para etapa_crecimiento */}
          {activeCat === "etapa_crecimiento" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Semanas mínimas"
                  type="number"
                  min="0"
                  step="1"
                  value={minWeeks}
                  onChange={(e) => setMinWeeks(e.target.value)}
                  placeholder="Ej: 0"
                />
                <Input
                  label="Semanas máximas"
                  type="number"
                  min="0"
                  step="1"
                  value={maxWeeks}
                  onChange={(e) => setMaxWeeks(e.target.value)}
                  placeholder="Ej: 6 (vacío = abierto)"
                />
              </div>
              <Input
                label="Huevos/ave/día (esperados)"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={expectedEggsPerHen}
                onChange={(e) => setExpectedEggsPerHen(e.target.value)}
                placeholder="Ej: 0.85"
                help="Solo para etapas de postura. 0 = no produce huevos."
              />
            </>
          )}
          {/* Campos para params_especie */}
          {activeCat === "params_especie" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Rendimiento canal (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="Ej: 72"
                  help="Porcentaje de peso vivo que se convierte en canal"
                />
                <Input
                  label="Semanas de ciclo"
                  type="number"
                  min="1"
                  step="1"
                  value={minWeeks}
                  onChange={(e) => setMinWeeks(e.target.value)}
                  placeholder="Ej: 7"
                  help="Duración total del ciclo productivo en semanas"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Peso objetivo vivo (kg)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  placeholder="Ej: 2.5"
                />
                <Input
                  label="Consumo diario (g/ave/día)"
                  type="number"
                  min="0"
                  step="1"
                  value={dailyFeedG}
                  onChange={(e) => setDailyFeedG(e.target.value)}
                  placeholder="Ej: 120"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Costo alimento ($/kg)"
                  type="number"
                  min="0"
                  value={feedCostPerKg}
                  onChange={(e) => setFeedCostPerKg(e.target.value)}
                  placeholder="Ej: 2800"
                />
                <Input
                  label="Huevos/hembra/día (si aplica)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={expectedEggsPerHen}
                  onChange={(e) => setExpectedEggsPerHen(e.target.value)}
                  placeholder="Ej: 0.9 (codorniz)"
                />
              </div>
            </>
          )}
          <div className="flex gap-3">
            <Button onClick={save}>{editing ? "Actualizar" : "Agregar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const TABS = [
  { key: "listas", label: "Listas", icon: "🗂️" },
  { key: "parametros", label: "Parámetros globales", icon: "⚙️" },
  { key: "especies", label: "Especies", icon: "📊" },
  { key: "vacunas", label: "Vacunas", icon: "💉" },
  { key: "pesos", label: "Estándares de peso", icon: "⚖️" },
  { key: "gallinaza", label: "Factores de gallinaza", icon: "🌱" },
  { key: "alimentacion", label: "Programas de alimentación", icon: "🌾" },
];

export default function CatalogosPage() {
  const [tab, setTab] = useState("listas");

  return (
    <div>
      <PageHeader
        title="🗂️ Catálogos y Datos Maestros"
        description="Administra listas, parámetros de cálculo y tablas técnicas que alimentan todo el sistema"
        help="Este es el centro de datos maestros del gallinero. En 'Listas' están las opciones de selección; cada raza se asocia a su especie para que los formularios no mezclen animales incompatibles. En 'Parámetros globales' están los valores de cálculo y en las demás pestañas se administran parámetros por especie, vacunas, estándares de peso, factores de gallinaza y programas de alimentación."
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              tab === item.key
                ? "bg-green-700 text-white border-green-700"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="mr-1">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "listas" && <ListasTab />}
      {tab === "parametros" && <ParametrosTab />}
      {tab === "especies" && <EspeciesTab />}
      {tab === "vacunas" && <VacunasTab />}
      {tab === "pesos" && <PesosTab />}
      {tab === "gallinaza" && <GallinazaTab />}
      {tab === "alimentacion" && <AlimentacionTab />}
    </div>
  );
}

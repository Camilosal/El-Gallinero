"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { PageHeader, HeroActionLink, Button, Card, Table, Badge, Modal, Input, Select, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";
import ParametrosTab from "./_components/ParametrosTab";
import EspeciesTab from "./_components/EspeciesTab";
import ContactsDirectory from "@/components/contacts/ContactsDirectory";
import VacunasTab from "./_components/VacunasTab";
import PesosTab from "./_components/PesosTab";
import GallinazaTab from "./_components/GallinazaTab";
import AlimentacionTab from "./_components/AlimentacionTab";
import FuentesExternasTab from "./_components/FuentesExternasTab";
import NormasGuiasTab from "./_components/NormasGuiasTab";
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
  sortOrder: number;
  isActive: boolean;
}

interface CatalogCategoryDef {
  key: string;
  label: string;
  icon: string;
  group: string;
}

const CATEGORY_GROUPS: { id: string; title: string }[] = [
  { id: "animales", title: "Animales y especies" },
  { id: "produccion", title: "Producción y ventas" },
  { id: "alimentacion", title: "Alimentación e insumos" },
  { id: "sanidad", title: "Sanidad y mantenimiento" },
  { id: "finanzas", title: "Finanzas" },
];

const CATEGORIES: CatalogCategoryDef[] = [
  // Animales y especies
  { key: "raza", label: "Razas por especie", icon: "paw-print", group: "animales" },
  { key: "tipo_ave", label: "Tipos de animal", icon: "bird", group: "animales" },
  { key: "etapa_crecimiento", label: "Etapas de crecimiento", icon: "sprout", group: "animales" },
  { key: "estado_gallina", label: "Estados de animal / lote", icon: "rooster", group: "animales" },
  { key: "causa_mortalidad", label: "Causas de mortalidad", icon: "mortality", group: "animales" },
  // Producción y ventas
  { key: "tamano_huevo", label: "Tamaños de huevo (NTC 1240)", icon: "egg", group: "produccion" },
  { key: "presentacion_venta", label: "Presentaciones de venta", icon: "package", group: "produccion" },
  { key: "presentacion_compra", label: "Presentaciones de compra", icon: "cart", group: "produccion" },
  { key: "unidad_medida", label: "Unidades de medida", icon: "scale", group: "produccion" },
  // Alimentación e insumos
  { key: "categoria_alimento", label: "Categorías de alimento", icon: "leaf", group: "alimentacion" },
  { key: "tipo_alimento", label: "Tipos de alimento", icon: "wheat", group: "alimentacion" },
  { key: "categoria_insumo", label: "Categorías de insumos", icon: "package-open", group: "alimentacion" },
  // Sanidad y mantenimiento
  { key: "tipo_sanidad", label: "Tipos de evento sanitario", icon: "pill", group: "sanidad" },
  { key: "enfermedad", label: "Enfermedades y diagnósticos", icon: "health", group: "sanidad" },
  { key: "tipo_mantenimiento", label: "Tareas de mantenimiento", icon: "wrench", group: "sanidad" },
  // Finanzas
  { key: "categoria_ingreso", label: "Categorías de ingreso", icon: "incoming", group: "finanzas" },
  { key: "categoria_egreso", label: "Categorías de egreso", icon: "outgoing", group: "finanzas" },
];

const CATEGORIES_WITH_TIPO_TEXT = new Set([
  "presentacion_venta",
  "tipo_alimento",
  "tipo_ave",
]);

function ListasTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get("category");
  const isLegacyContactCat = requestedCategory === "comprador" || requestedCategory === "proveedor";

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(() =>
    requestedCategory && CATEGORIES.some((item) => item.key === requestedCategory)
      ? requestedCategory
      : "raza",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [value, setValue] = useState("");
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("");
  const [tipo, setTipo] = useState("");
  const [minWeeks, setMinWeeks] = useState("");
  const [maxWeeks, setMaxWeeks] = useState("");
  const [expectedEggsPerHen, setExpectedEggsPerHen] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const selectCategory = (key: string) => {
    setActiveCat(key);
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "listas");
    params.set("category", key);
    router.replace(`/configuracion/catalogos?${params.toString()}`, { scroll: false });
  };

  const load = useCallback(() => {
    apiFetch("/api/configuracion/catalogos")
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeDef = CATEGORIES.find((c) => c.key === activeCat);
  const filtered = items.filter((i) => i.category === activeCat);
  const activeCount = filtered.filter((i) => i.isActive).length;

  const searched = useMemo(() => {
    if (!search.trim()) return filtered;
    return filtered.filter((item) =>
      matchesTextQuery(search, [
        item.value,
        item.tipo,
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
    setTipo(activeCat === "raza" ? "gallina" : "");
    setMinWeeks("");
    setMaxWeeks("");
    setExpectedEggsPerHen("");
    setError("");
    setModalOpen(true);
  };

  useActionQuery(isLegacyContactCat ? null : searchParams.get("nuevo"), { "1": openNew });

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setValue(item.value);
    setPrice(item.price || "");
    setUnits(item.units != null ? String(item.units) : "");
    setTipo(activeCat === "raza" ? item.tipo || "gallina" : item.tipo || "");
    setMinWeeks(item.minWeeks != null ? String(item.minWeeks) : "");
    setMaxWeeks(item.maxWeeks != null ? String(item.maxWeeks) : "");
    setExpectedEggsPerHen(item.expectedEggsPerHen || "");
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    const v = value.trim();
    if (!v) {
      setError("El valor no puede estar vacío");
      return;
    }
    if (activeCat === "raza" && !tipo) {
      setError("Selecciona la especie asociada a esta raza");
      return;
    }
    const method = editing ? "PUT" : "POST";
    const body = editing
      ? { id: editing.id, value: v, price, units, tipo, minWeeks, maxWeeks, expectedEggsPerHen }
      : { category: activeCat, value: v, price, units, tipo, minWeeks, maxWeeks, expectedEggsPerHen };

    const res = await apiFetch("/api/configuracion/catalogos", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar");
      return;
    }
    setModalOpen(false);
    load();
  };

  const toggle = async (item: CatalogItem) => {
    await apiFetch("/api/configuracion/catalogos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, value: item.value, isActive: !item.isActive }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este valor?")) return;
    await apiFetch(`/api/configuracion/catalogos?id=${id}`, { method: "DELETE" });
    load();
  };

  if (isLegacyContactCat) {
    return (
      <ContactsDirectory
        embedded
        initialRole={requestedCategory === "comprador" ? "cliente" : "proveedor"}
        actionNuevo={searchParams.get("nuevo")}
      />
    );
  }

  const showTipoCol =
    activeCat === "raza" ||
    activeCat === "etapa_crecimiento" ||
    CATEGORIES_WITH_TIPO_TEXT.has(activeCat);

  const tableHeaders =
    activeCat === "etapa_crecimiento"
      ? ["Etapa", "Especie", "Sem. Mín", "Sem. Máx", "Huevos/día", "Estado", ""]
      : showTipoCol
        ? [activeCat === "raza" ? "Raza" : "Valor", activeCat === "raza" ? "Especie" : "Tipo", "Precio", "Unidades", "Orden", "Estado", ""]
        : ["Valor", "Precio", "Unidades", "Orden", "Estado", ""];

  return (
    <div className="space-y-5">
      <Card>
        <div className="space-y-4">
          {CATEGORY_GROUPS.map((group) => {
            const groupCats = CATEGORIES.filter((c) => c.group === group.id);
            return (
              <div key={group.id}>
                <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {group.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {groupCats.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => selectCategory(c.key)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border ${
                        activeCat === c.key
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <AppIcon icon={c.icon} className="w-4 h-4" />
                      <span>{c.label}</span>
                      <span
                        className={`ml-0.5 text-xs ${
                          activeCat === c.key ? "text-green-200" : "text-slate-400"
                        }`}
                      >
                        {items.filter((i) => i.category === c.key).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <AppIcon icon={activeDef?.icon || "folder"} className="w-4 h-4 text-slate-500" />
              {activeDef?.label}
            </h3>
            <p className="text-xs text-slate-400">
              {activeCount} activos de {filtered.length}
            </p>
          </div>
          <Button onClick={openNew}>+ Agregar</Button>
        </div>

        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="folder" message="No hay valores en este catálogo todavía. Usa '+ Agregar' para crear el primero." />
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
              <EmptyState icon="folder" message="No hay valores que coincidan con la búsqueda" />
            ) : (
              <Table headers={tableHeaders}>
                {searched.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{item.value}</td>
                    {activeCat === "etapa_crecimiento" ? (
                      <>
                        <td className="px-4 py-3 text-sm">
                          {MANAGED_SPECIES.find((s) => s.value === item.tipo)?.label || item.tipo || "General"}
                        </td>
                        <td className="px-4 py-3 text-sm">{item.minWeeks != null ? `${item.minWeeks} sem` : "—"}</td>
                        <td className="px-4 py-3 text-sm">{item.maxWeeks != null ? `${item.maxWeeks} sem` : "—"}</td>
                        <td className="px-4 py-3 text-sm">{item.expectedEggsPerHen || "—"}</td>
                      </>
                    ) : (
                      <>
                        {showTipoCol && (
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {activeCat === "raza"
                              ? MANAGED_SPECIES.find((s) => s.value === (item.tipo || "gallina"))?.label || item.tipo || "Gallina"
                              : item.tipo || "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm">{item.price ? `$${Number(item.price).toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3 text-sm">{item.units != null ? item.units : "—"}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{item.sortOrder}</td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <Badge color={item.isActive ? "green" : "gray"}>
                        {item.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => toggle(item)} className="text-slate-600 hover:underline text-xs">
                          {item.isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline text-xs">
                          Editar
                        </button>
                        <button onClick={() => remove(item.id)} className="text-red-600 hover:underline text-xs">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar en ${activeDef?.label}` : `Agregar a ${activeDef?.label}`}
      >
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
              activeCat === "tamano_huevo"
                ? "Precio ($) — se usará al vender"
                : "Precio ($) — opcional"
            }
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: 600"
            help="Precio unitario de referencia asociado a este elemento."
          />
          {(activeCat === "presentacion_venta" || activeCat === "presentacion_compra") && (
            <Input
              label="Unidades / peso por presentación"
              type="number"
              min="1"
              step="1"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder={activeCat === "presentacion_compra" ? "Ej: bulto = 40 (kg)" : "Ej: cubeta = 30"}
              help="Equivalencia numérica usada al convertir compras o ventas."
            />
          )}
          {activeCat === "raza" && (
            <Select
              label="Especie asociada"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              help="Esta raza solo aparecerá al registrar o filtrar animales de la especie seleccionada."
            >
              {MANAGED_SPECIES.map((species) => (
                <option key={species.value} value={species.value}>
                  {species.label}
                </option>
              ))}
            </Select>
          )}
          {activeCat === "etapa_crecimiento" && (
            <>
              <Select
                label="Especie asociada (opcional)"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                help="Si aplica a todas las aves o a una especie concreta."
              >
                <option value="">General / Todas</option>
                {MANAGED_SPECIES.map((species) => (
                  <option key={species.value} value={species.value}>
                    {species.label}
                  </option>
                ))}
              </Select>
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
                  placeholder="Vacío = abierto"
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
          {CATEGORIES_WITH_TIPO_TEXT.has(activeCat) && (
            <Input
              label="Subtipo o línea (opcional)"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder={
                activeCat === "presentacion_venta"
                  ? "Ej: huevos_codorniz, carne_conejo, abono"
                  : activeCat === "tipo_ave"
                    ? "Ej: ave o mamifero"
                    : "Ej: cunicultura, coturnicultura, forraje_fresco"
              }
            />
          )}
          <div className="flex gap-3">
            <Button onClick={save}>{editing ? "Actualizar" : "Agregar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const TABS = [
  { key: "parametros", label: "Datos de la granja", icon: "settings" },
  { key: "especies", label: "Especies", icon: "paw-print" },
  { key: "listas", label: "Listas maestras", icon: "folder" },
  { key: "vacunas", label: "Vacunas", icon: "vaccine" },
  { key: "pesos", label: "Estándares de peso", icon: "scale" },
  { key: "gallinaza", label: "Factores de gallinaza", icon: "sprout" },
  { key: "alimentacion", label: "Programas de alimentación", icon: "wheat" },
  { key: "contactos", label: "Clientes y Proveedores", icon: "handshake" },
  { key: "fuentes", label: "Tablas maestras externas", icon: "globe" },
  { key: "normas", label: "Normas, estándares y guías", icon: "book-open" },
];

export default function CatalogosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTab = searchParams.get("tab");
  const requestedCategory = searchParams.get("category");
  const requestedTable = searchParams.get("table");
  const effectiveTab =
    requestedCategory === "comprador" || requestedCategory === "proveedor"
      ? "contactos"
      : requestedTab === "fuentes" && requestedTable === "normas"
        ? "normas"
        : TABS.some((item) => item.key === requestedTab)
          ? requestedTab!
          : "parametros";

  const selectTab = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    params.delete("nuevo");
    if (key !== "listas") params.delete("category");
    if (key !== "fuentes") params.delete("table");
    router.replace(`/configuracion/catalogos?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogos y Datos Maestros"
        description="Ajuste en un solo lugar las reglas que guían el día a día de su granja: metas de postura y peso, planes de vacunación, raciones por especie, factores de aprovechamiento, normas, estándares y guías con adjuntos, y las tablas oficiales sincronizadas de municipios, precios de referencia, medicamentos ICA y festivos."
        help="Cada tabla que configure aquí se aplica de inmediato en la operación: calcula cuánto concentrado repartir por galpón, bloquea ventas cuando hay retiro sanitario vigente, clasifica los huevos por calibre, compara sus márgenes frente al mercado regional y organiza turnos de trabajo en días festivos."
        actions={
          <HeroActionLink href="/configuracion" tone="glass">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Configuración</span>
          </HeroActionLink>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => selectTab(item.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              effectiveTab === item.key
                ? "bg-green-700 text-white border-green-700"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <AppIcon icon={item.icon} className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      {effectiveTab === "parametros" && <ParametrosTab />}
      {effectiveTab === "especies" && <EspeciesTab />}
      {effectiveTab === "listas" && <ListasTab />}
      {effectiveTab === "vacunas" && <VacunasTab />}
      {effectiveTab === "pesos" && <PesosTab />}
      {effectiveTab === "gallinaza" && <GallinazaTab />}
      {effectiveTab === "alimentacion" && <AlimentacionTab />}
      {effectiveTab === "contactos" && (
        <ContactsDirectory
          embedded
          initialRole={requestedCategory === "comprador" ? "cliente" : requestedCategory === "proveedor" ? "proveedor" : undefined}
          actionNuevo={searchParams.get("nuevo")}
        />
      )}
      {effectiveTab === "fuentes" && <FuentesExternasTab />}
      {effectiveTab === "normas" && <NormasGuiasTab />}
    </div>
  );
}

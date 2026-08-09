"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface CatalogItem {
  id: string;
  category: string;
  value: string;
  price: string | null;
  units: number | null;
  sortOrder: number;
  isActive: boolean;
}

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "raza", label: "Razas", icon: "🐔" },
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
];

export default function CatalogosPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("raza");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [value, setValue] = useState("");
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiFetch("/api/configuracion/catalogos").then((r) => r.json()).then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((i) => i.category === activeCat);
  const activeCount = filtered.filter((i) => i.isActive).length;

  const openNew = () => {
    setEditing(null);
    setValue("");
    setPrice("");
    setUnits("");
    setError("");
    setModalOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setValue(item.value);
    setPrice(item.price || "");
    setUnits(item.units != null ? String(item.units) : "");
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    const v = value.trim();
    if (!v) { setError("El valor no puede estar vacío"); return; }
    const method = editing ? "PUT" : "POST";
    const body = editing ? { id: editing.id, value: v, price, units } : { category: activeCat, value: v, price, units };
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
      <PageHeader
        title="🗂️ Catálogos y Datos Maestros"
        description="Administra las opciones de los campos de selección: razas, compradores, proveedores, unidades, tamaños y más"
        help="Aquí se administran todos los catálogos del sistema: las opciones que aparecen en los campos de selección (dropdowns) de todo el gallinero. Incluye razas de aves, compradores, proveedores, unidades de medida, tamaños de huevo, categorías de insumos, motivos de movimiento, presentaciones, y más. Agregar o editar opciones aquí se refleja inmediatamente en todos los formularios del sistema."
      />

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
          <Table headers={["Valor", "Precio", "Unidades", "Orden", "Estado", ""]}>
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{item.value}</td>
                <td className="px-4 py-3 text-sm">{item.price ? `$${Number(item.price).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-sm">{item.units != null ? item.units : "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{item.sortOrder}</td>
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
            label={`Precio ($)${activeCat === "tamano_huevo" ? " — se usará al vender" : " — opcional"}`}
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
          <div className="flex gap-3">
            <Button onClick={save}>{editing ? "Actualizar" : "Agregar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

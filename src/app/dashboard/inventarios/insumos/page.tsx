"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

interface Supply {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  supplier: string | null;
  expiryDate: string | null;
}

interface Movement {
  id: string;
  supplyId: string;
  quantity: string;
  isEntry: boolean;
  movementType: string;
  date: string;
  notes: string | null;
  supplyName: string | null;
  supplyUnit: string | null;
}

const supplyCategories = ["medicamento", "vacuna", "desinfectante", "limpieza", "equipo", "otro"];
const movementTypes = ["compra", "donacion", "ajuste", "consumo", "merma", "otro"];

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function InsumosPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [movError, setMovError] = useState("");
  const [form, setForm] = useState({ name: "", category: supplyCategories[0], unit: "unidades", currentStock: "", minStock: "", costPerUnit: "", supplier: "", expiryDate: "" });
  const [movForm, setMovForm] = useState({ supplyId: "", quantity: "", isEntry: true, movementType: movementTypes[0], date: new Date().toISOString().split("T")[0], notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplySearch, setSupplySearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");

  const load = useCallback(async () => {
    const [supRes, movRes] = await Promise.all([
      apiFetch("/api/inventarios/insumos"),
      apiFetch("/api/inventarios/insumos/movimientos"),
    ]);
    if (supRes.ok) setSupplies(await supRes.json());
    if (movRes.ok) setMovements(await movRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const lowStockItems = supplies.filter((s) => Number(s.currentStock) <= Number(s.minStock));
  const totalValue = supplies.reduce((s, item) => s + Number(item.currentStock) * Number(item.costPerUnit), 0);

  const filteredSupplies = useMemo(() => {
    if (!supplySearch.trim()) return supplies;
    return supplies.filter((supply) =>
      matchesTextQuery(supplySearch, [
        supply.name,
        supply.category,
        supply.unit,
        supply.supplier,
        supply.currentStock,
        supply.minStock,
        supply.costPerUnit,
        supply.expiryDate,
      ]),
    );
  }, [supplies, supplySearch]);

  const filteredMovements = useMemo(() => {
    if (!movementSearch.trim()) return movements;
    return movements.filter((movement) =>
      matchesTextQuery(movementSearch, [
        movement.date,
        movement.supplyName,
        movement.movementType,
        movement.isEntry ? "entrada" : "salida",
        movement.quantity,
        movement.supplyUnit,
        movement.notes,
      ]),
    );
  }, [movements, movementSearch]);

  const saveSupply = async () => {
    setError("");
    if (!form.name) return setError("Nombre es requerido");
    const res = await apiFetch("/api/inventarios/insumos", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Error al guardar");
    }
    setSupplyModalOpen(false);
    setEditingId(null);
    setForm({ name: "", category: supplyCategories[0], unit: "unidades", currentStock: "", minStock: "", costPerUnit: "", supplier: "", expiryDate: "" });
    load();
  };

  const saveMovement = async () => {
    setMovError("");
    if (!movForm.supplyId) return setMovError("Seleccione un insumo");
    if (!movForm.quantity || Number(movForm.quantity) <= 0) return setMovError("Cantidad debe ser mayor a 0");
    const res = await apiFetch("/api/inventarios/insumos/movimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movForm),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setMovError(d.error || "Error al guardar");
    }
    setMovementModalOpen(false);
    setMovForm({ supplyId: "", quantity: "", isEntry: true, movementType: movementTypes[0], date: new Date().toISOString().split("T")[0], notes: "" });
    load();
  };

  const removeSupply = async (id: string) => {
    if (!confirm("¿Eliminar este insumo y todos sus movimientos?")) return;
    await apiFetch(`/api/inventarios/insumos?id=${id}`, { method: "DELETE" });
    load();
  };

  const removeMovement = async (id: string) => {
    if (!confirm("¿Eliminar este movimiento? Se revertirá el stock.")) return;
    await apiFetch(`/api/inventarios/insumos/movimientos?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="🧰 Insumos"
        description="Inventario de insumos no alimenticios y sus movimientos"
        help="Gestiona el inventario de insumos no alimenticios (medicamentos, vacunas, productos de limpieza, equipos, etc.). Registra entradas y salidas por movimiento. Cada insumo tiene stock mínimo para alertas de reabastecimiento, costo unitario y proveedor. Los movimientos registran fecha, cantidad, tipo y notas."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setMovForm({ supplyId: supplies[0]?.id || "", quantity: "", isEntry: true, movementType: movementTypes[0], date: new Date().toISOString().split("T")[0], notes: "" }); setMovError(""); setMovementModalOpen(true); }}>Registrar Movimiento</Button>
            <Button onClick={() => { setEditingId(null); setForm({ name: "", category: supplyCategories[0], unit: "unidades", currentStock: "", minStock: "", costPerUnit: "", supplier: "", expiryDate: "" }); setError(""); setSupplyModalOpen(true); }}>+ Nuevo Insumo</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🧰" label="Total insumos" value={String(supplies.length)} color="blue" />
        <StatCard icon="💰" label="Valor inventario" value={fmt(totalValue)} color="green" />
        <StatCard icon="⚠️" label="Stock bajo" value={String(lowStockItems.length)} color="red" />
        <StatCard icon="📋" label="Movimientos" value={String(movements.length)} color="purple" />
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-700 mb-3">⚠️ Alertas de Stock Bajo</h3>
          <div className="space-y-2">
            {lowStockItems.map((s) => (
              <div key={s.id} className="flex justify-between items-center p-2 bg-white rounded">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-sm text-red-600">
                  {s.currentStock} / {s.minStock} {s.unit}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold text-slate-700 mb-3">Inventario de Insumos</h3>
        <TableSearch
          value={supplySearch}
          onChange={setSupplySearch}
          placeholder="Buscar por nombre, categoría o proveedor..."
          resultCount={filteredSupplies.length}
          totalCount={supplies.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredSupplies.length === 0 ? (
          <EmptyState
            icon="🧰"
            message={
              supplySearch.trim()
                ? "No hay insumos que coincidan con la búsqueda"
                : "No hay insumos registrados"
            }
          />
        ) : (
          <Table headers={["Nombre", "Categoría", "Stock", "Mínimo", "Unidad", "Costo Unit.", "Proveedor", "Acciones"]}>
            {filteredSupplies.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium">{s.name}</td>
                <td className="px-4 py-3"><Badge color="blue">{s.category}</Badge></td>
                <td className="px-4 py-3 text-sm">
                  <span className={Number(s.currentStock) <= Number(s.minStock) ? "text-red-600 font-bold" : ""}>
                    {s.currentStock}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{s.minStock}</td>
                <td className="px-4 py-3 text-sm">{s.unit}</td>
                <td className="px-4 py-3 text-sm">{fmt(Number(s.costPerUnit))}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{s.supplier || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingId(s.id);
                      setForm({ name: s.name, category: s.category, unit: s.unit, currentStock: s.currentStock, minStock: s.minStock, costPerUnit: s.costPerUnit, supplier: s.supplier || "", expiryDate: s.expiryDate || "" });
                      setError("");
                      setSupplyModalOpen(true);
                    }} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => removeSupply(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-700 mb-3">Historial de Movimientos</h3>
        <TableSearch
          value={movementSearch}
          onChange={setMovementSearch}
          placeholder="Buscar por insumo, motivo o nota..."
          resultCount={filteredMovements.length}
          totalCount={movements.length}
          className="mb-4"
        />
        {filteredMovements.length === 0 ? (
          <EmptyState
            icon="📋"
            message={
              movementSearch.trim()
                ? "No hay movimientos que coincidan con la búsqueda"
                : "No hay movimientos registrados"
            }
          />
        ) : (
          <Table headers={["Fecha", "Insumo", "Tipo", "Motivo", "Cantidad", "Notas", "Acciones"]}>
            {filteredMovements.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{m.date}</td>
                <td className="px-4 py-3 text-sm">{m.supplyName || "—"}</td>
                <td className="px-4 py-3">
                  <Badge color={m.isEntry ? "green" : "red"}>
                    {m.isEntry ? "📥 Entrada" : "📤 Salida"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">{m.movementType}</td>
                <td className="px-4 py-3 text-sm font-medium">{m.quantity} {m.supplyUnit || ""}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-[150px] truncate">{m.notes || "—"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => removeMovement(m.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={supplyModalOpen} onClose={() => { setSupplyModalOpen(false); setEditingId(null); }} title={editingId ? "✏️ Editar Insumo" : "🧰 Nuevo Insumo"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Vacuna Newcastle" required help="Nombre descriptivo del insumo" />
          <Select label="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} help="Clasificación del insumo (vacunas, limpieza, equipo, etc.)">
            {supplyCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Unidad de medida" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Ej: unidades, litros, kg" help="Unidad en que se mide el insumo (unidades, litros, kg, cajas...)" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock inicial" type="number" step="0.01" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} help="Cantidad con la que inicia o se tiene actualmente" />
            <Input label="Stock mínimo" type="number" step="0.01" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} help="Cantidad mínima antes de generar alerta de reabastecimiento" />
          </div>
          <Input label="Costo unitario ($)" type="number" step="0.01" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} help="Costo por cada unidad del insumo" />
          <Input label="Proveedor" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} help="Nombre del proveedor habitual de este insumo" />
          <Input label="Fecha de vencimiento" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} help="Fecha de caducidad si aplica (para control de vencimientos)" />
          <div className="flex gap-3">
            <Button onClick={saveSupply} disabled={!form.name}>Guardar</Button>
            <Button variant="secondary" onClick={() => setSupplyModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={movementModalOpen} onClose={() => setMovementModalOpen(false)} title="📋 Registrar Movimiento">
        <div className="space-y-4">
          {movError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{movError}</p>}
          <Select label="Insumo" value={movForm.supplyId} onChange={(e) => setMovForm({ ...movForm, supplyId: e.target.value })} help="Selecciona el insumo al que aplica el movimiento">
            <option value="">Seleccionar...</option>
            {supplies.map((s) => <option key={s.id} value={s.id}>{s.name} (Stock: {s.currentStock} {s.unit})</option>)}
          </Select>
          <Select label="Tipo" value={movForm.isEntry ? "entry" : "exit"} onChange={(e) => setMovForm({ ...movForm, isEntry: e.target.value === "entry" })} help="Entrada = agregas stock, Salida = reduces stock">
            <option value="entry">📥 Entrada</option>
            <option value="exit">📤 Salida</option>
          </Select>
          <Select label="Motivo" value={movForm.movementType} onChange={(e) => setMovForm({ ...movForm, movementType: e.target.value })} help="Razón del movimiento (compra, consumo, devolución, ajuste, etc.)">
            {movementTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Cantidad" type="number" step="0.01" min="0" value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })} required help="Cantidad de unidades que entran o salen" />
          <Input label="Fecha" type="date" value={movForm.date} onChange={(e) => setMovForm({ ...movForm, date: e.target.value })} help="Fecha en que se realiza el movimiento" />
          <Textarea label="Notas" value={movForm.notes} onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })} help="Observaciones adicionales sobre el movimiento" />
          <div className="flex gap-3">
            <Button onClick={saveMovement} disabled={!movForm.supplyId || !movForm.quantity}>Guardar</Button>
            <Button variant="secondary" onClick={() => setMovementModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import { Card, StatCard, PageHeader, Button, Input, Select, Textarea, Modal, Table, Badge, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

type Acquisition = {
  id: string;
  date: string;
  acquisitionType: string;
  birdType: string;
  quantity: number;
  unitCost: string | null;
  totalCost: string | null;
  supplier: string | null;
  breed: string | null;
  birthDate: string | null;
  notes: string | null;
  createdAt: string;
};

interface InventorySummary {
  totalAnimals: number;
  totalBirds: number;
  totalNonBirds: number;
  registeredHens: number;
  activeHens: number;
  layingHens: number;
  activeRoosters: number;
  activeBatches: number;
}

const TYPE_LABELS: Record<string, string> = { compra: "Compra", donacion: "Donación", pollito_comprado: "Pollitos comprados" };
const TYPE_COLORS: Record<string, string> = { compra: "blue", donacion: "green", pollito_comprado: "purple" };
const BIRD_LABELS: Record<string, string> = { gallina: "Gallinas", gallo: "Gallos", lote_pollos: "Lote pollos" };

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  acquisitionType: "compra",
  birdType: "gallina",
  quantity: "1",
  unitCost: "",
  supplier: "",
  breed: "",
  birthDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function AdquisicionesPage() {
  const [items, setItems] = useState<Acquisition[]>([]);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const razas = useCatalog("raza", ["Criolla", "Leghorn", "Rhode Island", "Plymouth Rock"]);
  const proveedores = useCatalog("proveedor", []);

  const load = useCallback(async () => {
    const [res, invRes] = await Promise.all([
      apiFetch("/api/produccion/adquisiciones"),
      apiFetch("/api/inventarios/animales"),
    ]);
    if (res.ok) setItems(await res.json());
    if (invRes.ok) {
      const inv = await invRes.json();
      setInventory(inv.summary);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const totalAves = items.reduce((s, i) => s + Number(i.quantity), 0);
  const totalInversion = items.filter(i => i.acquisitionType !== "donacion").reduce((s, i) => s + Number(i.totalCost || 0), 0);
  const compras = items.filter(i => i.acquisitionType !== "donacion").length;
  const donaciones = items.filter(i => i.acquisitionType === "donacion").length;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) =>
      matchesTextQuery(search, [
        item.date,
        TYPE_LABELS[item.acquisitionType] || item.acquisitionType,
        BIRD_LABELS[item.birdType] || item.birdType,
        item.quantity,
        item.breed,
        item.supplier,
        item.unitCost,
        item.totalCost,
        item.notes,
      ]),
    );
  }, [items, search]);

  const save = async () => {
    setError("");
    if (!form.date) return setError("La fecha es requerida");
    if (!form.quantity || Number(form.quantity) < 1) return setError("Cantidad mínima: 1");
    if (form.acquisitionType !== "donacion" && (!form.unitCost || Number(form.unitCost) <= 0)) return setError("El costo unitario debe ser mayor que cero para compras");

    const res = await apiFetch("/api/produccion/adquisiciones", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
    });
    if (!res.ok) { const e = await res.json(); return setError(e.error || "Error"); }
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta adquisición? Se eliminarán las aves asociadas si aún no tienen movimientos registrados.")) return;
    const res = await apiFetch(`/api/produccion/adquisiciones?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      window.alert(error.error || "No se pudo eliminar la adquisición");
      return;
    }
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adquisiciones de Aves"
        description="Registro de compra, donación y adquisición de aves"
        help="Registra todas las entradas de aves al gallinero: compras, donaciones y pollitos comprados. Cada adquisición queda en el historial con fecha, tipo, especie, cantidad, raza, proveedor y costo. Esto alimenta el inventario de aves y permite calcular la inversión total en la parvada. Los datos de proveedor y raza se autocompletan desde los catálogos."
        actions={<Button onClick={() => { setEditingId(null); setForm(emptyForm); setError(""); setModalOpen(true); }}>Nueva adquisición</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📥" label="Aves adquiridas (histórico)" value={String(totalAves)} color="green" />
        <StatCard icon="💰" label="Inversión total" value={`$${totalInversion.toLocaleString()}`} color="blue" />
        <StatCard icon="🛒" label="Compras" value={String(compras)} color="purple" />
        <StatCard icon="🎁" label="Donaciones" value={String(donaciones)} color="yellow" />
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <p className="font-semibold mb-1">📋 Este es un histórico de entradas, no el inventario actual</p>
        <p>
          Las {totalAves} aves adquiridas suman compras, donaciones y pollitos registrados desde el inicio.
          Algunas ya se vendieron, faenaron o murieron, y los pollos crecieron y pasaron a lotes.
        </p>
        <p className="mt-2">
          Inventario vigente hoy:{" "}
          <strong>{inventory ? `${inventory.totalAnimals} animales` : "—"}</strong>
          {inventory && (
            <span className="text-blue-700">
              {" "}({inventory.activeHens} gallinas
              {inventory.layingHens > 0 ? `, ${inventory.layingHens} en postura` : ""}
              {" · "}{inventory.activeRoosters} gallos
              {" · "}{inventory.activeBatches} lote{inventory.activeBatches === 1 ? "" : "s"})
            </span>
          )}
        </p>
        <Link href="/dashboard/inventarios/balance" className="inline-block mt-2 text-xs font-semibold text-blue-700 hover:underline">
          Ver balance de inventario →
        </Link>
      </div>

      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, tipo, raza o proveedor..."
          resultCount={filteredItems.length}
          totalCount={items.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon="📥"
            message={
              search.trim()
                ? "No hay adquisiciones que coincidan con la búsqueda"
                : "No hay adquisiciones registradas"
            }
          />
        ) : (
          <Table headers={["Fecha", "Tipo", "Especie", "Cantidad", "Raza", "Proveedor", "Costo unitario", "Total", "Acciones"]}>
            {filteredItems.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{a.date}</td>
                <td className="px-4 py-3"><Badge color={TYPE_COLORS[a.acquisitionType] || "gray"}>{TYPE_LABELS[a.acquisitionType] || a.acquisitionType}</Badge></td>
                <td className="px-4 py-3 text-sm">{BIRD_LABELS[a.birdType] || a.birdType}</td>
                <td className="px-4 py-3 text-sm font-medium">{a.quantity}</td>
                <td className="px-4 py-3 text-sm">{a.breed || "—"}</td>
                <td className="px-4 py-3 text-sm">{a.supplier || "—"}</td>
                <td className="px-4 py-3 text-sm">{a.unitCost ? `$${Number(a.unitCost).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-sm font-medium">{a.totalCost ? `$${Number(a.totalCost).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingId(a.id);
                      setForm({
                        date: a.date,
                        acquisitionType: a.acquisitionType,
                        birdType: a.birdType,
                        quantity: String(a.quantity),
                        unitCost: a.unitCost || "",
                        supplier: a.supplier || "",
                        breed: a.breed || "",
                        birthDate: a.birthDate || new Date().toISOString().split("T")[0],
                        notes: a.notes || "",
                      });
                      setError("");
                      setModalOpen(true);
                    }} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(a.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? "✏️ Editar Adquisición" : "Nueva Adquisición"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" value={form.acquisitionType} onChange={(e) => setForm({ ...form, acquisitionType: e.target.value })} help="Cómo llegaron las aves: compra, donación o pollitos comprados">
              <option value="compra">Compra</option>
              <option value="donacion">Donación</option>
              <option value="pollito_comprado">Pollitos comprados</option>
            </Select>
            <Select label="Especie" value={form.birdType} onChange={(e) => setForm({ ...form, birdType: e.target.value })} disabled={!!editingId} help="Tipo de ave: gallinas, gallos o lote de pollos">
              <option value="gallina">Gallinas</option>
              <option value="gallo">Gallos</option>
              <option value="lote_pollos">Lote de pollos</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} help="Fecha de la adquisición" />
            <Input label="Fecha nacimiento aprox." type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} help="Fecha estimada de nacimiento (útil para calcular edad y etapa productiva)" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Cantidad" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} disabled={!!editingId} help="Número de aves adquiridas" />
            <Input label="Raza" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} list="razas-list" help="Raza de las aves (se autocompleta del catálogo)" />
            <datalist id="razas-list">{razas.values.map((v) => <option key={v} value={v} />)}</datalist>
          </div>

          {form.acquisitionType !== "donacion" && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Costo unitario" type="number" min="0" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} help="Precio pagado por cada ave" />
              <Input label="Total" value={form.unitCost && form.quantity ? `$${(Number(form.unitCost) * Number(form.quantity)).toLocaleString()}` : "—"} disabled help="Costo total calculado automáticamente (cantidad × costo unitario)" />
            </div>
          )}

          <Input label="Proveedor" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} list="proveedores-list" help="Proveedor o vendedor de las aves (se autocompleta del catálogo)" />
          <datalist id="proveedores-list">{proveedores.values.map((v) => <option key={v} value={v} />)}</datalist>

          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} help="Observaciones sobre la adquisición (condiciones de llegada, transporte, etc.)" />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!form.date || !form.quantity || Number(form.quantity) < 1 || (form.acquisitionType !== "donacion" && (!form.unitCost || Number(form.unitCost) <= 0))}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

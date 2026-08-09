"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import { Card, StatCard, PageHeader, Button, Input, Select, Textarea, Modal, Table, Badge, EmptyState } from "@/components/ui";

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
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const razas = useCatalog("raza", ["Criolla", "Leghorn", "Rhode Island", "Plymouth Rock"]);
  const proveedores = useCatalog("proveedor", []);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/produccion/adquisiciones");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalAves = items.reduce((s, i) => s + Number(i.quantity), 0);
  const totalInversion = items.filter(i => i.acquisitionType === "compra").reduce((s, i) => s + Number(i.totalCost || 0), 0);
  const compras = items.filter(i => i.acquisitionType === "compra").length;
  const donaciones = items.filter(i => i.acquisitionType === "donacion").length;

  const save = async () => {
    setError("");
    if (!form.date) return setError("La fecha es requerida");
    if (!form.quantity || Number(form.quantity) < 1) return setError("Cantidad mínima: 1");
    if (!editingId && form.acquisitionType === "compra" && !form.unitCost) return setError("El costo unitario es requerido para compras");

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
    if (!confirm("¿Eliminar esta adquisición? Se eliminarán las aves asociadas.")) return;
    await apiFetch(`/api/produccion/adquisiciones?id=${id}`, { method: "DELETE" });
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
        <StatCard icon="🐔" label="Total aves adquiridas" value={String(totalAves)} color="green" />
        <StatCard icon="💰" label="Inversión total" value={`$${totalInversion.toLocaleString()}`} color="blue" />
        <StatCard icon="🛒" label="Compras" value={String(compras)} color="purple" />
        <StatCard icon="🎁" label="Donaciones" value={String(donaciones)} color="yellow" />
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : items.length === 0 ? (
          <EmptyState icon="📥" message="No hay adquisiciones registradas" />
        ) : (
          <Table headers={["Fecha", "Tipo", "Especie", "Cantidad", "Raza", "Proveedor", "Costo unitario", "Total", "Acciones"]}>
            {items.map((a) => (
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
            <Button onClick={save} disabled={!form.date || !form.quantity || Number(form.quantity) < 1 || (form.acquisitionType === "compra" && !form.unitCost)}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

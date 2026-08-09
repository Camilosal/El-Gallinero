"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Table, Modal, Input, Textarea, Button, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

interface KgSale {
  id: string;
  date: string;
  quantityKg: string;
  pricePerKg: string;
  totalAmount: string;
  presentation: string | null;
  buyer: string | null;
  notes: string | null;
}

interface KgSaleTabProps {
  apiEndpoint: string;
  labels: {
    emptyIcon: string;
    emptyMessage: string;
    revenueLabel: string;
    kgLabel: string;
    newButton: string;
    modalTitleNew: string;
    modalTitleEdit: string;
    quantityLabel: string;
    priceLabel: string;
    tableHeaders: string[];
  };
}

export default function KgSaleTab({ apiEndpoint, labels }: KgSaleTabProps) {
  const [sales, setSales] = useState<KgSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KgSale | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    quantityKg: "",
    pricePerKg: "",
    presentation: "",
    buyer: "",
    notes: "",
  });

  const { values: buyerOptions } = useCatalog("comprador");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(apiEndpoint)
      .then((r) => r.json())
      .then((data) => {
        setSales(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiEndpoint]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = sales.reduce((s, r) => s + Number(r.totalAmount), 0);
  const totalKg = sales.reduce((s, r) => s + Number(r.quantityKg), 0);
  const avgPrice = totalKg > 0 ? (totalRevenue / totalKg).toFixed(0) : "0";

  const openNew = () => {
    setEditing(null);
    setError("");
    setForm({
      date: new Date().toISOString().split("T")[0],
      quantityKg: "",
      pricePerKg: "",
      presentation: "",
      buyer: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (s: KgSale) => {
    setEditing(s);
    setError("");
    setForm({
      date: s.date,
      quantityKg: s.quantityKg,
      pricePerKg: s.pricePerKg,
      presentation: s.presentation || "",
      buyer: s.buyer || "",
      notes: s.notes || "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    const qty = Number(form.quantityKg);
    const price = Number(form.pricePerKg);
    if (!form.date) { setError("Fecha requerida"); return; }
    if (isNaN(qty) || qty <= 0) { setError("Cantidad kg inválida"); return; }
    if (isNaN(price) || price < 0) { setError("Precio/kg inválido"); return; }

    const payload = {
      date: form.date,
      quantityKg: qty,
      pricePerKg: price,
      presentation: form.presentation || null,
      buyer: form.buyer || null,
      notes: form.notes || null,
      ...(editing ? { id: editing.id } : {}),
    };

    const method = editing ? "PUT" : "POST";
    const res = await apiFetch(apiEndpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar");
      return;
    }

    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta venta?")) return;
    await apiFetch(`${apiEndpoint}?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="💵" label={labels.revenueLabel} value={`$${totalRevenue.toLocaleString()}`} color="green" />
        <StatCard icon="⚖️" label={labels.kgLabel} value={`${totalKg.toFixed(1)} kg`} color="yellow" />
        <StatCard icon="📊" label="Precio Prom./kg" value={`$${avgPrice}`} color="blue" />
        <StatCard icon="🛒" label="Total Ventas" value={sales.length} color="purple" />
      </div>

      <div className="mb-4">
        <Button onClick={openNew}>{labels.newButton}</Button>
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : sales.length === 0 ? (
          <EmptyState icon={labels.emptyIcon} message={labels.emptyMessage} />
        ) : (
          <Table headers={labels.tableHeaders}>
            {sales.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(s.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3 font-semibold">{Number(s.quantityKg).toFixed(1)} kg</td>
                <td className="px-4 py-3">${Number(s.pricePerKg).toLocaleString()}/kg</td>
                <td className="px-4 py-3 font-bold text-green-600">${Number(s.totalAmount).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">{s.buyer || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? labels.modalTitleEdit : labels.modalTitleNew}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Comprador" value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} placeholder="Nombre del cliente" list="catalog-compradores-kg" />
          </div>
          <datalist id="catalog-compradores-kg">
            {buyerOptions.map((b) => <option key={b} value={b} />)}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Input label={labels.quantityLabel} type="number" step="0.1" min="0" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
            <Input label={labels.priceLabel} type="number" step="1" min="0" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })} />
          </div>
          <Input label="Presentación" value={form.presentation} onChange={(e) => setForm({ ...form, presentation: e.target.value })} placeholder="Ej: bolsa 5kg, bulto, a granel" />
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {Number(form.quantityKg) > 0 && Number(form.pricePerKg) >= 0 && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
              <p>⚖️ Cantidad: <strong>{Number(form.quantityKg).toFixed(1)} kg</strong></p>
              <p className="mt-1">💵 Total: <strong className="text-xl">${(Number(form.quantityKg) * Number(form.pricePerKg)).toLocaleString()}</strong></p>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={save}>{editing ? "Actualizar Venta" : "Registrar Venta"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

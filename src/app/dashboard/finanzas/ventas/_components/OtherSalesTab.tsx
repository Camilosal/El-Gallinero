"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banknote, Package } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, StatCard, Table, Textarea } from "@/components/ui";
import ContactField from "@/components/contacts/ContactField";
import MicroInsightCard from "@/components/MicroInsightCard";
import TableSearch from "@/components/TableSearch";
import { computeCreditDueDate, type ContactRecord } from "@/lib/contacts-shared";
import { apiFetch } from "@/lib/fetch";
import { buildSaleMicroInsight, type MicroInsightPayload } from "@/lib/micro-insights";
import { matchesTextQuery } from "@/lib/text";
import { SPECIES_LABEL } from "@/lib/species-params";
import { useActionQuery } from "@/lib/useActionQuery";
import { useCatalog } from "@/lib/useCatalog";

interface OtherSaleTx {
  id: string;
  date: string;
  type: string;
  category: string;
  description: string;
  amount: string;
  quantity: string | null;
  unitPrice: string | null;
  unit: string | null;
  presentation: string | null;
  counterparty: string | null;
  species: string | null;
  locationId: string | null;
  sourceType: string | null;
  isCredit: boolean;
  dueDate: string | null;
  notes: string | null;
}

const EXCLUDED_DEDICATED_SOURCES = new Set(["venta", "venta_ave", "venta_carne", "gallinaza"]);

const DEFAULT_INCOME_CATEGORIES = [
  "Venta de subproductos",
  "Venta de carne",
  "Venta de animales",
  "Otros ingresos",
];

interface OtherSalesTabProps {
  onSaved?: () => void;
}

export default function OtherSalesTab({ onSaved }: OtherSalesTabProps) {
  const searchParams = useSearchParams();
  const { values: rawCategories } = useCatalog("categoria_ingreso", DEFAULT_INCOME_CATEGORIES);
  const categories = rawCategories.length > 0 ? rawCategories : DEFAULT_INCOME_CATEGORIES;

  const [sales, setSales] = useState<OtherSaleTx[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OtherSaleTx | null>(null);
  const [lastInsight, setLastInsight] = useState<MicroInsightPayload | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [buyerCreditDays, setBuyerCreditDays] = useState(0);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Venta de subproductos",
    description: "",
    quantity: "1",
    unit: "unidad",
    unitPrice: "",
    presentation: "",
    counterparty: "",
    species: "",
    locationId: "",
    notes: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/finanzas/finanzas?period=3650").then((r) => r.json()),
      apiFetch("/api/ubicaciones").then((r) => r.json()),
    ])
      .then(([finData, locs]) => {
        const txList: OtherSaleTx[] = Array.isArray(finData?.transactions) ? finData.transactions : [];
        setSales(
          txList.filter(
            (tx) => tx.type === "ingreso" && !EXCLUDED_DEDICATED_SOURCES.has(tx.sourceType || ""),
          ),
        );
        setLocations(Array.isArray(locs) ? locs : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const filteredSales = useMemo(() => {
    if (!search.trim()) return sales;
    return sales.filter((s) =>
      matchesTextQuery(search, [
        s.date,
        new Date(s.date + "T12:00:00").toLocaleDateString("es"),
        s.category,
        s.description,
        s.counterparty,
        s.presentation,
        s.species ? SPECIES_LABEL[s.species] || s.species : "",
        s.amount,
        s.notes,
        s.isCredit ? "credito" : "",
      ]),
    );
  }, [sales, search]);

  const totalRevenue = filteredSales.reduce((s, r) => s + Number(r.amount), 0);
  const avgSale = filteredSales.length > 0 ? Math.round(totalRevenue / filteredSales.length) : 0;
  const creditCount = filteredSales.filter((s) => s.isCredit).length;

  const openNew = () => {
    setEditing(null);
    setError("");
    setIsCredit(false);
    setDueDate("");
    setBuyerCreditDays(0);
    setForm({
      date: new Date().toISOString().split("T")[0],
      category: categories.includes("Venta de subproductos") ? "Venta de subproductos" : categories[0] || "Otros ingresos",
      description: "",
      quantity: "1",
      unit: "unidad",
      unitPrice: "",
      presentation: "",
      counterparty: "",
      species: "",
      locationId: "",
      notes: "",
    });
    setModalOpen(true);
  };

  useActionQuery(searchParams.get("nuevo"), { "1": openNew });

  const openEdit = (tx: OtherSaleTx) => {
    setEditing(tx);
    setError("");
    setIsCredit(Boolean(tx.isCredit));
    setDueDate(tx.dueDate || "");
    setBuyerCreditDays(0);
    setForm({
      date: tx.date,
      category: tx.category || "Venta de subproductos",
      description: tx.description,
      quantity: tx.quantity || "1",
      unit: tx.unit || "unidad",
      unitPrice: tx.unitPrice || tx.amount,
      presentation: tx.presentation || "",
      counterparty: tx.counterparty || "",
      species: tx.species || "",
      locationId: tx.locationId || "",
      notes: tx.notes || "",
    });
    setModalOpen(true);
  };

  const handleBuyerChange = (name: string, contact?: ContactRecord | null) => {
    setForm((prev) => ({ ...prev, counterparty: name }));
    const days = contact?.creditDays || 0;
    setBuyerCreditDays(days);
    if (days > 0 && isCredit && !dueDate) {
      setDueDate(computeCreditDueDate(form.date, days));
    }
  };

  const computedTotal = useMemo(() => {
    const qty = Number(form.quantity);
    const price = Number(form.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
    return Math.round(qty * price * 100) / 100;
  }, [form.quantity, form.unitPrice]);

  const save = async () => {
    setError("");
    const qty = Number(form.quantity);
    const price = Number(form.unitPrice);
    if (!form.date) return setError("Fecha requerida");
    if (!form.description.trim()) return setError("Describe el producto o concepto vendido");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Cantidad inválida");
    if (!Number.isFinite(price) || price <= 0) return setError("Precio unitario inválido");
    if (isCredit && !dueDate) return setError("Indica la fecha de vencimiento para ventas a crédito");

    const totalAmount = Math.round(qty * price * 100) / 100;
    const payload = {
      date: form.date,
      type: "ingreso",
      category: form.category || "Venta de subproductos",
      description: form.description.trim(),
      quantity: qty,
      unit: form.unit.trim() || "unidad",
      unitPrice: price,
      amount: totalAmount,
      presentation: form.presentation.trim() || null,
      counterparty: form.counterparty.trim() || null,
      species: form.species || null,
      locationId: form.locationId || null,
      isCredit,
      dueDate: isCredit ? dueDate : null,
      notes: form.notes.trim() || null,
      ...(editing ? { id: editing.id } : {}),
    };

    const res = await apiFetch("/api/finanzas/finanzas", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error || "No se pudo guardar la venta");
    }

    const unitLabel = form.unit.trim() || "u.";
    setLastInsight(
      buildSaleMicroInsight({
        date: form.date,
        itemSummary: `${qty} ${unitLabel} · ${form.description.trim()}`,
        totalUnits: qty,
        unitPrice: price,
        totalAmount,
        buyer: form.counterparty.trim() || null,
        species: form.species || undefined,
        saleKind: "otros",
        unitLabel,
      }),
    );

    setModalOpen(false);
    load();
    onSaved?.();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro de venta?")) return;
    await apiFetch(`/api/finanzas/finanzas?id=${id}`, { method: "DELETE" });
    load();
    onSaved?.();
  };

  return (
    <>
      {lastInsight && (
        <div className="mb-6">
          <MicroInsightCard insight={lastInsight} onDismiss={() => setLastInsight(null)} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
        <StatCard icon="banknote" label="Ingresos Otros Productos" value={`$${totalRevenue.toLocaleString()}`} color="green" />
        <StatCard icon="cart" label="Ventas Registradas" value={filteredSales.length} color="purple" />
        <StatCard icon="chart" label="Ticket Promedio" value={`$${avgSale.toLocaleString()}`} color="blue" />
        <StatCard icon="card" label="Ventas a Crédito" value={creditCount} color="yellow" />
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={openNew}>+ Nueva Venta / Subproducto</Button>
      </div>

      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, producto, categoría o cliente..."
          resultCount={filteredSales.length}
          totalCount={sales.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon="tag"
            message={search.trim() ? "No hay ventas que coincidan con la búsqueda" : "No hay ventas de subproductos u otros conceptos registradas"}
          />
        ) : (
          <Table headers={["Fecha", "Categoría", "Producto / Detalle", "Cantidad", "Total", "Comprador", ""]}>
            {filteredSales.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{new Date(s.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{s.category}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                  <div>{s.description}</div>
                  {s.presentation && <div className="text-xs font-normal text-slate-500">{s.presentation}</div>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {s.quantity ? `${Number(s.quantity)} ${s.unit || "u."}` : "—"}
                </td>
                <td className="px-4 py-3 font-bold text-green-600">
                  <div className="flex items-center gap-1.5">
                    <span>${Number(s.amount).toLocaleString()}</span>
                    {s.isCredit && <Badge color="orange">Crédito</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{s.counterparty || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Venta / Ingreso" : "Nueva Venta de Producto o Subproducto"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Fecha *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="Categoría *" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Producto / Concepto vendido *"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej: Humus sólido, plumas seleccionadas, reproductor descarte..."
          />

          <div className="grid grid-cols-3 gap-3">
            <Input label="Cantidad *" type="number" step="0.1" min="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <Input label="Unidad *" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unidad, kg, litro..." />
            <Input label="Precio/u ($) *" type="number" step="100" min="1" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Especie (opcional)" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
              <option value="">— General —</option>
              <option value="gallina">Gallina</option>
              <option value="pollo">Pollo</option>
              <option value="codorniz">Codorniz</option>
              <option value="pato">Pato</option>
              <option value="conejo">Conejo</option>
              <option value="cuy">Cuy</option>
            </Select>
            <Select label="Lugar (opcional)" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">— General —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ContactField
              role="cliente"
              label="Comprador"
              value={form.counterparty}
              onChange={handleBuyerChange}
              placeholder="Nombre del cliente o comercio"
            />
            <Input label="Presentación" value={form.presentation} onChange={(e) => setForm({ ...form, presentation: e.target.value })} placeholder="Bulto, caja, frasco..." />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isCredit}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsCredit(checked);
                  if (checked && !dueDate) {
                    setDueDate(computeCreditDueDate(form.date, buyerCreditDays || 15));
                  }
                }}
                className="rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              <span>Venta a crédito (generar cuenta por cobrar)</span>
            </label>
            {isCredit && (
              <Input
                label="Fecha de vencimiento *"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            )}
          </div>

          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          {computedTotal > 0 && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
              <p className="flex items-center gap-1.5"><Package className="w-4 h-4" aria-hidden="true" /> {form.quantity} {form.unit || "u."}</p>
              <p className="mt-1 flex items-center gap-1.5"><Banknote className="w-4 h-4" aria-hidden="true" /> Total venta: <strong className="text-xl">${computedTotal.toLocaleString()} COP</strong></p>
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


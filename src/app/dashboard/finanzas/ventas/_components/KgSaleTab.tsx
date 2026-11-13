"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Banknote, Scale } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { Card, Table, Modal, Input, Textarea, Button, EmptyState, StatCard, Select, Badge } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import ContactField from "@/components/contacts/ContactField";
import MicroInsightCard from "@/components/MicroInsightCard";
import TableSearch from "@/components/TableSearch";
import { computeCreditDueDate, type ContactRecord } from "@/lib/contacts-shared";
import { buildSaleMicroInsight, type MicroInsightPayload } from "@/lib/micro-insights";
import { matchesTextQuery } from "@/lib/text";
import { SPECIES_ICON, SPECIES_LABEL } from "@/lib/species-params";
import { useSpeciesCatalog } from "@/lib/use-species-params";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";

interface KgSale {
  id: string;
  date: string;
  species?: string;
  locationId?: string | null;
  quantityKg: string;
  pricePerKg: string;
  totalAmount: string;
  presentation: string | null;
  buyer: string | null;
  notes: string | null;
  isCredit?: boolean;
  dueDate?: string | null;
}

interface KgSaleTabProps {
  apiEndpoint: string;
  onSaved?: () => void;
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

export default function KgSaleTab({ apiEndpoint, onSaved, labels }: KgSaleTabProps) {
  const searchParams = useSearchParams();
  const { priceKg } = useSpeciesCatalog();
  const isMeat = apiEndpoint.includes("/carne");
  const [sales, setSales] = useState<KgSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KgSale | null>(null);
  const [lastInsight, setLastInsight] = useState<MicroInsightPayload | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>("all");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [isCredit, setIsCredit] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [buyerCreditDays, setBuyerCreditDays] = useState(0);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    species: "pollo",
    locationId: "",
    quantityKg: "",
    pricePerKg: "14000",
    presentation: "",
    buyer: "",
    notes: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch(apiEndpoint).then((r) => r.json()),
      apiFetch("/api/ubicaciones").then((r) => r.json()),
    ])
      .then(([data, locs]) => {
        setSales(Array.isArray(data) ? data : []);
        setLocations(Array.isArray(locs) ? locs : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiEndpoint]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const handleSpeciesChange = (species: string) => {
    const defaultPrice = priceKg(species);
    setForm((prev) => ({
      ...prev,
      species,
      pricePerKg: String(defaultPrice),
    }));
  };

  const handleBuyerChange = (name: string, contact?: ContactRecord | null) => {
    setForm((prev) => ({ ...prev, buyer: name }));
    const days = contact?.creditDays || 0;
    setBuyerCreditDays(days);
    if (days > 0 && isCredit && !dueDate) {
      setDueDate(computeCreditDueDate(form.date, days));
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const sp = sale.species || "pollo";
      if (isMeat && selectedSpeciesFilter !== "all" && sp !== selectedSpeciesFilter) {
        return false;
      }
      if (!search.trim()) return true;
      return matchesTextQuery(search, [
        sale.date,
        new Date(sale.date + "T12:00:00").toLocaleDateString("es"),
        sp,
        SPECIES_LABEL[sp],
        sale.quantityKg,
        sale.pricePerKg,
        sale.totalAmount,
        sale.presentation,
        sale.buyer,
        sale.notes,
      ]);
    });
  }, [sales, search, selectedSpeciesFilter, isMeat]);

  const totalRevenue = filteredSales.reduce((s, r) => s + Number(r.totalAmount), 0);
  const totalKg = filteredSales.reduce((s, r) => s + Number(r.quantityKg), 0);
  const avgPrice = totalKg > 0 ? (totalRevenue / totalKg).toFixed(0) : "0";

  const openNew = () => {
    setEditing(null);
    setError("");
    setIsCredit(false);
    setDueDate("");
    setBuyerCreditDays(0);
    setForm({
      date: new Date().toISOString().split("T")[0],
      species: isMeat ? "pollo" : "",
      locationId: "",
      quantityKg: "",
      pricePerKg: isMeat ? String(priceKg("pollo")) : "",
      presentation: "",
      buyer: "",
      notes: "",
    });
    setModalOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": openNew });

  const openEdit = (s: KgSale) => {
    setEditing(s);
    setError("");
    setIsCredit(Boolean(s.isCredit));
    setDueDate(s.dueDate || "");
    setBuyerCreditDays(0);
    setForm({
      date: s.date,
      species: s.species || (isMeat ? "pollo" : ""),
      locationId: s.locationId || "",
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
    if (isCredit && !dueDate) { setError("Indica la fecha de vencimiento para ventas a crédito"); return; }

    const payload = {
      date: form.date,
      species: form.species || (isMeat ? "pollo" : null),
      locationId: form.locationId || null,
      quantityKg: qty,
      pricePerKg: price,
      presentation: form.presentation || null,
      buyer: form.buyer || null,
      isCredit,
      dueDate: dueDate || null,
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

    const totalAmt = Math.round(qty * price * 100) / 100;
    const spLabel = form.species ? (SPECIES_LABEL[form.species] || form.species) : "";
    setLastInsight(
      buildSaleMicroInsight({
        date: form.date,
        itemSummary: isMeat ? `${qty} kg carne${spLabel ? ` (${spLabel})` : ""}` : `${qty} kg de gallinaza / abono`,
        totalUnits: qty,
        unitPrice: price,
        totalAmount: totalAmt,
        buyer: form.buyer || null,
        species: form.species || undefined,
        saleKind: isMeat ? "carne" : "gallinaza",
        unitLabel: "kg",
      }),
    );

    setModalOpen(false);
    load();
    onSaved?.();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta venta?")) return;
    await apiFetch(`${apiEndpoint}?id=${id}`, { method: "DELETE" });
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
        <StatCard icon="banknote" label={labels.revenueLabel} value={`$${totalRevenue.toLocaleString()}`} color="green" />
        <StatCard icon="scale" label={labels.kgLabel} value={`${totalKg.toFixed(1)} kg`} color="yellow" />
        <StatCard icon="chart" label="Precio Prom./kg" value={`$${avgPrice}`} color="blue" />
        <StatCard icon="cart" label="Ventas Registradas" value={filteredSales.length} color="purple" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {isMeat ? (
          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "Todas", icon: "globe" },
              { id: "pollo", label: "Pollo", icon: "rooster" },
              { id: "gallina", label: "Gallina", icon: "hen" },
              { id: "codorniz", label: "Codorniz", icon: "egg" },
              { id: "pato", label: "Pato", icon: "duck" },
              { id: "conejo", label: "Conejo", icon: "rabbit" },
              { id: "cuy", label: "Cuy", icon: "paw-print" },
            ].map((sp) => {
              const isSelected = selectedSpeciesFilter === sp.id;
              const count = sp.id === "all"
                ? sales.length
                : sales.filter((s) => (s.species || "pollo") === sp.id).length;
              return (
                <button
                  key={sp.id}
                  onClick={() => setSelectedSpeciesFilter(sp.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <AppIcon icon={sp.icon} className="w-3.5 h-3.5" /> {sp.label} ({count})
                </button>
              );
            })}
          </div>
        ) : <div />}

        <Button onClick={openNew}>{labels.newButton}</Button>
      </div>

      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, comprador o presentación..."
          resultCount={filteredSales.length}
          totalCount={sales.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={labels.emptyIcon}
            message={
              search.trim() || (isMeat && selectedSpeciesFilter !== "all")
                ? "No hay ventas que coincidan con los filtros"
                : labels.emptyMessage
            }
          />
        ) : (
          <Table headers={isMeat ? ["Fecha", "Especie", "Cantidad", "Precio/kg", "Total", "Comprador", ""] : labels.tableHeaders}>
            {filteredSales.map((s) => {
              const sp = s.species || "pollo";
              const icon = SPECIES_ICON[sp] || "meat";
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{new Date(s.date + "T12:00:00").toLocaleDateString("es")}</td>
                  {isMeat && (
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <AppIcon icon={icon} className="w-4 h-4 text-slate-600" />
                        {SPECIES_LABEL[sp] || sp}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 font-semibold">{Number(s.quantityKg).toFixed(1)} kg</td>
                  <td className="px-4 py-3">${Number(s.pricePerKg).toLocaleString()}/kg</td>
                  <td className="px-4 py-3 font-bold text-green-600">
                    <div className="flex items-center gap-1.5">
                      <span>${Number(s.totalAmount).toLocaleString()}</span>
                      {s.isCredit && <Badge color="orange">Crédito</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{s.buyer || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => remove(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? labels.modalTitleEdit : labels.modalTitleNew}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            {isMeat ? (
              <Select
                label="Especie de Carne *"
                value={form.species}
                onChange={(e) => handleSpeciesChange(e.target.value)}
              >
                <option value="pollo">Pollo de engorde</option>
                <option value="gallina">Gallina</option>
                <option value="codorniz">Codorniz</option>
                <option value="pato">Pato</option>
                <option value="conejo">Conejo de engorde</option>
                <option value="cuy">Cuy</option>
              </Select>
            ) : (
              <ContactField
                role="cliente"
                label="Comprador"
                value={form.buyer}
                onChange={handleBuyerChange}
              />
            )}
          </div>

          {isMeat && (
            <ContactField
              role="cliente"
              label="Comprador"
              value={form.buyer}
              onChange={handleBuyerChange}
              placeholder="Nombre del cliente / restaurante / particular"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label={labels.quantityLabel} type="number" step="0.1" min="0" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
            <Input label={labels.priceLabel} type="number" step="1" min="0" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Lugar / Galpón (opcional)" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">— General —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
            {!isMeat && (
              <Select label="Especie origen (opcional)" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
                <option value="">— General —</option>
                <option value="gallina">Gallina</option>
                <option value="pollo">Pollo</option>
                <option value="codorniz">Codorniz</option>
                <option value="pato">Pato</option>
                <option value="conejo">Conejo</option>
                <option value="cuy">Cuy</option>
              </Select>
            )}
          </div>
          <Input label="Presentación" value={form.presentation} onChange={(e) => setForm({ ...form, presentation: e.target.value })} placeholder="Ej: canal limpia entera, por presas, congelado" />
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

          {Number(form.quantityKg) > 0 && Number(form.pricePerKg) >= 0 && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
              <p className="flex items-center gap-1.5"><Scale className="w-4 h-4" aria-hidden="true" /> Cantidad: <strong>{Number(form.quantityKg).toFixed(1)} kg</strong></p>
              <p className="mt-1 flex items-center gap-1.5"><Banknote className="w-4 h-4" aria-hidden="true" /> Total a Cobrar: <strong className="text-xl">${(Number(form.quantityKg) * Number(form.pricePerKg)).toLocaleString()} COP</strong></p>
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

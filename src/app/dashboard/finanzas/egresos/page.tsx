"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowUp, BarChart3, Calculator, Package, Pencil } from "lucide-react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog, CatalogItem } from "@/lib/useCatalog";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";

interface Transaction {
  id: string;
  date: string;
  type: string;
  category: string;
  description: string;
  amount: string;
  counterparty: string | null;
  quantity: string | null;
  unitPrice: string | null;
  unit: string | null;
  presentation: string | null;
  notes: string | null;
  feedId?: string | null;
}

interface FeedItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  currentStock: string;
  costPerUnit: string;
  supplier: string | null;
}

interface PurchaseProduct {
  id: string;
  name: string;
  expenseCategory: string;
  defaultPresentation: string | null;
  defaultUnit: string;
  lastPricePerPresentation: string | null;
  defaultSupplier: string | null;
  notes: string | null;
}

const expenseCategories = [
  "Compra de alimento",
  "Compra de insumos",
  "Control sanitario",
  "Mantenimiento",
  "Mano de obra",
  "Servicios (agua/luz)",
  "Compra de gallinas",
  "Equipamiento",
  "Transporte",
  "Otro egreso",
];

const purchaseCategories = [
  "Compra de alimento",
  "Compra de insumos",
  "Control sanitario",
  "Equipamiento",
  "Compra de gallinas",
];

// Presentations grouped by compatible unit type
const presentationsByUnit: Record<string, { label: string; factor: number }[]> = {
  kg: [
    { label: "Kg", factor: 1 },
    { label: "Bulto 25kg", factor: 25 },
    { label: "Bulto 50kg", factor: 50 },
    { label: "Arpilla 5kg", factor: 5 },
  ],
  litros: [
    { label: "Litro", factor: 1 },
    { label: "Galón", factor: 4 },
  ],
  unidades: [
    { label: "Unidad", factor: 1 },
  ],
  lb: [
    { label: "Libra", factor: 1 },
    { label: "Bulto 25lb", factor: 25 },
    { label: "Bulto 50lb", factor: 50 },
  ],
};

function getPresentationsForUnit(unit: string) {
  return presentationsByUnit[unit] || presentationsByUnit["unidades"];
}

interface EgresoForm {
  date: string;
  category: string;
  description: string;
  counterparty: string;
  // Legacy fields (non-purchase)
  quantity: string;
  unitPrice: string;
  unit: string;
  amount: string;
  notes: string;
  // Presentation fields (purchase)
  feedId: string;
  presentation: string;
  presentations: string;
  pricePerPresentation: string;
  factor: string;
}

const defaultForm = (): EgresoForm => ({
  date: new Date().toISOString().split("T")[0],
  category: expenseCategories[0],
  description: "",
  counterparty: "",
  quantity: "",
  unitPrice: "",
  unit: "unidades",
  amount: "",
  notes: "",
  feedId: "",
  presentation: "",
  presentations: "",
  pricePerPresentation: "",
  factor: "",
});

export default function EgresosPage() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<EgresoForm>(defaultForm());
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", defaultPresentation: "Unidad", defaultUnit: "unidades", lastPricePerPresentation: "", defaultSupplier: "", notes: "" });
  const [productEditingId, setProductEditingId] = useState<string | null>(null);
  const [productError, setProductError] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [supplierError, setSupplierError] = useState("");
  const { values: expenseCats } = useCatalog("categoria_egreso", expenseCategories);
  const { values: supplierOptions, reload: reloadSuppliers } = useCatalog("proveedor");

  const isPurchase = purchaseCategories.includes(form.category);
  const isFeedPurchase = form.category === "Compra de alimento";
  const isNonFeedPurchase = isPurchase && !isFeedPurchase;

  // Load purchase products for non-feed purchase categories
  useEffect(() => {
    if (isNonFeedPurchase && modalOpen) {
      apiFetch(`/api/purchase-products?category=${encodeURIComponent(form.category)}`)
        .then((r) => r.json())
        .then((data) => setProducts(Array.isArray(data) ? data : []))
        .catch(() => setProducts([]));
    }
  }, [isNonFeedPurchase, form.category, modalOpen]);

  // Load feeds for "Compra de alimento"
  useEffect(() => {
    if (isFeedPurchase && modalOpen) {
      apiFetch("/api/produccion/alimentacion").then((r) => r.json()).then((data) => {
        const list = Array.isArray(data) ? data : [];
        setFeeds(list);
        // Si hay un feed ya seleccionado (ej: al editar), sincronizar la presentación
        // con las opciones de su unidad una vez que los feeds están cargados.
        setForm((f) => {
          if (!f.feedId) return f;
          const feed = list.find((x) => x.id === f.feedId);
          const presOptions = feed ? getPresentationsForUnit(feed.unit) : getPresentationsForUnit("unidades");
          const currentValid = presOptions.some((p) => p.label === f.presentation);
          if (currentValid && f.presentation) return f;
          const first = presOptions[0];
          return { ...f, presentation: first?.label || "", factor: first ? String(first.factor) : "" };
        });
      }).catch(() => setFeeds([]));
    }
  }, [isFeedPurchase, modalOpen]);

  // Selected feed info
  const selectedFeed = useMemo(() => feeds.find((f) => f.id === form.feedId), [feeds, form.feedId]);

  // Available presentations based on selected feed unit (or category default)
  const availablePresentations = useMemo(() => {
    if (isFeedPurchase && selectedFeed) {
      return getPresentationsForUnit(selectedFeed.unit);
    }
    // For non-feed purchase categories, default to "unidades"
    if (isPurchase) {
      return getPresentationsForUnit("unidades");
    }
    return [];
  }, [isFeedPurchase, selectedFeed, isPurchase]);

  // When presentation changes, update factor
  const onPresentationChange = (value: string) => {
    const pres = availablePresentations.find((p) => p.label === value);
    setForm((f) => ({ ...f, presentation: value, factor: pres ? String(pres.factor) : "" }));
  };

  // When feed changes in "Compra de alimento", reset presentation
  const onFeedChange = (feedId: string) => {
    const feed = feeds.find((f) => f.id === feedId);
    const presOptions = feed ? getPresentationsForUnit(feed.unit) : getPresentationsForUnit("unidades");
    const first = presOptions[0];
    setForm((f) => ({
      ...f,
      feedId,
      presentation: first?.label || "",
      factor: first ? String(first.factor) : "",
    }));
  };

  // When a purchase product is selected, auto-fill form fields
  const onProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    if (!productId) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setForm((f) => ({
      ...f,
      description: f.description || product.name,
      presentation: product.defaultPresentation || "Unidad",
      pricePerPresentation: product.lastPricePerPresentation || "",
      counterparty: f.counterparty || product.defaultSupplier || "",
    }));
    // Update factor based on presentation
    const pres = getPresentationsForUnit(product.defaultUnit).find((p) => p.label === (product.defaultPresentation || "Unidad"));
    if (pres) {
      setForm((f) => ({ ...f, factor: String(pres.factor) }));
    }
  };

  // Open product modal for creating a new product
  const openProductNew = () => {
    setProductEditingId(null);
    setProductError("");
    setProductForm({
      name: "",
      defaultPresentation: "Unidad",
      defaultUnit: "unidades",
      lastPricePerPresentation: "",
      defaultSupplier: form.counterparty || "",
      notes: "",
    });
    setProductModalOpen(true);
  };

  // Open product modal for editing the selected product
  const openProductEdit = () => {
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    setProductEditingId(product.id);
    setProductError("");
    setProductForm({
      name: product.name,
      defaultPresentation: product.defaultPresentation || "Unidad",
      defaultUnit: product.defaultUnit,
      lastPricePerPresentation: product.lastPricePerPresentation || "",
      defaultSupplier: product.defaultSupplier || "",
      notes: product.notes || "",
    });
    setProductModalOpen(true);
  };

  // Save product (create or update)
  const saveProduct = async () => {
    setProductError("");
    if (!productForm.name) return setProductError("Nombre es requerido");
    const body = {
      ...(productEditingId ? { id: productEditingId } : {}),
      name: productForm.name,
      expenseCategory: form.category,
      defaultPresentation: productForm.defaultPresentation || null,
      defaultUnit: productForm.defaultUnit,
      lastPricePerPresentation: productForm.lastPricePerPresentation || null,
      defaultSupplier: productForm.defaultSupplier || null,
      notes: productForm.notes || null,
    };
    const res = await apiFetch("/api/purchase-products", {
      method: productEditingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setProductError(d.error || "Error al guardar");
    }
    setProductModalOpen(false);
    // Reload products and select the new/edited one
    const updated = await apiFetch(`/api/purchase-products?category=${encodeURIComponent(form.category)}`).then((r) => r.json());
    if (Array.isArray(updated)) {
      setProducts(updated);
      if (!productEditingId) {
        // Select the newly created product
        const newest = updated.find((p: PurchaseProduct) => p.name === productForm.name);
        if (newest) onProductSelect(newest.id);
      }
    }
  };

  // Open supplier modal
  const openSupplierNew = () => {
    setNewSupplierName("");
    setSupplierError("");
    setSupplierModalOpen(true);
  };

  // Save new supplier to catalogos
  const saveSupplier = async () => {
    setSupplierError("");
    if (!newSupplierName.trim()) return setSupplierError("Nombre del proveedor es requerido");
    const res = await apiFetch("/api/configuracion/catalogos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "proveedor", value: newSupplierName.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setSupplierError(d.error || "Error al guardar proveedor");
    }
    setSupplierModalOpen(false);
    setForm((f) => ({ ...f, counterparty: newSupplierName.trim() }));
    reloadSuppliers();
  };

  const load = useCallback(() => {
    apiFetch(`/api/finanzas/finanzas?period=${period}`).then((r) => r.json()).then((d) => {
      setExpenses(d.transactions.filter((t: Transaction) => t.type === "egreso"));
    }).finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Computed values
  const computedTotal = useMemo(() => {
    if (isPurchase && form.presentations && form.pricePerPresentation) {
      return (Number(form.presentations) * Number(form.pricePerPresentation)).toFixed(2);
    }
    if (Number(form.quantity) > 0 && Number(form.unitPrice) > 0) {
      return (Number(form.quantity) * Number(form.unitPrice)).toFixed(2);
    }
    return "";
  }, [isPurchase, form.presentations, form.pricePerPresentation, form.quantity, form.unitPrice]);

  const quantityInBaseUnit = useMemo(() => {
    if (isPurchase && form.presentations && form.factor) {
      return Number(form.presentations) * Number(form.factor);
    }
    return null;
  }, [isPurchase, form.presentations, form.factor]);

  const openNew = () => {
    setEditing(null);
    setError("");
    // Preseleccionar la primera presentación (la categoría por defecto es de compra)
    const first = getPresentationsForUnit("unidades")[0];
    setForm({ ...defaultForm(), presentation: first?.label || "", factor: first ? String(first.factor) : "" });
    setModalOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": openNew, producto: openProductNew, proveedor: openSupplierNew });

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setError("");

    // Pre-llenar campos de compra (presentación) a partir de cantidad/valor unitario guardados
    let presentation = t.presentation || "";
    let presentations = "";
    let pricePerPresentation = "";
    let factor = "";
    const qty = Number(t.quantity) || 0;
    const up = Number(t.unitPrice) || 0;
    if (purchaseCategories.includes(t.category) && qty > 0) {
      // Buscar el factor de la presentación guardada en el mapa completo
      let matchedFactor = 1;
      if (t.presentation) {
        for (const list of Object.values(presentationsByUnit)) {
          const m = list.find((p) => p.label === t.presentation);
          if (m) { matchedFactor = m.factor; break; }
        }
      }
      presentations = String(qty / matchedFactor);
      pricePerPresentation = up > 0 ? String(up * matchedFactor) : "";
      factor = String(matchedFactor);
    }

    setForm({
      date: t.date,
      category: t.category,
      description: t.description,
      counterparty: t.counterparty || "",
      quantity: t.quantity || "",
      unitPrice: t.unitPrice || "",
      unit: t.unit || "unidades",
      amount: t.amount,
      notes: t.notes || "",
      feedId: t.feedId || "",
      presentation,
      presentations,
      pricePerPresentation,
      factor,
    });
    setModalOpen(true);
  };

  const onCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    const isPurch = purchaseCategories.includes(category);
    // Si la categoría es de compra, preseleccionar la primera presentación
    const presOptions = isPurch ? getPresentationsForUnit("unidades") : [];
    const first = presOptions[0];
    setForm((f) => ({
      ...f,
      category,
      // Reset purchase-specific fields when switching
      feedId: "",
      presentation: first?.label || "",
      presentations: "",
      pricePerPresentation: "",
      factor: first ? String(first.factor) : "",
      // Reset legacy fields
      quantity: "",
      unitPrice: "",
      amount: "",
    }));
    setSelectedProductId("");
  };

  const save = async () => {
    setError("");
    const method = editing ? "PUT" : "POST";

    let body: any;
    if (isPurchase && form.presentations && form.pricePerPresentation && form.presentation && form.factor) {
      body = {
        date: form.date,
        type: "egreso",
        category: form.category,
        description: form.description,
        counterparty: form.counterparty || null,
        presentation: form.presentation,
        presentations: Number(form.presentations),
        pricePerPresentation: Number(form.pricePerPresentation),
        factor: Number(form.factor),
        unit: selectedFeed?.unit || form.unit || "unidades",
        notes: form.notes || null,
        ...(isFeedPurchase && form.feedId ? { feedId: form.feedId } : {}),
        ...(selectedProductId ? { purchaseProductId: selectedProductId } : {}),
        ...(editing ? { id: editing.id } : {}),
      };
    } else if (editing) {
      body = { ...form, id: editing.id, type: "egreso", amount: computedTotal || form.amount };
    } else {
      body = { ...form, type: "egreso", amount: computedTotal || form.amount };
    }

    const res = await apiFetch("/api/finanzas/finanzas", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar el egreso");
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este egreso?")) return;
    await apiFetch(`/api/finanzas/finanzas?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalCount = expenses.length;
  const avgExpense = totalCount > 0 ? Math.round(totalExpenses / totalCount) : 0;

  const catMap = new Map<string, number>();
  expenses.forEach((t) => catMap.set(t.category, (catMap.get(t.category) || 0) + Number(t.amount)));
  const catData = Array.from(catMap.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  const topCategory = catData[0]?.category || "—";

  const chartMap = new Map<string, number>();
  expenses.forEach((t) => {
    const key = new Date(t.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
    chartMap.set(key, (chartMap.get(key) || 0) + Number(t.amount));
  });
  const chartData = Array.from(chartMap.entries()).map(([f, v]) => ({ fecha: f, egresos: v })).reverse();

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    return expenses.filter((expense) =>
      matchesTextQuery(search, [
        expense.date,
        new Date(expense.date + "T12:00:00").toLocaleDateString("es"),
        expense.category,
        expense.description,
        expense.counterparty,
        expense.presentation,
        expense.quantity,
        expense.unit,
        expense.unitPrice,
        expense.notes,
        expense.amount,
      ]),
    );
  }, [expenses, search]);

  return (
    <div>
      <PageHeader
        title="Egresos / Gastos"
        description="Gestión de egresos, costos operativos y compras del gallinero"
        help="Registra todos los gastos y egresos del gallinero.\n\n• Los egresos por 'Compra de alimento' pueden registrarse como compras detalladas con presentaciones (bultos, costales) que actualizan automáticamente el inventario.\n• Otros egresos son registros simples de gastos.\n• Las compras de alimento generan automáticamente movimientos de entrada en el inventario de alimentación.\n• Todos los egresos afectan el balance financiero."
        actions={
          <div className="flex gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
            </Select>
            <Button onClick={openNew}>+ Nuevo Egreso</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="outgoing" label="Total Egresos" value={`$${totalExpenses.toLocaleString()}`} color="red" />
        <StatCard icon="receipt" label="Número de Egresos" value={totalCount} color="blue" />
        <StatCard icon="tag" label="Categoría Principal" value={topCategory} color="purple" />
        <StatCard icon="bar-chart" label="Promedio / Egreso" value={`$${avgExpense.toLocaleString()}`} color="yellow" />
      </div>

      {chartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-600" aria-hidden="true" />
            <span>Egresos por Fecha</span>
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
              <Bar dataKey="egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {catData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
            <ArrowUp className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Desglose por Categoría</span>
          </h3>
          <div className="space-y-2">
            {catData.map((c, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-red-50 rounded">
                <span className="text-sm">{c.category}</span>
                <span className="font-semibold text-red-700">${c.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, categoría, proveedor o descripción..."
          resultCount={filteredExpenses.length}
          totalCount={expenses.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            icon="outgoing"
            message={
              search.trim()
                ? "No hay egresos que coincidan con la búsqueda"
                : "No hay egresos en este período"
            }
          />
        ) : (
          <Table headers={["Fecha", "Categoría", "Descripción", "Proveedor", "Detalle", "Monto", ""]}>
            {filteredExpenses.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(t.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3"><Badge color="red">{t.category}</Badge></td>
                <td className="px-4 py-3 text-sm max-w-[220px] truncate">{t.description}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{t.counterparty || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {t.presentation && t.quantity ? (
                    <span>{t.presentation} × {t.quantity} {t.unit || ""}</span>
                  ) : t.quantity && t.unitPrice ? (
                    <span>{t.quantity} × ${Number(t.unitPrice).toLocaleString()}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 font-bold text-red-600">-${Number(t.amount).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(t.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Egreso" : "Nuevo Egreso"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Categoría" value={form.category} onChange={onCategoryChange}>
            {expenseCats.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>

          {/* ─── Product selector for non-feed purchase categories ─── */}
          {isNonFeedPurchase && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Producto frecuente</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedProductId}
                  onChange={(e) => onProductSelect(e.target.value)}
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.lastPricePerPresentation ? ` — $${Number(p.lastPricePerPresentation).toLocaleString()}` : ""}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={openProductNew} className="px-3 py-2 text-sm rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 whitespace-nowrap" title="Crear nuevo producto">+ Producto</button>
                {selectedProductId && (
                  <button type="button" onClick={openProductEdit} className="px-3 py-2 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 whitespace-nowrap inline-flex items-center justify-center" title="Editar este producto" aria-label="Editar este producto">
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}

          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="¿En qué se gastó?" required />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor / Dónde se compró</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.counterparty}
                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                placeholder="Nombre del proveedor o tienda"
                list="catalog-egresos-proveedores"
              />
              <button type="button" onClick={openSupplierNew} className="px-3 py-2 text-sm rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 whitespace-nowrap" title="Crear nuevo proveedor">+ Proveedor</button>
            </div>
            <datalist id="catalog-egresos-proveedores">
              {supplierOptions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          {isPurchase ? (
            <>
              {/* ─── Purchase mode: presentation-based ─── */}
              {isFeedPurchase && (
                <Select label="Alimento" value={form.feedId} onChange={(e) => onFeedChange(e.target.value)} required>
                  <option value="">Seleccionar alimento...</option>
                  {feeds.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} (stock: {f.currentStock} {f.unit})</option>
                  ))}
                </Select>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Select label="Presentación" value={form.presentation} onChange={(e) => onPresentationChange(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {availablePresentations.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </Select>
                <Input label="Cantidad" type="number" step="1" min="1" value={form.presentations} onChange={(e) => setForm({ ...form, presentations: e.target.value })} placeholder="Ej: 2" required />
              </div>

              <Input label={`Precio por ${form.presentation || "presentación"} ($)`} type="number" step="0.01" min="0" value={form.pricePerPresentation} onChange={(e) => setForm({ ...form, pricePerPresentation: e.target.value })} placeholder="Ej: 95000" />

              {quantityInBaseUnit !== null && quantityInBaseUnit > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <p className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{form.presentations} {form.presentation?.toLowerCase()}(s) × {form.factor} = <strong>{quantityInBaseUnit} {selectedFeed?.unit || "unidades"}</strong></span>
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ─── Non-purchase mode: legacy simple form ─── */}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Cantidad" type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Ej: 5" />
                <Input label="Valor Unitario ($)" type="number" step="0.01" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="Ej: 4500" />
              </div>
            </>
          )}

          {computedTotal ? (
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <p className="flex items-center gap-2">
                <Calculator className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Total: <strong className="text-xl">${Number(computedTotal).toLocaleString()}</strong>
                  {isPurchase && form.presentations && form.pricePerPresentation
                    ? ` (${form.presentations} × $${Number(form.pricePerPresentation).toLocaleString()})`
                    : form.quantity && form.unitPrice
                      ? ` (${form.quantity} × $${Number(form.unitPrice).toLocaleString()})`
                      : ""}
                </span>
              </p>
            </div>
          ) : (
            !isPurchase && (
              <Input label="Monto Total ($)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Usado cuando no hay cantidad/valor unitario" />
            )
          )}

          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.description || (!computedTotal && !form.amount)}>{editing ? "Actualizar Egreso" : "Registrar Egreso"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Product creation/edit modal ─── */}
      <Modal open={productModalOpen} onClose={() => setProductModalOpen(false)} title={productEditingId ? "Editar Producto" : "+ Nuevo Producto"}>
        <div className="space-y-4">
          {productError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{productError}</p>}
          <Input label="Nombre del producto" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Ej: Vacuna Newcastle" required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Unidad" value={productForm.defaultUnit} onChange={(e) => setProductForm({ ...productForm, defaultUnit: e.target.value })}>
              <option value="unidades">Unidades</option>
              <option value="kg">Kg</option>
              <option value="lb">Libra</option>
              <option value="litros">Litros</option>
            </Select>
            <Select label="Presentación habitual" value={productForm.defaultPresentation} onChange={(e) => setProductForm({ ...productForm, defaultPresentation: e.target.value })}>
              {getPresentationsForUnit(productForm.defaultUnit).map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </Select>
          </div>
          <Input label="Precio por presentación ($)" type="number" step="0.01" min="0" value={productForm.lastPricePerPresentation} onChange={(e) => setProductForm({ ...productForm, lastPricePerPresentation: e.target.value })} placeholder="Ej: 12000" />
          <Input label="Proveedor habitual" value={productForm.defaultSupplier} onChange={(e) => setProductForm({ ...productForm, defaultSupplier: e.target.value })} placeholder="Ej: Veterinaria XYZ" list="catalog-egresos-proveedores" />
          <Textarea label="Notas" value={productForm.notes} onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })} placeholder="Observaciones opcionales" />
          <div className="flex gap-3">
            <Button onClick={saveProduct}>{productEditingId ? "Actualizar Producto" : "Crear Producto"}</Button>
            <Button variant="secondary" onClick={() => setProductModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Supplier creation modal ─── */}
      <Modal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} title="+ Nuevo Proveedor">
        <div className="space-y-4">
          {supplierError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{supplierError}</p>}
          <Input label="Nombre del proveedor" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Ej: Agroinsumos El Campo" required />
          <div className="flex gap-3">
            <Button onClick={saveSupplier} disabled={!newSupplierName.trim()}>Crear Proveedor</Button>
            <Button variant="secondary" onClick={() => setSupplierModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

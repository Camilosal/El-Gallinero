"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface ReceivableAccount {
  id: string;
  transactionId: string;
  buyer: string;
  totalAmount: string;
  paidAmount: string;
  pendingAmount: string;
  dueDate: string | null;
  status: string;
  agingDays: number;
  isOverdue: boolean;
  transactionDate: string | null;
  transactionCategory: string | null;
  transactionDescription: string | null;
}

interface PayableAccount {
  id: string;
  transactionId: string;
  supplier: string;
  totalAmount: string;
  paidAmount: string;
  pendingAmount: string;
  dueDate: string | null;
  status: string;
  agingDays: number;
  isOverdue: boolean;
  transactionDate: string | null;
  transactionCategory: string | null;
  transactionDescription: string | null;
}

interface Payment {
  id: string;
  date: string;
  type: string;
  receivableId: string | null;
  payableId: string | null;
  amount: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function CuentasPage() {
  const [tab, setTab] = useState<"cobrar" | "pagar">("cobrar");
  const [receivables, setReceivables] = useState<ReceivableAccount[]>([]);
  const [payables, setPayables] = useState<PayableAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; type: "cobrar" | "pagar"; pending: number } | null>(null);
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split("T")[0], amount: "", method: "efectivo", reference: "", notes: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [recRes, payRes, paymRes] = await Promise.all([
      apiFetch("/api/cuentas-cobrar"),
      apiFetch("/api/cuentas-pagar"),
      apiFetch("/api/pagos"),
    ]);
    if (recRes.ok) setReceivables(await recRes.json());
    if (payRes.ok) setPayables(await payRes.json());
    if (paymRes.ok) setPayments(await paymRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPendingCobrar = receivables.reduce((s, a) => s + Number(a.pendingAmount), 0);
  const totalPendingPagar = payables.reduce((s, a) => s + Number(a.pendingAmount), 0);
  const overdueCobrar = receivables.filter((a) => a.isOverdue).length;
  const overduePagar = payables.filter((a) => a.isOverdue).length;

  const openPayment = (accountId: string, type: "cobrar" | "pagar", pending: number) => {
    setSelectedAccount({ id: accountId, type, pending });
    setPayForm({ date: new Date().toISOString().split("T")[0], amount: String(pending), method: "efectivo", reference: "", notes: "" });
    setError("");
    setPaymentModalOpen(true);
  };

  const savePayment = async () => {
    setError("");
    if (!selectedAccount || !payForm.amount || Number(payForm.amount) <= 0) {
      return setError("Monto debe ser mayor a 0");
    }

    const body: any = {
      date: payForm.date,
      type: selectedAccount.type === "cobrar" ? "cobro" : "pago",
      amount: payForm.amount,
      method: payForm.method,
      reference: payForm.reference || null,
      notes: payForm.notes || null,
    };

    if (selectedAccount.type === "cobrar") {
      body.receivableId = selectedAccount.id;
    } else {
      body.payableId = selectedAccount.id;
    }

    const res = await apiFetch("/api/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Error al registrar pago");
    }

    setPaymentModalOpen(false);
    load();
  };

  const removePayment = async (id: string) => {
    if (!confirm("¿Eliminar este pago? Se revertirá el abono.")) return;
    await apiFetch(`/api/pagos?id=${id}`, { method: "DELETE" });
    load();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pagado": return <Badge color="green">Pagado</Badge>;
      case "parcial": return <Badge color="yellow">Parcial</Badge>;
      default: return <Badge color="red">Pendiente</Badge>;
    }
  };

  const accounts = tab === "cobrar" ? receivables : payables;

  return (
    <div className="space-y-6">
      <PageHeader
        title="💳 Cuentas"
        description="Gestión de cuentas por cobrar y por pagar"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📥" label="Por cobrar" value={fmt(totalPendingCobrar)} color="green" />
        <StatCard icon="📤" label="Por pagar" value={fmt(totalPendingPagar)} color="red" />
        <StatCard icon="⚠️" label="Vencidas (cobrar)" value={String(overdueCobrar)} color="yellow" />
        <StatCard icon="⚠️" label="Vencidas (pagar)" value={String(overduePagar)} color="purple" />
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("cobrar")}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === "cobrar" ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
        >
          Por Cobrar ({receivables.length})
        </button>
        <button
          onClick={() => setTab("pagar")}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === "pagar" ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
        >
          Por Pagar ({payables.length})
        </button>
      </div>

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : accounts.length === 0 ? (
        <EmptyState icon="💳" message={tab === "cobrar" ? "No hay cuentas por cobrar" : "No hay cuentas por pagar"} />
      ) : (
        <Card>
          <Table headers={[tab === "cobrar" ? "Comprador" : "Proveedor", "Total", "Pagado", "Pendiente", "Vencimiento", "Días", "Estado", "Acciones"]}>
            {accounts.map((a) => (
              <tr key={a.id} className={`hover:bg-slate-50 ${a.isOverdue ? "bg-red-50" : ""}`}>
                <td className="px-4 py-3 text-sm font-medium">{"buyer" in a ? a.buyer : a.supplier}</td>
                <td className="px-4 py-3 text-sm">{fmt(Number(a.totalAmount))}</td>
                <td className="px-4 py-3 text-sm text-green-600">{fmt(Number(a.paidAmount))}</td>
                <td className="px-4 py-3 text-sm font-bold text-red-600">{fmt(Number(a.pendingAmount))}</td>
                <td className="px-4 py-3 text-sm">{a.dueDate || "—"}</td>
                <td className="px-4 py-3 text-sm">
                  {a.isOverdue ? (
                    <Badge color="red">{a.agingDays} días</Badge>
                  ) : (
                    <span className="text-slate-500">{a.agingDays}</span>
                  )}
                </td>
                <td className="px-4 py-3">{statusBadge(a.status)}</td>
                <td className="px-4 py-3">
                  {a.status !== "pagado" && (
                    <button
                      onClick={() => openPayment(a.id, tab, Number(a.pendingAmount))}
                      className="text-green-600 hover:underline text-xs"
                    >
                      Registrar pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-3">Últimos Pagos</h3>
          <Table headers={["Fecha", "Tipo", "Monto", "Método", "Referencia", "Notas", "Acciones"]}>
            {payments.slice(0, 20).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{p.date}</td>
                <td className="px-4 py-3">
                  <Badge color={p.type === "cobro" ? "green" : "red"}>
                    {p.type === "cobro" ? "📥 Cobro" : "📤 Pago"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm font-bold">{fmt(Number(p.amount))}</td>
                <td className="px-4 py-3 text-sm">{p.method || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{p.reference || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-[150px] truncate">{p.notes || "—"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => removePayment(p.id)} className="text-red-600 hover:underline text-xs">Revertir</button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* Payment modal */}
      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="💳 Registrar Pago">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">Pendiente: <strong className="text-lg text-red-600">{selectedAccount ? fmt(selectedAccount.pending) : ""}</strong></p>
          </div>
          <Input label="Fecha" type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
          <Input label="Monto ($)" type="number" step="0.01" min="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required />
          <Select label="Método" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="nequi">Nequi</option>
            <option value="daviplata">Daviplata</option>
            <option value="otro">Otro</option>
          </Select>
          <Input label="Referencia" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Nº de comprobante" />
          <Input label="Notas" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={savePayment}>Registrar</Button>
            <Button variant="secondary" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { Input } from "@/components/ui";
import { computeTransactionTaxBreakdown } from "@/lib/analytics/payroll-tax-supplies";

export interface TaxFieldsState {
  ivaRate: string;
  reteFuenteRate: string;
  icaRate: string;
  otherDeductionsAmount: string;
  taxNotes: string;
}

export const emptyTaxFields = (): TaxFieldsState => ({
  ivaRate: "",
  reteFuenteRate: "",
  icaRate: "",
  otherDeductionsAmount: "",
  taxNotes: "",
});

export function TaxDeductionsFields({
  grossAmount,
  value,
  onChange,
  mode = "egreso",
}: {
  grossAmount: number;
  value: TaxFieldsState;
  onChange: (next: TaxFieldsState) => void;
  mode?: "egreso" | "ingreso";
}) {
  const hasAnyValue = Boolean(
    Number(value.ivaRate || 0) > 0 ||
      Number(value.reteFuenteRate || 0) > 0 ||
      Number(value.icaRate || 0) > 0 ||
      Number(value.otherDeductionsAmount || 0) > 0 ||
      value.taxNotes.trim(),
  );
  const [expanded, setExpanded] = useState(hasAnyValue);

  const preview = computeTransactionTaxBreakdown({
    amount: grossAmount,
    inputMode: "gross",
    ivaRate: Number(value.ivaRate || 0),
    reteFuenteRate: Number(value.reteFuenteRate || 0),
    icaRate: Number(value.icaRate || 0),
    otherDeductionsAmount: Number(value.otherDeductionsAmount || 0),
  });

  const applyColombianPreset = (preset: "exento" | "agro92" | "compras19" | "servicios4") => {
    if (preset === "exento") {
      onChange({ ...value, ivaRate: "0", reteFuenteRate: "0", icaRate: "0" });
    } else if (preset === "agro92") {
      onChange({ ...value, ivaRate: "0", reteFuenteRate: "1.5", icaRate: value.icaRate || "0.4" });
    } else if (preset === "compras19") {
      onChange({ ...value, ivaRate: "19", reteFuenteRate: "2.5", icaRate: value.icaRate || "0.4" });
    } else {
      onChange({ ...value, ivaRate: "19", reteFuenteRate: "4", icaRate: value.icaRate || "0.4" });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100/70 rounded-xl transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <Receipt className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span>Impuestos y retenciones (IVA, ReteFuente, ICA)</span>
          {hasAnyValue && (
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
              Neto ${preview.netSettlementAmount.toLocaleString("es-CO")}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium mr-1">Plantillas CO:</span>
            <button
              type="button"
              onClick={() => applyColombianPreset("exento")}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-100"
            >
              Exento (0%)
            </button>
            <button
              type="button"
              onClick={() => applyColombianPreset("agro92")}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-100"
            >
              Agro (Rete 1.5%)
            </button>
            <button
              type="button"
              onClick={() => applyColombianPreset("compras19")}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-100"
            >
              Insumos 19% + 2.5%
            </button>
            <button
              type="button"
              onClick={() => applyColombianPreset("servicios4")}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-100"
            >
              Servicios 19% + 4%
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Input
              label="IVA %"
              type="number"
              step="0.5"
              min="0"
              max="30"
              value={value.ivaRate}
              onChange={(e) => onChange({ ...value, ivaRate: e.target.value })}
              placeholder="0"
            />
            <Input
              label="ReteFuente %"
              type="number"
              step="0.1"
              min="0"
              max="25"
              value={value.reteFuenteRate}
              onChange={(e) => onChange({ ...value, reteFuenteRate: e.target.value })}
              placeholder="0"
            />
            <Input
              label="ICA %"
              type="number"
              step="0.05"
              min="0"
              max="5"
              value={value.icaRate}
              onChange={(e) => onChange({ ...value, icaRate: e.target.value })}
              placeholder="0.4"
            />
            <Input
              label="Otras deducc. ($)"
              type="number"
              step="1"
              min="0"
              value={value.otherDeductionsAmount}
              onChange={(e) => onChange({ ...value, otherDeductionsAmount: e.target.value })}
              placeholder="0"
            />
          </div>

          <Input
            label="Nota tributaria / No. factura"
            value={value.taxNotes}
            onChange={(e) => onChange({ ...value, taxNotes: e.target.value })}
            placeholder="Ej: Factura electrónica FE-1042, exento Art. 477 ET"
          />

          {grossAmount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs">
              <div>
                <p className="text-slate-400">Subtotal base</p>
                <p className="font-semibold text-slate-800">${preview.subtotalAmount.toLocaleString("es-CO")}</p>
              </div>
              <div>
                <p className="text-slate-400">IVA incluido</p>
                <p className="font-semibold text-slate-800">${preview.ivaAmount.toLocaleString("es-CO")}</p>
              </div>
              <div>
                <p className="text-slate-400">Retenciones / deducc.</p>
                <p className="font-semibold text-amber-700">-${preview.totalDeductionsAmount.toLocaleString("es-CO")}</p>
              </div>
              <div>
                <p className="text-slate-400">{mode === "ingreso" ? "Neto a recibir" : "Neto a pagar"}</p>
                <p className="font-bold text-emerald-700">${preview.netSettlementAmount.toLocaleString("es-CO")}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

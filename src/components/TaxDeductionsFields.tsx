"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { Input } from "@/components/ui";
import { useMasterSettings } from "@/lib/use-master-settings";
import {
  computeTransactionTaxBreakdown,
  inferManagedTaxProfile,
  type ManagedTaxProfile,
} from "@/lib/analytics/payroll-tax-supplies";

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

interface TaxSettingsValues {
  uvtCop: number;
  ivaDefaultPct: number;
  ivaAgroPct: number;
  reteAgroPct: number;
  reteComprasPct: number;
  reteServiciosPct: number;
  icaDefaultPct: number;
  reteComprasThresholdUvt: number;
  reteAgroThresholdUvt: number;
}

export function TaxDeductionsFields({
  grossAmount,
  value,
  onChange,
  mode = "egreso",
  category,
  profile,
  isExisting = false,
}: {
  grossAmount: number;
  value: TaxFieldsState;
  onChange: (next: TaxFieldsState) => void;
  mode?: "egreso" | "ingreso";
  category?: string;
  profile?: ManagedTaxProfile;
  isExisting?: boolean;
}) {
  const { values: rawTaxSettings } = useMasterSettings();
  const settingNumber = (key: string) => Number(rawTaxSettings[key] || 0);
  const taxSettings: TaxSettingsValues = {
    uvtCop: settingNumber("external.tax_uvt_cop"),
    ivaDefaultPct: settingNumber("tax.iva_default_pct"),
    ivaAgroPct: settingNumber("tax.iva_agro_pct"),
    reteAgroPct: settingNumber("tax.retefuente_agro_pct"),
    reteComprasPct: settingNumber("tax.retefuente_compras_pct"),
    reteServiciosPct: settingNumber("tax.retefuente_servicios_pct"),
    icaDefaultPct: settingNumber("tax.ica_default_pct"),
    reteComprasThresholdUvt: settingNumber("tax.retefuente_compras_threshold_uvt"),
    reteAgroThresholdUvt: settingNumber("tax.retefuente_agro_threshold_uvt"),
  };

  const taxProfile = profile || inferManagedTaxProfile(mode, category);
  const managedRates = (() => {
    if (isExisting) {
      return {
        ivaRate: Number(value.ivaRate || 0),
        reteFuenteRate: Number(value.reteFuenteRate || 0),
        icaRate: Number(value.icaRate || 0),
      };
    }
    if (taxProfile === "none") return { ivaRate: 0, reteFuenteRate: 0, icaRate: 0 };
    const agriculturalThreshold = taxSettings.uvtCop * taxSettings.reteAgroThresholdUvt;
    const purchaseThreshold = taxSettings.uvtCop * taxSettings.reteComprasThresholdUvt;
    return {
      ivaRate: taxProfile === "agro" ? taxSettings.ivaAgroPct : taxSettings.ivaDefaultPct,
      reteFuenteRate:
        taxProfile === "agro" && grossAmount >= agriculturalThreshold
          ? taxSettings.reteAgroPct
          : taxProfile === "purchases" && grossAmount >= purchaseThreshold
            ? taxSettings.reteComprasPct
            : taxProfile === "services"
              ? taxSettings.reteServiciosPct
              : 0,
      icaRate: taxSettings.icaDefaultPct,
    };
  })();
  const hasAnyValue = Boolean(
    managedRates.ivaRate > 0 ||
      managedRates.reteFuenteRate > 0 ||
      managedRates.icaRate > 0 ||
      Number(value.otherDeductionsAmount || 0) > 0 ||
      value.taxNotes.trim(),
  );
  const [expanded, setExpanded] = useState(hasAnyValue);

  const preview = computeTransactionTaxBreakdown({
    amount: grossAmount,
    inputMode: "gross",
    ivaRate: managedRates.ivaRate,
    reteFuenteRate: managedRates.reteFuenteRate,
    icaRate: managedRates.icaRate,
    otherDeductionsAmount: Number(value.otherDeductionsAmount || 0),
  });

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
          <p className="text-[11px] text-slate-500">
            Las tasas provienen de Catálogos y quedan guardadas con esta operación. Para corregirlas, cambia el valor maestro antes de registrar nuevas operaciones.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Input
              label="IVA %"
              type="number"
              step="0.5"
              min="0"
              max="30"
              value={managedRates.ivaRate}
              disabled
            />
            <Input
              label="ReteFuente %"
              type="number"
              step="0.1"
              min="0"
              max="25"
              value={managedRates.reteFuenteRate}
              disabled
            />
            <Input
              label="ICA %"
              type="number"
              step="0.05"
              min="0"
              max="5"
              value={managedRates.icaRate}
              disabled
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

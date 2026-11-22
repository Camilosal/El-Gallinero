"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, Info, Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import {
  DRIVER_LABELS,
  NON_FEED_STANDARD_EXPENSE_FAMILIES,
  STANDARD_EXPENSE_CATALOG,
  STANDARD_EXPENSE_FAMILIES,
  TREATMENT_LABELS,
  findStandardExpenseById,
  findStandardExpenseFamily,
  resolveExpenseClassification,
  searchStandardExpenseCatalog,
  type StandardExpenseItem,
} from "@/lib/finance/standard-expense-catalog";

export interface StandardExpenseSelection {
  category: string;
  expenseCatalogId: string;
  expenseFamily: string;
  expenseConcept: string;
  expenseTreatment: string;
  expenseDriver: string;
}

export interface StandardExpensePickerMeta {
  standardItem: StandardExpenseItem | null;
  recommendedUnit?: "unidades" | "kg" | "litros" | "otro";
  isPurchaseWorkflow: boolean;
  isFeedPurchase: boolean;
  isSupplyPurchase: boolean;
  isCapex: boolean;
  supportsSupplyLink: boolean;
}

interface StandardExpensePickerProps {
  value: StandardExpenseSelection;
  onChange: (next: StandardExpenseSelection, meta: StandardExpensePickerMeta) => void;
  includeFeedCategory?: boolean;
  includeManualLabor?: boolean;
  compact?: boolean;
  extraCategories?: string[];
}

const FEED_FAMILY_OPTION = "Compra de alimento";
const LABOR_FAMILY_OPTION = "Mano de obra";

export default function StandardExpensePicker({
  value,
  onChange,
  includeFeedCategory = true,
  includeManualLabor = true,
  compact = false,
  extraCategories = [],
}: StandardExpensePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const resolvedCurrent = useMemo(
    () =>
      resolveExpenseClassification({
        type: "egreso",
        category: value.category,
        expenseCatalogId: value.expenseCatalogId || null,
        expenseFamily: value.expenseFamily || null,
        expenseConcept: value.expenseConcept || null,
        expenseTreatment: value.expenseTreatment || null,
        expenseDriver: value.expenseDriver || null,
      }),
    [value],
  );

  const selectedStandardItem = useMemo(
    () => findStandardExpenseById(value.expenseCatalogId) || resolvedCurrent.standardItem,
    [value.expenseCatalogId, resolvedCurrent.standardItem],
  );

  const activeFamilyName = useMemo(() => {
    if (value.category === FEED_FAMILY_OPTION) return FEED_FAMILY_OPTION;
    if (value.category === LABOR_FAMILY_OPTION) return LABOR_FAMILY_OPTION;
    if (value.expenseFamily && findStandardExpenseFamily(value.expenseFamily)) {
      return value.expenseFamily;
    }
    if (resolvedCurrent.expenseFamily && findStandardExpenseFamily(resolvedCurrent.expenseFamily)) {
      return resolvedCurrent.expenseFamily;
    }
    return value.category;
  }, [value.category, value.expenseFamily, resolvedCurrent.expenseFamily]);

  const activeFamilyMeta = useMemo(
    () => findStandardExpenseFamily(activeFamilyName),
    [activeFamilyName],
  );

  const familyConcepts = useMemo(() => {
    if (!activeFamilyMeta) return [];
    return STANDARD_EXPENSE_CATALOG.filter((item) => item.family === activeFamilyMeta.name);
  }, [activeFamilyMeta]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchStandardExpenseCatalog(searchQuery, {
      excludeFood: !includeFeedCategory,
    }).slice(0, compact ? 6 : 10);
  }, [searchQuery, includeFeedCategory, compact]);

  const opexFamilies = useMemo(
    () => STANDARD_EXPENSE_FAMILIES.filter((f) => f.isOpex),
    [],
  );
  const specialFamilies = useMemo(
    () => NON_FEED_STANDARD_EXPENSE_FAMILIES.filter((f) => !f.isOpex),
    [],
  );

  const emitSelection = (next: StandardExpenseSelection, stdItem: StandardExpenseItem | null) => {
    const famMeta = findStandardExpenseFamily(next.expenseFamily || next.category);
    const isFeed = next.category === FEED_FAMILY_OPTION || famMeta?.code === "24";
    const isCapex = stdItem?.isCapexConcept || famMeta?.code === "22" || next.category === "Equipamiento";
    const isBio = stdItem?.isBiologicalConcept || famMeta?.code === "23" || next.category === "Compra de gallinas";
    const supportsSupplyLink =
      stdItem?.supportsSupplyInventoryLink ||
      Boolean(
        famMeta &&
          ["01", "02", "03", "04", "08", "09", "10", "11", "12", "13"].includes(famMeta.code),
      ) ||
      next.category === "Compra de insumos" ||
      next.category === "Control sanitario";
    const isPurchaseWorkflow =
      isFeed ||
      isCapex ||
      isBio ||
      Boolean(stdItem?.isPurchaseWorkflow) ||
      (!stdItem && Boolean(famMeta?.isPurchaseWorkflow)) ||
      ["Compra de alimento", "Compra de insumos", "Control sanitario", "Equipamiento", "Compra de gallinas"].includes(
        next.category,
      );

    onChange(next, {
      standardItem: stdItem,
      recommendedUnit: stdItem?.defaultSystemUnit,
      isPurchaseWorkflow,
      isFeedPurchase: next.category === FEED_FAMILY_OPTION,
      isSupplyPurchase: supportsSupplyLink && !isFeed && !isCapex,
      isCapex,
      supportsSupplyLink,
    });
  };

  const handleFamilySelect = (selected: string) => {
    setSearchQuery("");
    if (selected === FEED_FAMILY_OPTION) {
      emitSelection(
        {
          category: FEED_FAMILY_OPTION,
          expenseCatalogId: "CST-278",
          expenseFamily: "24 Alimentación (en otro módulo)",
          expenseConcept: "Compra concentrado y granos",
          expenseTreatment: "ALIMENTO",
          expenseDriver: "EVENTO",
        },
        findStandardExpenseById("CST-278"),
      );
      return;
    }
    if (selected === LABOR_FAMILY_OPTION) {
      emitSelection(
        {
          category: LABOR_FAMILY_OPTION,
          expenseCatalogId: "",
          expenseFamily: "Mano de obra (Nómina / jornales)",
          expenseConcept: "",
          expenseTreatment: "FIJO",
          expenseDriver: "MES",
        },
        null,
      );
      return;
    }

    const famMeta = findStandardExpenseFamily(selected);
    if (famMeta) {
      emitSelection(
        {
          category: famMeta.name,
          expenseCatalogId: "",
          expenseFamily: famMeta.name,
          expenseConcept: "",
          expenseTreatment: famMeta.defaultTreatment,
          expenseDriver: famMeta.defaultDriver,
        },
        null,
      );
      return;
    }

    const legacyResolved = resolveExpenseClassification({ type: "egreso", category: selected });
    emitSelection(
      {
        category: selected,
        expenseCatalogId: legacyResolved.expenseCatalogId || "",
        expenseFamily: legacyResolved.expenseFamily || "",
        expenseConcept: legacyResolved.expenseConcept || "",
        expenseTreatment: legacyResolved.expenseTreatment || "VARIABLE",
        expenseDriver: legacyResolved.expenseDriver || "UNIDAD_MENSUAL",
      },
      legacyResolved.standardItem,
    );
  };

  const handleConceptSelect = (catalogId: string) => {
    if (!catalogId) {
      const fam = activeFamilyMeta;
      emitSelection(
        {
          category: fam?.name || value.category,
          expenseCatalogId: "",
          expenseFamily: fam?.name || value.expenseFamily,
          expenseConcept: "",
          expenseTreatment: fam?.defaultTreatment || value.expenseTreatment || "VARIABLE",
          expenseDriver: fam?.defaultDriver || value.expenseDriver || "UNIDAD_MENSUAL",
        },
        null,
      );
      return;
    }
    const item = findStandardExpenseById(catalogId);
    if (!item) return;
    emitSelection(
      {
        category: item.familyCode === "24" ? FEED_FAMILY_OPTION : item.family,
        expenseCatalogId: item.id,
        expenseFamily: item.family,
        expenseConcept: item.concept,
        expenseTreatment: item.treatment,
        expenseDriver: item.driver,
      },
      item,
    );
  };

  const applySearchResult = (item: StandardExpenseItem) => {
    setSearchQuery("");
    emitSelection(
      {
        category: item.familyCode === "24" ? FEED_FAMILY_OPTION : item.family,
        expenseCatalogId: item.id,
        expenseFamily: item.family,
        expenseConcept: item.concept,
        expenseTreatment: item.treatment,
        expenseDriver: item.driver,
      },
      item,
    );
  };

  const nonStandardExtras = extraCategories.filter(
    (c) =>
      c !== FEED_FAMILY_OPTION &&
      c !== LABOR_FAMILY_OPTION &&
      !findStandardExpenseFamily(c),
  );

  return (
    <div className="space-y-3 rounded-[var(--iw-radius-card)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
          <BookOpen className="h-3.5 w-3.5 text-[var(--iw-semantic-action-primary)]" aria-hidden="true" />
          <span>Catálogo estándar de egresos (Familia / centro y Concepto)</span>
        </span>
        {selectedStandardItem && (
          <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--iw-semantic-action-primary)]">
            {selectedStandardItem.id} · {selectedStandardItem.priority}
          </span>
        )}
      </div>

      {/* Búsqueda rápida por concepto o código */}
      <div className="relative">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--iw-semantic-text-secondary)]"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar concepto o código (ej: vacuna, cubeta, viruta, luz, CST-090)..."
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
              aria-label="Limpiar búsqueda de concepto"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="mt-1.5 max-h-56 overflow-y-auto rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-1 shadow-sm">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applySearchResult(item)}
                className="flex w-full items-start justify-between gap-2 rounded px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--iw-semantic-bg-subtle)]"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--iw-semantic-text-primary)]">
                    <span className="mr-1.5 font-mono text-[11px] text-[var(--iw-semantic-action-primary)]">
                      {item.id}
                    </span>
                    {item.concept}
                  </div>
                  <div className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                    {item.family} · {TREATMENT_LABELS[item.treatment]}
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--iw-semantic-text-secondary)]">
                  {item.priority}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selección en 2 niveles: Familia / centro + Concepto individual */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Familia / centro de costo"
          value={activeFamilyName}
          onChange={(e) => handleFamilySelect(e.target.value)}
        >
          <optgroup label="Operación directa / módulos vinculados">
            {includeFeedCategory && (
              <option value={FEED_FAMILY_OPTION}>Compra de alimento (Módulo Alimentación)</option>
            )}
            {includeManualLabor && (
              <option value={LABOR_FAMILY_OPTION}>Mano de obra (Nómina y jornales)</option>
            )}
          </optgroup>
          <optgroup label="Familias operativas estándar (OPEX)">
            {opexFamilies.map((fam) => (
              <option key={fam.name} value={fam.name}>
                {fam.name} ({fam.conceptsCount})
              </option>
            ))}
          </optgroup>
          <optgroup label="No OPEX / CapEx / Financiero / Exclusiones">
            {specialFamilies.map((fam) => (
              <option key={fam.name} value={fam.name}>
                {fam.name} · {TREATMENT_LABELS[fam.defaultTreatment]}
              </option>
            ))}
          </optgroup>
          {nonStandardExtras.length > 0 && (
            <optgroup label="Categorías legadas o personalizadas de la finca">
              {nonStandardExtras.map((extra) => (
                <option key={extra} value={extra}>
                  {extra}
                </option>
              ))}
            </optgroup>
          )}
        </Select>

        <Select
          label="Concepto individual (Catálogo CST)"
          value={value.expenseCatalogId || ""}
          onChange={(e) => handleConceptSelect(e.target.value)}
          disabled={familyConcepts.length === 0}
        >
          <option value="">
            {familyConcepts.length > 0
              ? `General de ${activeFamilyMeta?.label || "la familia"} (${familyConcepts.length} conceptos)`
              : "Usa descripción libre para esta categoría"}
          </option>
          {familyConcepts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} · {item.concept} [{item.priority}]
            </option>
          ))}
        </Select>
      </div>

      {/* Metadatos y guías del catálogo */}
      {(selectedStandardItem || activeFamilyMeta) && (
        <div className="space-y-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--iw-semantic-text-primary)]">
              <CheckCircle2 className="h-3 w-3 text-[var(--iw-semantic-status-success)]" aria-hidden="true" />
              {TREATMENT_LABELS[
                (selectedStandardItem?.treatment ||
                  activeFamilyMeta?.defaultTreatment ||
                  "VARIABLE") as keyof typeof TREATMENT_LABELS
              ] || "OPEX"}
            </span>
            <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
              Driver:{" "}
              {DRIVER_LABELS[
                (selectedStandardItem?.driver ||
                  activeFamilyMeta?.defaultDriver ||
                  "UNIDAD_MENSUAL") as keyof typeof DRIVER_LABELS
              ] || "Por unidad"}
            </span>
            {selectedStandardItem && (
              <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
                Unidad: {selectedStandardItem.costUnit}
              </span>
            )}
            {(selectedStandardItem?.isSharedProrationCandidate ||
              (activeFamilyMeta?.sharedConceptsCount ?? 0) > 0) && (
              <span className="rounded border border-[var(--iw-semantic-status-warning)]/40 bg-[var(--iw-color-paper)] px-2 py-0.5 text-[11px] font-medium text-[var(--iw-semantic-status-warning)]">
                Costo compartido · Prorrateo sugerido
              </span>
            )}
          </div>

          {selectedStandardItem && !compact && (
            <div className="space-y-1 text-[11px] text-[var(--iw-semantic-text-secondary)]">
              {selectedStandardItem.measurementEvidence && (
                <p>
                  <strong className="text-[var(--iw-semantic-text-primary)]">Evidencia:</strong>{" "}
                  {selectedStandardItem.measurementEvidence}
                </p>
              )}
              {selectedStandardItem.controlNote && (
                <p className="flex items-start gap-1">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-[var(--iw-semantic-action-primary)]" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--iw-semantic-text-primary)]">Control:</strong>{" "}
                    {selectedStandardItem.controlNote}
                    {selectedStandardItem.noDuplicateWith
                      ? ` · ${selectedStandardItem.noDuplicateWith}`
                      : ""}
                  </span>
                </p>
              )}
            </div>
          )}

          {(activeFamilyMeta?.code === "22" || selectedStandardItem?.isCapexConcept) && (
            <p className="flex items-start gap-1.5 rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--iw-semantic-text-primary)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-status-warning)]" aria-hidden="true" />
              <span>
                <strong>No OPEX (CapEx):</strong> Se excluye del costo operativo mensual y se deprecia por vida útil. Registra la ficha en{" "}
                <Link href="/operaciones/activos" className="font-semibold underline">
                  Almacén → Activos y equipos
                </Link>
                .
              </span>
            </p>
          )}

          {(activeFamilyMeta?.code === "23" || selectedStandardItem?.isBiologicalConcept) && (
            <p className="flex items-start gap-1.5 rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--iw-semantic-text-primary)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-action-primary)]" aria-hidden="true" />
              <span>
                <strong>Activo biológico:</strong> Recomendado registrarlo en{" "}
                <Link href="/produccion/adquisiciones" className="font-semibold underline">
                  Producción → Adquisiciones
                </Link>{" "}
                para crear el lote/animal automáticamente.
              </span>
            </p>
          )}

          {(activeFamilyMeta?.code === "26" || activeFamilyMeta?.code === "25" || activeFamilyMeta?.code === "21") && (
            <p className="flex items-start gap-1.5 rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-status-warning)]" aria-hidden="true" />
              <span>
                <strong>Clasificado como No OPEX ({TREATMENT_LABELS[activeFamilyMeta.defaultTreatment]}):</strong> Registra el movimiento en caja/finanzas pero no altera el costo unitario real por huevo o kg de carne.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

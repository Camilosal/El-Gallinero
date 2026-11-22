"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Search } from "lucide-react";
import { Select } from "@/components/ui";
import {
  CAPEX_CLASSIFICATION_LABELS,
  CAPEX_DESTINATIONS,
  CAPEX_DESTINATION_LABELS,
  PRODUCTIVE_CAPEX_FAMILIES,
  STANDARD_CAPEX_CATALOG,
  STANDARD_CAPEX_FAMILIES,
  computeSuggestedResidualCop,
  findStandardCapexById,
  findStandardCapexFamily,
  getCapexFrontierRedirect,
  resolveCapexClassification,
  searchStandardCapexCatalog,
  type CapexClassificationType,
  type CapexDestinationType,
  type LegacyAssetCategory,
  type StandardCapexItem,
} from "@/lib/finance/standard-capex-catalog";

export interface CapexPickerSelectionPatch {
  capexCatalogId: string;
  capexFamily: string;
  capexSubfamily: string;
  capexClassification: CapexClassificationType;
  capexDestination: CapexDestinationType;
  capexDriver: string;
  category: LegacyAssetCategory;
  suggestedName?: string;
  suggestedLifeMonths?: number | null;
  suggestedResidualValue?: number;
  isFrontierExclusion: boolean;
}

interface StandardCapexPickerProps {
  capexCatalogId: string;
  capexFamily: string;
  capexSubfamily: string;
  capexClassification: string;
  capexDestination: string;
  capexDriver: string;
  category: string;
  acquisitionCost?: number | string;
  name?: string;
  onSelect: (patch: CapexPickerSelectionPatch) => void;
  onDestinationChange?: (destination: CapexDestinationType) => void;
  includeFrontierFamilies?: boolean;
  compact?: boolean;
}

export default function StandardCapexPicker({
  capexCatalogId,
  capexFamily,
  capexSubfamily,
  capexClassification,
  capexDestination,
  capexDriver,
  category,
  acquisitionCost,
  name,
  onSelect,
  onDestinationChange,
  includeFrontierFamilies = true,
  compact = false,
}: StandardCapexPickerProps) {
  const [search, setSearch] = useState("");

  const familyList = includeFrontierFamilies
    ? STANDARD_CAPEX_FAMILIES
    : PRODUCTIVE_CAPEX_FAMILIES;

  const selectedItem = useMemo(
    () => findStandardCapexById(capexCatalogId),
    [capexCatalogId],
  );

  const selectedFamilyMeta = useMemo(
    () => findStandardCapexFamily(capexFamily || selectedItem?.family),
    [capexFamily, selectedItem],
  );

  const subfamiliesForFamily = useMemo(() => {
    if (selectedFamilyMeta) return selectedFamilyMeta.subfamilies;
    return Array.from(new Set(STANDARD_CAPEX_CATALOG.map((item) => item.subfamily)));
  }, [selectedFamilyMeta]);

  const matchingConcepts = useMemo(() => {
    return searchStandardCapexCatalog(search, {
      family: selectedFamilyMeta ? selectedFamilyMeta.name : "all",
      subfamily: capexSubfamily || "all",
      excludeFrontier: !includeFrontierFamilies,
    });
  }, [search, selectedFamilyMeta, capexSubfamily, includeFrontierFamilies]);

  const costNum = Number(acquisitionCost) || 0;

  const emitFromItem = (item: StandardCapexItem) => {
    onSelect({
      capexCatalogId: item.id,
      capexFamily: item.family,
      capexSubfamily: item.subfamily,
      capexClassification: item.classification,
      capexDestination: item.destination,
      capexDriver: item.driver,
      category: item.defaultLegacyCategory,
      suggestedName: !name?.trim() ? item.concept : undefined,
      suggestedLifeMonths: item.suggestedLifeMonths,
      suggestedResidualValue: computeSuggestedResidualCop(costNum, item.suggestedResidualRate),
      isFrontierExclusion: item.isFrontierExclusion,
    });
  };

  const handleFamilyChange = (nextFamilyName: string) => {
    const fam = findStandardCapexFamily(nextFamilyName);
    if (!fam) {
      onSelect({
        capexCatalogId: "",
        capexFamily: "",
        capexSubfamily: "",
        capexClassification: "CAPEX_DEPRECIABLE",
        capexDestination: "Compartido",
        capexDriver: "según activo",
        category: "equipo",
        isFrontierExclusion: false,
      });
      return;
    }
    const firstSub = fam.subfamilies[0] || "";
    const resolved = resolveCapexClassification({
      capexFamily: fam.name,
      capexSubfamily: firstSub,
      category,
      name,
    });
    onSelect({
      capexCatalogId: "",
      capexFamily: fam.name,
      capexSubfamily: firstSub,
      capexClassification: resolved.capexClassification,
      capexDestination: resolved.capexDestination,
      capexDriver: resolved.capexDriver,
      category: fam.defaultLegacyCategory,
      suggestedLifeMonths: resolved.suggestedLifeMonths,
      isFrontierExclusion: resolved.isFrontierExclusion,
    });
  };

  const handleSubfamilyChange = (nextSub: string) => {
    const firstItem = nextSub
      ? STANDARD_CAPEX_CATALOG.find(
          (i) =>
            (!selectedFamilyMeta || i.family === selectedFamilyMeta.name) &&
            i.subfamily === nextSub,
        )
      : null;
    const resolved = resolveCapexClassification({
      capexFamily: firstItem?.family || selectedFamilyMeta?.name || capexFamily,
      capexSubfamily: nextSub,
      category,
      name,
    });
    onSelect({
      capexCatalogId: "",
      capexFamily: resolved.capexFamily || "",
      capexSubfamily: nextSub,
      capexClassification: resolved.capexClassification,
      capexDestination: resolved.capexDestination,
      capexDriver: resolved.capexDriver,
      category: resolved.legacyCategory,
      suggestedLifeMonths: resolved.suggestedLifeMonths,
      isFrontierExclusion: resolved.isFrontierExclusion,
    });
  };

  const handleConceptChange = (nextId: string) => {
    if (!nextId) {
      handleSubfamilyChange(capexSubfamily);
      return;
    }
    const item = findStandardCapexById(nextId);
    if (item) emitFromItem(item);
  };

  const effectiveClass = (capexClassification ||
    selectedItem?.classification ||
    selectedFamilyMeta?.defaultClassification ||
    "CAPEX_DEPRECIABLE") as CapexClassificationType;

  const effectiveDest = (capexDestination ||
    selectedItem?.destination ||
    selectedFamilyMeta?.defaultDestination ||
    "Compartido") as CapexDestinationType;

  const frontierRedirect =
    selectedItem?.frontierRedirect ||
    getCapexFrontierRedirect(effectiveClass, selectedItem?.concept || name);

  return (
    <div className="space-y-3 rounded-[var(--iw-radius-card)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">
          Clasificación estándar CapEx (21 familias · 242 conceptos)
        </span>
        {selectedItem && (
          <span className="font-mono text-xs font-semibold text-[var(--iw-semantic-action-primary)]">
            {selectedItem.id} · {selectedItem.priority}
          </span>
        )}
      </div>

      {/* Búsqueda rápida */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--iw-semantic-text-muted)]"
          aria-hidden="true"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código CAP, equipo, galpón, bomba, panel solar, terreno..."
          className="min-h-[44px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--iw-semantic-text-primary)] placeholder:text-[var(--iw-semantic-text-muted)] focus:border-[var(--iw-semantic-action-primary)] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Select
          label="Familia CapEx"
          value={selectedFamilyMeta?.name || ""}
          onChange={(e) => handleFamilyChange(e.target.value)}
        >
          <option value="">Selecciona o busca por concepto...</option>
          {familyList.map((fam) => (
            <option key={fam.code} value={fam.name}>
              {fam.name} ({fam.conceptsCount})
            </option>
          ))}
        </Select>

        <Select
          label="Subfamilia"
          value={capexSubfamily}
          onChange={(e) => handleSubfamilyChange(e.target.value)}
        >
          <option value="">Todas las subfamilias</option>
          {subfamiliesForFamily.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Select
            label="Concepto estándar del activo (CAP-xxx)"
            value={capexCatalogId}
            onChange={(e) => handleConceptChange(e.target.value)}
          >
            <option value="">
              {matchingConcepts.length > 0
                ? `Concepto general (${matchingConcepts.length} disponibles)`
                : "Sin coincidencia en el filtro actual"}
            </option>
            {matchingConcepts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.concept} [{item.priority}]
              </option>
            ))}
          </Select>
        </div>

        <Select
          label="Destino productivo"
          value={effectiveDest}
          onChange={(e) => onDestinationChange?.(e.target.value as CapexDestinationType)}
        >
          {CAPEX_DESTINATIONS.map((dest) => (
            <option key={dest} value={dest}>
              {CAPEX_DESTINATION_LABELS[dest]}
            </option>
          ))}
        </Select>
      </div>

      {/* Tarjeta de reglas contables y vida útil */}
      {(selectedItem || selectedFamilyMeta) && (
        <div className="space-y-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--iw-semantic-text-primary)]">
              <CheckCircle2
                className="h-3 w-3 text-[var(--iw-semantic-status-success)]"
                aria-hidden="true"
              />
              {CAPEX_CLASSIFICATION_LABELS[effectiveClass] || effectiveClass}
            </span>

            <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
              Driver: {capexDriver || selectedItem?.driver || "según activo"}
            </span>

            {selectedItem && (
              <>
                <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
                  Vida útil sug.:{" "}
                  {selectedItem.isNonDepreciableLand
                    ? "0 meses (No depreciable)"
                    : `${selectedItem.suggestedLifeMonths} meses`}
                </span>
                <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
                  Residual sug.: {Math.round(selectedItem.suggestedResidualRate * 100)}%
                </span>
              </>
            )}
          </div>

          {effectiveClass === "CAPEX_NO_DEPRECIABLE" && (
            <p className="flex items-start gap-1.5 rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--iw-semantic-text-primary)]">
              <Info
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-action-primary)]"
                aria-hidden="true"
              />
              <span>
                <strong>Terreno (CapEx No Depreciable):</strong> Suma al patrimonio de activos e inversión con vida útil 0 y depreciación mensual $0.
              </span>
            </p>
          )}

          {frontierRedirect && (
            <div className="flex items-start gap-1.5 rounded border border-[var(--iw-semantic-status-warning)]/50 bg-[var(--iw-color-paper)] px-2.5 py-2 text-[11px] text-[var(--iw-semantic-text-primary)]">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--iw-semantic-status-warning)]"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p>
                  <strong>Frontera contable — No registrar como activo fijo:</strong> {frontierRedirect.reason}
                </p>
                <p>
                  Módulo correcto:{" "}
                  <Link href={frontierRedirect.href} className="font-semibold underline">
                    {frontierRedirect.moduleLabel}
                  </Link>
                </p>
              </div>
            </div>
          )}

          {selectedItem && !compact && (
            <div className="space-y-1 text-[11px] text-[var(--iw-semantic-text-secondary)]">
              {selectedItem.evidence && (
                <p>
                  <strong className="text-[var(--iw-semantic-text-primary)]">Evidencia:</strong>{" "}
                  {selectedItem.evidence}
                </p>
              )}
              {selectedItem.noDuplicateWith && (
                <p>
                  <strong className="text-[var(--iw-semantic-text-primary)]">Evitar duplicación:</strong>{" "}
                  {selectedItem.noDuplicateWith}
                </p>
              )}
              {selectedItem.classificationNote && (
                <p>{selectedItem.classificationNote}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

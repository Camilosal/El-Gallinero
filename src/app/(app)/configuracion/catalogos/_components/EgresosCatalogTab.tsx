"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Select, StatCard, Table } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import {
  DRIVER_LABELS,
  STANDARD_EXPENSE_CATALOG,
  STANDARD_EXPENSE_FAMILIES,
  TREATMENT_LABELS,
  searchStandardExpenseCatalog,
  type ExpenseTreatmentType,
} from "@/lib/finance/standard-expense-catalog";

export default function EgresosCatalogTab() {
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [treatmentFilter, setTreatmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [aligning, setAligning] = useState(false);
  const [alignNotice, setAlignNotice] = useState("");

  const filtered = useMemo(
    () =>
      searchStandardExpenseCatalog(search, {
        family: familyFilter,
        treatment: treatmentFilter,
        priority: priorityFilter,
      }),
    [search, familyFilter, treatmentFilter, priorityFilter],
  );

  const p1Count = useMemo(
    () => STANDARD_EXPENSE_CATALOG.filter((item) => item.priority === "P1").length,
    [],
  );
  const opexCount = useMemo(
    () => STANDARD_EXPENSE_CATALOG.filter((item) => item.isOpex).length,
    [],
  );

  const runAlignment = async () => {
    setAligning(true);
    setAlignNotice("");
    try {
      const res = await apiFetch("/api/finanzas/alinear-egresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCatalogosList: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAlignNotice(data?.error || "No se pudo ejecutar la alineación de egresos.");
        return;
      }
      setAlignNotice(
        `Alineación completada: ${data?.updatedTransactions ?? 0} egresos históricos, ${data?.updatedBudgetItems ?? 0} partidas de presupuesto, ${data?.updatedPurchaseProducts ?? 0} productos frecuentes, ${data?.updatedAllocations ?? 0} prorrateos y ${data?.addedCatalogEntries ?? 0} familias añadidas a Listas Maestras.`,
      );
    } finally {
      setAligning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <StatCard icon="book-open" label="Conceptos estándar" value={String(STANDARD_EXPENSE_CATALOG.length)} color="green" />
        <StatCard icon="folder" label="Familias / centros" value={String(STANDARD_EXPENSE_FAMILIES.length)} color="blue" />
        <StatCard icon="tag" label="Prioridad P1" value={String(p1Count)} color="yellow" />
        <StatCard icon="bar-chart" label="Conceptos OPEX" value={String(opexCount)} color="purple" />
      </div>

      <Card>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[var(--iw-semantic-text-primary)]">
              Catálogo maestro de egresos no alimentarios (Catalogo Egresos.csv)
            </h3>
            <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)]">
              Estructura estándar por Familia / centro (01 a 26), Concepto individual (CST-001 a CST-303), tratamiento OPEX/No-OPEX, driver de costeo y controles anti-duplicación.
            </p>
            {alignNotice && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--iw-semantic-status-success)]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{alignNotice}</span>
              </p>
            )}
          </div>
          <Button onClick={runAlignment} disabled={aligning} className="shrink-0">
            <RefreshCw className={`mr-1.5 h-4 w-4 ${aligning ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{aligning ? "Alineando..." : "Alinear egresos y presupuestos de la finca"}</span>
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            label="Buscar código o concepto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: CST-090, vacuna, agua, luz..."
          />
          <Select label="Familia / centro" value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}>
            <option value="all">Todas las familias ({STANDARD_EXPENSE_FAMILIES.length})</option>
            {STANDARD_EXPENSE_FAMILIES.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} ({f.conceptsCount})
              </option>
            ))}
          </Select>
          <Select label="Tratamiento" value={treatmentFilter} onChange={(e) => setTreatmentFilter(e.target.value)}>
            <option value="all">Todos los tratamientos</option>
            {(Object.keys(TREATMENT_LABELS) as ExpenseTreatmentType[]).map((tr) => (
              <option key={tr} value={tr}>
                {tr} — {TREATMENT_LABELS[tr]}
              </option>
            ))}
          </Select>
          <Select label="Prioridad" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">Todas (P1 y P2)</option>
            <option value="P1">Solo P1 (esenciales)</option>
            <option value="P2">Solo P2 (complementarios)</option>
          </Select>
        </div>

        <p className="mb-3 text-xs text-[var(--iw-semantic-text-secondary)]">
          Mostrando <strong>{filtered.length}</strong> de {STANDARD_EXPENSE_CATALOG.length} conceptos estandarizados.
        </p>

        {filtered.length === 0 ? (
          <EmptyState icon="outgoing" message="No hay conceptos de egreso que coincidan con los filtros." />
        ) : (
          <Table headers={["Código", "Familia / centro", "Concepto individual", "Tratamiento", "Driver y unidad", "Control / no duplicar"]}>
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-[var(--iw-semantic-bg-subtle)]">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-[var(--iw-semantic-action-primary)]">
                    {item.id}
                  </span>
                  <div className="mt-1">
                    <Badge color={item.priority === "P1" ? "green" : "gray"}>{item.priority}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-[var(--iw-semantic-text-primary)]">
                  <div>{item.family}</div>
                  {item.isSharedProrationCandidate && (
                    <span className="mt-1 inline-block text-[10px] font-medium text-[var(--iw-semantic-status-warning)]">
                      Prorrateo compartido
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-[var(--iw-semantic-text-primary)]">
                  <div>{item.concept}</div>
                  {item.measurementEvidence && (
                    <div className="mt-0.5 text-[11px] font-normal text-[var(--iw-semantic-text-secondary)]">
                      Evidencia: {item.measurementEvidence}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <Badge color={item.isOpex ? "green" : "yellow"}>
                    {TREATMENT_LABELS[item.treatment]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--iw-semantic-text-secondary)]">
                  <div>{DRIVER_LABELS[item.driver]}</div>
                  <div className="text-[11px]">{item.costUnit}</div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--iw-semantic-text-secondary)] max-w-xs">
                  <div>{item.controlNote || "—"}</div>
                  {item.noDuplicateWith && (
                    <div className="mt-0.5 text-[11px] font-medium text-[var(--iw-semantic-text-primary)]">
                      {item.noDuplicateWith}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

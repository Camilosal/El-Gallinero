"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Select, StatCard, Table } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import {
  CAPEX_CLASSIFICATION_LABELS,
  CAPEX_DESTINATIONS,
  CAPEX_DESTINATION_LABELS,
  STANDARD_CAPEX_CATALOG,
  STANDARD_CAPEX_FAMILIES,
  capexPriorityBadgeColor,
  searchStandardCapexCatalog,
  type CapexClassificationType,
  type CapexDestinationType,
} from "@/lib/finance/standard-capex-catalog";

export default function CapexCatalogTab() {
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [subfamilyFilter, setSubfamilyFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [aligning, setAligning] = useState(false);
  const [alignNotice, setAlignNotice] = useState("");

  const subfamilies = useMemo(() => {
    const source =
      familyFilter === "all"
        ? STANDARD_CAPEX_CATALOG
        : STANDARD_CAPEX_CATALOG.filter((item) => item.family === familyFilter);
    return Array.from(new Set(source.map((i) => i.subfamily))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );
  }, [familyFilter]);

  const filtered = useMemo(
    () =>
      searchStandardCapexCatalog(search, {
        family: familyFilter,
        subfamily: subfamilyFilter,
        classification: classificationFilter,
        destination: destinationFilter,
        priority: priorityFilter,
      }),
    [search, familyFilter, subfamilyFilter, classificationFilter, destinationFilter, priorityFilter],
  );

  const p1Count = useMemo(
    () => STANDARD_CAPEX_CATALOG.filter((item) => item.priority === "P1").length,
    [],
  );

  const capexCount = useMemo(
    () => STANDARD_CAPEX_CATALOG.filter((item) => item.isPhysicalOrIntangibleCapex).length,
    [],
  );

  const runAlignment = async () => {
    setAligning(true);
    setAlignNotice("");
    try {
      const res = await apiFetch("/api/operaciones/activos/alinear-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCatalogosList: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAlignNotice(data?.error || "No se pudo ejecutar la alineación de activos.");
        return;
      }
      setAlignNotice(
        `Alineación completada: ${data?.updatedAssets ?? 0} activos históricos enriquecidos y ${data?.addedCatalogEntries ?? 0} familias sincronizadas en Listas Maestras.`,
      );
    } finally {
      setAligning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <StatCard
          icon="book-open"
          label="Conceptos estándar"
          value={String(STANDARD_CAPEX_CATALOG.length)}
          color="green"
        />
        <StatCard
          icon="folder"
          label="Familias CapEx"
          value={String(STANDARD_CAPEX_FAMILIES.length)}
          color="blue"
        />
        <StatCard icon="tag" label="Prioridad P1" value={String(p1Count)} color="yellow" />
        <StatCard
          icon="wrench"
          label="Activos / Intangibles"
          value={String(capexCount)}
          color="purple"
        />
      </div>

      <Card>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[var(--iw-semantic-text-primary)]">
              Catálogo maestro de CapEx, activos e inversiones (Catalogo Capex - Inversiones.csv)
            </h3>
            <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)]">
              Estructura jerárquica de 21 familias, 20 subfamilias y 242 conceptos (CAP-001 a CAP-242), con clasificación contable, destino productivo, vida útil sugerida, residual %, driver de reparto y fronteras anti-duplicación.
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
            <span>{aligning ? "Alineando..." : "Alinear activos y listas de la finca"}</span>
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="md:col-span-2 lg:col-span-2">
            <Input
              label="Buscar código o activo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej: CAP-001, incubadora, terreno, panel solar..."
            />
          </div>
          <Select
            label="Familia"
            value={familyFilter}
            onChange={(e) => {
              setFamilyFilter(e.target.value);
              setSubfamilyFilter("all");
            }}
          >
            <option value="all">Todas ({STANDARD_CAPEX_FAMILIES.length})</option>
            {STANDARD_CAPEX_FAMILIES.map((f) => (
              <option key={f.code} value={f.name}>
                {f.name} ({f.conceptsCount})
              </option>
            ))}
          </Select>
          <Select
            label="Subfamilia"
            value={subfamilyFilter}
            onChange={(e) => setSubfamilyFilter(e.target.value)}
          >
            <option value="all">Todas ({subfamilies.length})</option>
            {subfamilies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            label="Clasificación"
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {(Object.keys(CAPEX_CLASSIFICATION_LABELS) as CapexClassificationType[]).map((cls) => (
              <option key={cls} value={cls}>
                {CAPEX_CLASSIFICATION_LABELS[cls]}
              </option>
            ))}
          </Select>
          <Select
            label="Destino / Prioridad"
            value={`${destinationFilter}::${priorityFilter}`}
            onChange={(e) => {
              const [dest, prio] = e.target.value.split("::");
              setDestinationFilter(dest || "all");
              setPriorityFilter(prio || "all");
            }}
          >
            <option value="all::all">Todos los destinos</option>
            {CAPEX_DESTINATIONS.map((d: CapexDestinationType) => (
              <option key={d} value={`${d}::all`}>
                Destino: {CAPEX_DESTINATION_LABELS[d]}
              </option>
            ))}
            <option value="all::P1">Solo Prioridad P1</option>
            <option value="all::P2">Solo Prioridad P2</option>
            <option value="all::P3">Solo Prioridad P3</option>
          </Select>
        </div>

        <p className="mb-3 text-xs text-[var(--iw-semantic-text-secondary)]">
          Mostrando <strong>{filtered.length}</strong> de {STANDARD_CAPEX_CATALOG.length} conceptos estandarizados.
        </p>

        {filtered.length === 0 ? (
          <EmptyState icon="wrench" message="No hay conceptos de CapEx que coincidan con los filtros." />
        ) : (
          <Table
            headers={[
              "Código",
              "Familia / Subfamilia",
              "Concepto / Activo",
              "Clasificación / Destino",
              "Vida útil / Residual",
              "Driver y control",
            ]}
          >
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-[var(--iw-semantic-bg-subtle)]">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-[var(--iw-semantic-action-primary)]">
                    {item.id}
                  </span>
                  <div className="mt-1">
                    <Badge color={capexPriorityBadgeColor(item.priority)}>{item.priority}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-semibold text-[var(--iw-semantic-text-primary)]">{item.family}</div>
                  <div className="mt-0.5 text-[var(--iw-semantic-text-secondary)]">{item.subfamily}</div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-[var(--iw-semantic-text-primary)]">
                  <div>{item.concept}</div>
                  {item.evidence && (
                    <div className="mt-0.5 text-[11px] font-normal text-[var(--iw-semantic-text-secondary)]">
                      Evidencia: {item.evidence}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <Badge
                    color={
                      item.isFrontierExclusion
                        ? "yellow"
                        : item.isNonDepreciableLand
                        ? "blue"
                        : "green"
                    }
                  >
                    {CAPEX_CLASSIFICATION_LABELS[item.classification]}
                  </Badge>
                  <div className="mt-1 text-[11px] text-[var(--iw-semantic-text-secondary)]">
                    Destino: {item.destination}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--iw-semantic-text-secondary)]">
                  <div className="font-medium text-[var(--iw-semantic-text-primary)]">
                    {item.isNonDepreciableLand
                      ? "No depreciable (0 m)"
                      : item.isFrontierExclusion
                      ? "No CapEx (0 m)"
                      : `${item.suggestedLifeMonths} meses`}
                  </div>
                  <div className="text-[11px]">
                    Residual: {Math.round(item.suggestedResidualRate * 100)}%
                  </div>
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-[var(--iw-semantic-text-secondary)]">
                  <div className="font-medium text-[var(--iw-semantic-text-primary)]">
                    Driver: {item.driver}
                  </div>
                  <div className="mt-0.5">{item.noDuplicateWith || item.classificationNote || "—"}</div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Image as ImageIcon, Pencil, Search, ShieldAlert, Tag, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { Badge, Button, Modal } from "@/components/ui";
import { SPECIES_LABELS, type FeedingSpecies } from "@/lib/species";
import {
  FEED_SPECIES_SELECTOR_OPTIONS,
  inferDefaultImageByFeed,
  inferDefaultSpeciesByFeed,
  normalizeFeedSpeciesList,
  normalizeRegionalNamesList,
} from "@/lib/feeding/feed-catalog-metadata";
import {
  STANDARD_FEED_CATALOG,
  findStandardFeedById,
  searchStandardFeedCatalog,
  type StandardFeedItem,
} from "@/lib/feeding/standard-feed-catalog";
import { FEED_CATALOG_GROUPS, feedCategoryLabel, feedTypeLabel } from "@/lib/feed-classification";
import { matchesTextQuery } from "@/lib/text";

export interface FeedFichaRecord {
  id?: string;
  name: string;
  category?: string | null;
  feedType?: string | null;
  catalogGroup?: string | null;
  standardCatalogId?: string | null;
  sanitaryStatus?: string | null;
  unit?: string | null;
  currentStock?: string | number | null;
  minStock?: string | number | null;
  costPerUnit?: string | number | null;
  supplier?: string | null;
  daysRemaining?: number | null;
  dryMatterPct?: string | number | null;
  crudeProteinPct?: string | number | null;
  crudeProteinDmPct?: string | number | null;
  energyKcalKgDm?: string | number | null;
  calciumDmPct?: string | number | null;
  availablePhosphorusDmPct?: string | number | null;
  lysineDigDmPct?: string | number | null;
  metCysDigDmPct?: string | number | null;
  crudeFiberDmPct?: string | number | null;
  allowedSpecies?: string[] | null;
  imageUrl?: string | null;
  description?: string | null;
  regionalNames?: string[] | null;
  botanicalName?: string | null;
  presentation?: string | null;
  preparation?: string | null;
  risks?: string | null;
  sourceUrl?: string | null;
  nutritionProfile?: Record<string, unknown> | null;
}

const SPECIES_ICON_MAP: Record<FeedingSpecies, string> = {
  gallina: "hen",
  gallo: "rooster",
  pollo: "rooster",
  codorniz: "egg",
  pato: "duck",
  conejo: "rabbit",
  cuy: "rabbit",
};

export function SpeciesTagList({
  species,
  compact = false,
}: {
  species: ReadonlyArray<string> | null | undefined;
  compact?: boolean;
}) {
  const normalized = normalizeFeedSpeciesList(species ?? []);
  if (normalized.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--iw-semantic-text-secondary)]">
        General / Todas
      </span>
    );
  }
  const visible = compact ? normalized.slice(0, 3) : normalized;
  const remaining = compact ? normalized.length - visible.length : 0;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((sp) => {
        const label = SPECIES_LABELS[sp]?.plural ?? sp;
        const formatted = label.charAt(0).toUpperCase() + label.slice(1);
        return (
          <span
            key={sp}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] px-2 py-0.5 text-[11px] font-semibold text-[var(--iw-semantic-action-primary)]"
          >
            <AppIcon icon={SPECIES_ICON_MAP[sp]} className="h-3 w-3 shrink-0" />
            <span>{formatted}</span>
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--iw-semantic-text-secondary)]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export function FeedFichaModal({
  open,
  onClose,
  feed,
  canSeeFinancials = true,
  onEdit,
  onUseFeed,
  useFeedLabel = "Usar este alimento",
}: {
  open: boolean;
  onClose: () => void;
  feed: FeedFichaRecord | null;
  canSeeFinancials?: boolean;
  onEdit?: (feed: FeedFichaRecord) => void;
  onUseFeed?: (feed: FeedFichaRecord) => void;
  useFeedLabel?: string;
}) {
  if (!feed) return null;

  const std = findStandardFeedById(feed.standardCatalogId);
  const profile = (feed.nutritionProfile ?? {}) as Record<string, unknown>;
  const resolvedGroup = feed.catalogGroup || (profile.group as string | undefined) || std?.group || null;
  const resolvedSpecies =
    normalizeFeedSpeciesList(feed.allowedSpecies).length > 0
      ? normalizeFeedSpeciesList(feed.allowedSpecies)
      : std?.targetSpecies ??
        inferDefaultSpeciesByFeed({
          standardCatalogId: feed.standardCatalogId,
          group: resolvedGroup,
          feedType: feed.feedType,
          name: feed.name,
          sanitaryStatus: feed.sanitaryStatus ?? std?.sanitaryStatus,
        });
  const resolvedRegional =
    normalizeRegionalNamesList(feed.regionalNames).length > 0
      ? normalizeRegionalNamesList(feed.regionalNames)
      : std?.regionalNames ?? [];
  const resolvedDescription =
    (typeof feed.description === "string" && feed.description.trim()) ||
    std?.description ||
    (profile.compositionNotes as string | undefined) ||
    "Ficha de alimento de inventario. Completa la descripción y etiqueta nutricional para mejorar las recomendaciones.";
  const resolvedImage =
    (typeof feed.imageUrl === "string" && feed.imageUrl.trim()) ||
    std?.imageUrl ||
    inferDefaultImageByFeed({
      standardCatalogId: feed.standardCatalogId,
      group: resolvedGroup,
      feedType: feed.feedType,
      name: feed.name,
    });
  const preparation =
    feed.preparation || (profile.preparation as string | undefined) || std?.preparation || null;
  const risks = feed.risks || (profile.risks as string | undefined) || std?.risks || null;
  const botanicalName =
    feed.botanicalName || (profile.botanicalName as string | undefined) || std?.botanicalName || null;
  const presentation =
    feed.presentation || (profile.presentation as string | undefined) || std?.presentation || null;
  const sourceUrl =
    feed.sourceUrl || (profile.sourceUrl as string | undefined) || std?.sourceUrl || null;
  const sanitaryStatus = feed.sanitaryStatus || std?.sanitaryStatus || null;

  const dmPct = feed.dryMatterPct != null && feed.dryMatterPct !== "" ? Number(feed.dryMatterPct) : std?.dryMatterPct ?? null;
  const pbAsFed =
    feed.crudeProteinPct != null && feed.crudeProteinPct !== ""
      ? Number(feed.crudeProteinPct)
      : std?.crudeProteinAsFedPct ?? null;
  const pbDm =
    feed.crudeProteinDmPct != null && feed.crudeProteinDmPct !== ""
      ? Number(feed.crudeProteinDmPct)
      : pbAsFed != null && dmPct && dmPct > 0
        ? Math.round((pbAsFed / dmPct) * 1000) / 10
        : std?.crudeProteinDmPct ?? null;
  const energy = feed.energyKcalKgDm != null && feed.energyKcalKgDm !== "" ? Number(feed.energyKcalKgDm) : std?.energyKcalKgDm ?? null;
  const ca = feed.calciumDmPct != null && feed.calciumDmPct !== "" ? Number(feed.calciumDmPct) : std?.calciumDmPct ?? null;
  const phos =
    feed.availablePhosphorusDmPct != null && feed.availablePhosphorusDmPct !== ""
      ? Number(feed.availablePhosphorusDmPct)
      : std?.availablePhosphorusDmPct ?? null;
  const fiber =
    feed.crudeFiberDmPct != null && feed.crudeFiberDmPct !== ""
      ? Number(feed.crudeFiberDmPct)
      : std?.crudeFiberDmPct ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={feed.name}
      subtitle={[
        feed.standardCatalogId ? `Código ${feed.standardCatalogId}` : null,
        resolvedGroup,
        feed.category ? feedCategoryLabel(feed.category) : null,
        feed.feedType ? feedTypeLabel(feed.feedType) : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      size="lg"
    >
      <div className="space-y-5">
        {/* Cabecera visual: imagen + datos generales */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImage}
              alt={feed.name}
              className="h-40 w-full object-cover sm:h-full sm:min-h-[156px]"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {feed.standardCatalogId && (
                <Badge color="blue">{feed.standardCatalogId}</Badge>
              )}
              {sanitaryStatus === "NO USAR" ? (
                <Badge color="red">NO USAR</Badge>
              ) : sanitaryStatus === "RESTRINGIDO" ? (
                <Badge color="yellow">RESTRINGIDO</Badge>
              ) : sanitaryStatus ? (
                <Badge color="green">{sanitaryStatus}</Badge>
              ) : null}
              {presentation && (
                <span className="rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2.5 py-0.5 text-[11px] text-[var(--iw-semantic-text-secondary)]">
                  Presentación: {presentation}
                </span>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]">
                Para qué animales aplica
              </p>
              {sanitaryStatus === "NO USAR" ? (
                <p className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-semantic-bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--iw-semantic-status-danger)]">
                  <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Bloqueado para todas las especies</span>
                </p>
              ) : (
                <SpeciesTagList species={resolvedSpecies} />
              )}
            </div>

            {resolvedRegional.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]">
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  <span>Nombres en otras regiones / sinónimos</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resolvedRegional.map((alias) => (
                    <span
                      key={alias}
                      className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-color-paper)] px-2 py-0.5 text-xs font-medium text-[var(--iw-semantic-text-primary)]"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {botanicalName && botanicalName !== "Desconocido" && (
              <p className="text-xs text-[var(--iw-semantic-text-secondary)]">
                <strong>Origen / nombre técnico:</strong> <em>{botanicalName}</em>
              </p>
            )}
          </div>
        </div>

        {/* Descripción */}
        <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3.5 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--iw-semantic-text-primary)]">
            Descripción e identificación en granja
          </h3>
          <p className="text-sm leading-relaxed text-[var(--iw-semantic-text-primary)]">
            {resolvedDescription}
          </p>
          {preparation && (
            <p className="text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)]">
              <strong className="text-[var(--iw-semantic-text-primary)]">Preparación y validación:</strong> {preparation}
            </p>
          )}
          {risks && (
            <p className="flex items-start gap-1.5 rounded-lg border border-[var(--iw-semantic-status-warning)]/35 bg-[var(--iw-color-paper)] px-2.5 py-2 text-xs text-[var(--iw-semantic-text-primary)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-status-warning)]" aria-hidden="true" />
              <span><strong>Precauciones:</strong> {risks}</span>
            </p>
          )}
        </div>

        {/* Bodega / Stock (cuando existe en inventario) */}
        {feed.currentStock !== undefined && feed.currentStock !== null && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
              <p className="text-[11px] font-semibold text-[var(--iw-semantic-text-secondary)]">Stock actual</p>
              <p className="mt-0.5 text-base font-bold text-[var(--iw-semantic-text-primary)] tabular-nums">
                {Number(feed.currentStock).toFixed(1)} {feed.unit || "kg"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
              <p className="text-[11px] font-semibold text-[var(--iw-semantic-text-secondary)]">Stock mínimo</p>
              <p className="mt-0.5 text-base font-bold text-[var(--iw-semantic-text-primary)] tabular-nums">
                {Number(feed.minStock ?? 0).toFixed(1)} {feed.unit || "kg"}
              </p>
            </div>
            {feed.daysRemaining !== undefined && (
              <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
                <p className="text-[11px] font-semibold text-[var(--iw-semantic-text-secondary)]">Cobertura estimada</p>
                <p className="mt-0.5 text-base font-bold text-[var(--iw-semantic-action-primary)] tabular-nums">
                  {feed.daysRemaining !== null ? `${feed.daysRemaining} días` : "Sin consumo auto"}
                </p>
              </div>
            )}
            {canSeeFinancials && (
              <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-3">
                <p className="text-[11px] font-semibold text-[var(--iw-semantic-text-secondary)]">Costo unitario</p>
                <p className="mt-0.5 text-base font-bold text-[var(--iw-semantic-text-primary)] tabular-nums">
                  ${Number(feed.costPerUnit ?? 0).toLocaleString("es-CO")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Perfil nutricional */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]">
            Aporte nutricional (base seca % MS)
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Materia Seca", value: dmPct !== null ? `${dmPct}%` : "—" },
              { label: "Proteína (MS)", value: pbDm !== null ? `${pbDm}%` : pbAsFed !== null ? `${pbAsFed}% tal cual` : "—" },
              { label: "Energía EM", value: energy !== null ? `${energy} kcal` : "—" },
              { label: "Calcio", value: ca !== null ? `${ca}%` : "—" },
              { label: "Fósforo disp.", value: phos !== null ? `${phos}%` : "—" },
              { label: "Fibra bruta", value: fiber !== null ? `${fiber}%` : "—" },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-2.5 text-center"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">
                  {metric.label}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--iw-semantic-text-primary)] tabular-nums">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--iw-semantic-border-default)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--iw-semantic-action-primary)] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Fuente técnica de referencia</span>
              </a>
            )}
            {canSeeFinancials && feed.supplier && (
              <span className="text-xs text-[var(--iw-semantic-text-secondary)]">
                Proveedor: <strong className="text-[var(--iw-semantic-text-primary)]">{feed.supplier}</strong>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {onEdit && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  onEdit(feed);
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Editar ficha
              </Button>
            )}
            {onUseFeed && sanitaryStatus !== "NO USAR" && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onUseFeed(feed);
                }}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {useFeedLabel}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Explorador visual completo de alimentos: combina inventario propio + base estandarizada IG-001..IG-126,
 * búsqueda directa por nombre/alias regional y filtros por especie animal.
 */
export function FeedCatalogExplorerModal({
  open,
  onClose,
  feeds = [],
  canSeeFinancials = true,
  initialSpecies = "all",
  onInspectFeed,
  onAddStandardFeed,
}: {
  open: boolean;
  onClose: () => void;
  feeds?: FeedFichaRecord[];
  canSeeFinancials?: boolean;
  initialSpecies?: string;
  onInspectFeed: (feed: FeedFichaRecord) => void;
  onAddStandardFeed?: (item: StandardFeedItem) => void;
}) {
  const [sourceMode, setSourceMode] = useState<"inventario" | "estandar">("inventario");
  const [query, setQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<string>(initialSpecies || "all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const filteredInventory = useMemo(() => {
    return feeds.filter((feed) => {
      const speciesList = normalizeFeedSpeciesList(feed.allowedSpecies);
      if (speciesFilter !== "all" && speciesList.length > 0 && !speciesList.includes(speciesFilter as FeedingSpecies)) {
        return false;
      }
      const group = feed.catalogGroup || findStandardFeedById(feed.standardCatalogId)?.group || "";
      if (groupFilter !== "all" && group !== groupFilter) return false;
      if (!query.trim()) return true;
      return matchesTextQuery(query, [
        feed.name,
        feed.standardCatalogId,
        group,
        feed.category,
        feed.feedType,
        feed.description,
        (feed.regionalNames ?? []).join(" "),
        speciesList.join(" "),
        canSeeFinancials ? feed.supplier : "",
      ]);
    });
  }, [feeds, query, speciesFilter, groupFilter, canSeeFinancials]);

  const filteredStandard = useMemo(
    () =>
      searchStandardFeedCatalog(query, {
        group: groupFilter,
        species: speciesFilter,
        includeBlocked: true,
      }),
    [query, groupFilter, speciesFilter],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Explorador visual y fichas de alimentos"
      subtitle="Busca directamente por nombre comercial, sinónimo regional o elige para qué animales aplica"
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSourceMode("inventario")}
            className={`min-h-[40px] rounded-[var(--iw-radius-control)] border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              sourceMode === "inventario"
                ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
            }`}
          >
            Mi bodega / inventario ({feeds.length})
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("estandar")}
            className={`min-h-[40px] rounded-[var(--iw-radius-control)] border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              sourceMode === "estandar"
                ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
            }`}
          >
            Catálogo estándar de referencia ({STANDARD_FEED_CATALOG.length})
          </button>
        </div>

        {/* Buscador directo + botón de búsqueda explícito */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar alimento o nombre regional (ej: cuido, cuy, zapallo, chonque, IG-125)..."
              aria-label="Buscar alimento por nombre o alias regional"
              className="min-h-[44px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] py-2 pl-9 pr-9 text-sm text-[var(--iw-semantic-text-primary)] outline-none focus:border-[var(--iw-semantic-focus-ring)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda de alimento"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--iw-semantic-text-secondary)] hover:bg-[var(--iw-semantic-bg-subtle)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            aria-label="Filtrar por grupo"
            className="min-h-[44px] rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--iw-semantic-text-primary)]"
          >
            <option value="all">Todos los grupos</option>
            {FEED_CATALOG_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <Button type="submit" className="min-h-[44px] shrink-0">
            <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Buscar alimento
          </Button>
        </form>

        {/* Chips por especie */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSpeciesFilter("all")}
            className={`min-h-[34px] rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              speciesFilter === "all"
                ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
            }`}
          >
            Todos los animales
          </button>
          {FEED_SPECIES_SELECTOR_OPTIONS.map((sp) => (
            <button
              key={sp.value}
              type="button"
              onClick={() => setSpeciesFilter(sp.value)}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                speciesFilter === sp.value
                  ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                  : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
              }`}
            >
              <AppIcon icon={SPECIES_ICON_MAP[sp.value]} className="h-3.5 w-3.5" />
              <span>{sp.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Grilla de tarjetas con imagen, descripción y nombres regionales */}
        {sourceMode === "inventario" ? (
          filteredInventory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--iw-semantic-border-default)] p-8 text-center text-sm text-[var(--iw-semantic-text-secondary)]">
              No se encontraron alimentos en tu inventario con esos filtros. Cambia a &ldquo;Catálogo estándar&rdquo; para explorar {STANDARD_FEED_CATALOG.length} ingredientes base.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredInventory.map((feed, idx) => {
                const thumb =
                  feed.imageUrl ||
                  inferDefaultImageByFeed({
                    standardCatalogId: feed.standardCatalogId,
                    group: feed.catalogGroup,
                    feedType: feed.feedType,
                    name: feed.name,
                  });
                const regional = normalizeRegionalNamesList(feed.regionalNames);
                return (
                  <article
                    key={feed.id || `${feed.name}-${idx}`}
                    className="flex flex-col overflow-hidden rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-2xs"
                  >
                    <div className="relative h-28 w-full border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={feed.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--iw-semantic-text-secondary)]">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                      {feed.standardCatalogId && (
                        <span className="absolute left-2 top-2 rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]/95 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--iw-semantic-text-primary)]">
                          {feed.standardCatalogId}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-3 space-y-2.5">
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-[var(--iw-semantic-text-primary)] leading-snug">
                          {feed.name}
                        </h4>
                        <SpeciesTagList species={feed.allowedSpecies} compact />
                        {regional.length > 0 && (
                          <p className="text-[11px] text-[var(--iw-semantic-text-secondary)] line-clamp-1">
                            <strong>También:</strong> {regional.join(" · ")}
                          </p>
                        )}
                        <p className="text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)] line-clamp-2">
                          {feed.description || feedTypeLabel(feed.feedType || "")}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-[var(--iw-semantic-border-default)] pt-2">
                        <span className="text-xs font-semibold text-[var(--iw-semantic-text-primary)] tabular-nums">
                          {feed.currentStock !== undefined && feed.currentStock !== null
                            ? `${Number(feed.currentStock).toFixed(1)} ${feed.unit || "kg"}`
                            : feed.unit || "kg"}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onInspectFeed(feed)}
                          className="min-h-[36px] px-3 py-1 text-xs"
                        >
                          Ver ficha
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : filteredStandard.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--iw-semantic-border-default)] p-8 text-center text-sm text-[var(--iw-semantic-text-secondary)]">
            No encontramos ingredientes en el catálogo estándar para esa búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStandard.map((item) => (
              <article
                key={item.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-2xs"
              >
                <div className="relative h-28 w-full border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]/95 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--iw-semantic-text-primary)]">
                    {item.id}
                  </span>
                  {item.sanitaryStatus !== "CONDICIONAL" && (
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.isBlocked
                          ? "bg-[var(--iw-semantic-status-danger)] text-white"
                          : "bg-[var(--iw-semantic-status-warning)] text-white"
                      }`}
                    >
                      {item.sanitaryStatus}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between p-3 space-y-2.5">
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-[var(--iw-semantic-text-primary)] leading-snug">
                      {item.name}
                    </h4>
                    <SpeciesTagList species={item.targetSpecies} compact />
                    {item.regionalNames.length > 0 && (
                      <p className="text-[11px] text-[var(--iw-semantic-text-secondary)] line-clamp-1">
                        <strong>Regiones:</strong> {item.regionalNames.join(" · ")}
                      </p>
                    )}
                    <p className="text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)] line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--iw-semantic-border-default)] pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onInspectFeed({
                          name: item.name,
                          category: item.defaultCategory,
                          feedType: item.defaultFeedType,
                          catalogGroup: item.group,
                          standardCatalogId: item.id,
                          sanitaryStatus: item.sanitaryStatus,
                          dryMatterPct: item.dryMatterPct,
                          crudeProteinPct: item.crudeProteinAsFedPct,
                          crudeProteinDmPct: item.crudeProteinDmPct,
                          energyKcalKgDm: item.energyKcalKgDm,
                          calciumDmPct: item.calciumDmPct,
                          availablePhosphorusDmPct: item.availablePhosphorusDmPct,
                          lysineDigDmPct: item.lysineDigDmPct,
                          metCysDigDmPct: item.metCysDigDmPct,
                          crudeFiberDmPct: item.crudeFiberDmPct,
                          allowedSpecies: item.targetSpecies,
                          regionalNames: item.regionalNames,
                          description: item.description,
                          imageUrl: item.imageUrl,
                          botanicalName: item.botanicalName,
                          presentation: item.presentation,
                          preparation: item.preparation,
                          risks: item.risks,
                          sourceUrl: item.sourceUrl,
                        })
                      }
                      className="min-h-[36px] px-3 py-1 text-xs"
                    >
                      Ver ficha
                    </Button>
                    {onAddStandardFeed && !item.isBlocked && (
                      <Button
                        type="button"
                        onClick={() => {
                          onClose();
                          onAddStandardFeed(item);
                        }}
                        className="min-h-[36px] px-3 py-1 text-xs"
                      >
                        Agregar
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

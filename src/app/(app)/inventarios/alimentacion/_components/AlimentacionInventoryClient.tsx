"use client";

import { useState } from "react";
import { BookOpen, Search, Settings, ShoppingCart, Sprout, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { Badge, Button, EmptyState, Table } from "@/components/ui";
import {
  feedCategoryLabel,
  feedTypeLabel,
  isFreshFeedCategory,
  isPurchasedFeedCategory,
} from "@/lib/feed-classification";
import { matchesTextQuery } from "@/lib/text";
import {
  FEED_SPECIES_SELECTOR_OPTIONS,
  inferDefaultImageByFeed,
  normalizeFeedSpeciesList,
  normalizeRegionalNamesList,
} from "@/lib/feeding/feed-catalog-metadata";
import type { FeedingSpecies } from "@/lib/species";
import {
  FeedCatalogExplorerModal,
  FeedFichaModal,
  SpeciesTagList,
  type FeedFichaRecord,
} from "@/components/feeding/FeedFichaModal";

export interface FeedInventoryRow {
  id: string;
  name: string;
  category: string;
  feedType?: string | null;
  catalogGroup?: string | null;
  standardCatalogId?: string | null;
  sanitaryStatus?: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  daysRemaining: number | null;
  costPerUnit: number | null;
  estimatedValue: number | null;
  supplier?: string | null;
  dryMatterPct?: string | null;
  crudeProteinPct?: string | null;
  energyKcalKgDm?: string | null;
  calciumDmPct?: string | null;
  availablePhosphorusDmPct?: string | null;
  crudeFiberDmPct?: string | null;
  nutritionProfile?: Record<string, unknown> | null;
  allowedSpecies?: string[] | null;
  imageUrl?: string | null;
  description?: string | null;
  regionalNames?: string[] | null;
  isLow: boolean;
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

export function AlimentacionInventoryClient({
  items,
  initialQuery = "",
  canSeeFinancials,
}: {
  items: FeedInventoryRow[];
  initialQuery?: string;
  canSeeFinancials: boolean;
}) {
  const [search, setSearch] = useState(initialQuery);
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [selectedFicha, setSelectedFicha] = useState<FeedFichaRecord | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);

  const filtered = items.filter((f) => {
    const spList = normalizeFeedSpeciesList(f.allowedSpecies);
    if (speciesFilter !== "all" && spList.length > 0 && !spList.includes(speciesFilter as FeedingSpecies)) {
      return false;
    }
    if (!search.trim()) return true;
    return matchesTextQuery(search, [
      f.name,
      f.category,
      feedCategoryLabel(f.category),
      f.feedType ? feedTypeLabel(f.feedType) : "",
      f.catalogGroup,
      f.standardCatalogId,
      f.description,
      normalizeRegionalNamesList(f.regionalNames).join(" "),
      spList.join(" "),
      isPurchasedFeedCategory(f.category)
        ? "suplementario comprado concentrado"
        : isFreshFeedCategory(f.category)
          ? "granja fresco"
          : "procesado preparados",
      f.unit,
      f.currentStock,
      f.minStock,
      f.costPerUnit,
      f.daysRemaining,
      f.isLow ? "stock bajo" : "",
    ]);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar alimento, código IG, sinónimo regional o animal..."
              aria-label="Buscar alimento"
              className="min-h-[42px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] py-2 pl-9 pr-9 text-sm text-[var(--iw-semantic-text-primary)] outline-none focus:border-[var(--iw-semantic-focus-ring)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--iw-semantic-text-secondary)] hover:bg-[var(--iw-semantic-bg-subtle)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <Button type="submit" className="min-h-[42px] shrink-0">
            <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Buscar alimento
          </Button>
          {(search.trim() || speciesFilter !== "all") && (
            <span className="text-xs text-[var(--iw-semantic-text-secondary)] tabular-nums">
              {filtered.length} de {items.length} alimentos
            </span>
          )}
        </form>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setExplorerOpen(true)}
          className="min-h-[42px] shrink-0"
        >
          <BookOpen className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Explorar fichas
        </Button>
      </div>

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

      {filtered.length === 0 ? (
        <EmptyState
          icon="wheat"
          message={
            search.trim() || speciesFilter !== "all"
              ? "No hay alimentos que coincidan con la búsqueda"
              : "No hay alimentos registrados"
          }
        />
      ) : (
        <Table
          headers={[
            "Alimento y ficha",
            "Para qué animales",
            "Categoría",
            "Stock",
            "Mínimo",
            "Días Rest.",
            ...(canSeeFinancials ? ["Costo/Unidad", "Valor Estimado"] : []),
            "Ficha",
          ]}
        >
          {filtered.map((f) => {
            const thumb =
              f.imageUrl ||
              inferDefaultImageByFeed({
                standardCatalogId: f.standardCatalogId,
                group: f.catalogGroup,
                feedType: f.feedType,
                name: f.name,
              });
            const regional = normalizeRegionalNamesList(f.regionalNames);
            return (
              <tr key={f.id} className={f.isLow ? "bg-red-50" : "hover:bg-slate-50"}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedFicha(f)}
                    className="flex items-start gap-2.5 text-left group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={f.name}
                      className="h-11 w-14 shrink-0 rounded-lg border border-[var(--iw-semantic-border-default)] object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[var(--iw-semantic-text-primary)] group-hover:text-[var(--iw-semantic-action-primary)] group-hover:underline">
                        {f.name}
                      </span>
                      {(f.standardCatalogId || regional.length > 0) && (
                        <span className="mt-0.5 block text-[11px] text-[var(--iw-semantic-text-secondary)]">
                          {f.standardCatalogId ? `${f.standardCatalogId} · ` : ""}
                          {regional.slice(0, 3).join(", ")}
                        </span>
                      )}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <SpeciesTagList species={f.allowedSpecies} compact />
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge
                    color={
                      isPurchasedFeedCategory(f.category)
                        ? "blue"
                        : isFreshFeedCategory(f.category)
                          ? "green"
                          : "purple"
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {isPurchasedFeedCategory(f.category) ? (
                        <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : isFreshFeedCategory(f.category) ? (
                        <Sprout className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>{feedCategoryLabel(f.category)}</span>
                    </span>
                  </Badge>
                </td>
                <td className="px-4 py-3 font-semibold">
                  {Number(f.currentStock).toFixed(2)} {f.unit}
                </td>
                <td className="px-4 py-3 text-sm">
                  {Number(f.minStock).toFixed(2)} {f.unit}
                </td>
                <td className="px-4 py-3">
                  {f.daysRemaining !== null ? (
                    <Badge
                      color={
                        f.daysRemaining <= 7
                          ? "red"
                          : f.daysRemaining <= 14
                            ? "yellow"
                            : "green"
                      }
                    >
                      {f.daysRemaining} días
                    </Badge>
                  ) : (
                    <span className="text-slate-400">∞</span>
                  )}
                </td>
                {canSeeFinancials && (
                  <td className="px-4 py-3">${Number(f.costPerUnit ?? 0).toLocaleString()}</td>
                )}
                {canSeeFinancials && (
                  <td className="px-4 py-3 font-semibold text-blue-600">
                    ${Math.round(f.estimatedValue ?? 0).toLocaleString()}
                  </td>
                )}
                <td className="px-4 py-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedFicha(f)}
                    className="min-h-[36px] px-3 py-1 text-xs"
                  >
                    Ver ficha
                  </Button>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <FeedFichaModal
        open={Boolean(selectedFicha)}
        onClose={() => setSelectedFicha(null)}
        feed={selectedFicha}
        canSeeFinancials={canSeeFinancials}
      />

      <FeedCatalogExplorerModal
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        feeds={items}
        canSeeFinancials={canSeeFinancials}
        initialSpecies={speciesFilter}
        onInspectFeed={(feed) => setSelectedFicha(feed)}
      />
    </div>
  );
}


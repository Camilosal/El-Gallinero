"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { Button, Modal, Tooltip } from "@/components/ui";
import { matchesTextQuery } from "@/lib/text";
import { SPECIES_LABELS, type FeedingSpecies } from "@/lib/species";
import {
  FEED_SPECIES_SELECTOR_OPTIONS,
  inferDefaultImageByFeed,
  isFeedCompatibleWithSpecies,
  normalizeFeedSpeciesList,
  normalizeRegionalNamesList,
} from "@/lib/feeding/feed-catalog-metadata";
import { SpeciesTagList, type FeedFichaRecord } from "@/components/feeding/FeedFichaModal";

export interface SelectableFeedItem extends FeedFichaRecord {
  id: string;
  name: string;
  unit: string;
  currentStock?: string | number | null;
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

/**
 * Comprime una imagen elegida por el productor en celular o PC para que funcione offline
 * y pese menos de ~120 KB al guardarse en la ficha del alimento.
 */
export async function compressFeedImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen (JPG, PNG o WebP).");
  }
  const readerUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/svg+xml" || readerUrl.length <= 90_000) {
    return readerUrl;
  }

  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 480;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || maxDim) * scale));
      const h = Math.max(1, Math.round((img.height || maxDim) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(readerUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const webp = canvas.toDataURL("image/webp", 0.78);
      if (webp.startsWith("data:image/webp") && webp.length < 280_000) {
        resolve(webp);
        return;
      }
      resolve(canvas.toDataURL("image/jpeg", 0.76));
    };
    img.onerror = () => resolve(readerUrl);
    img.src = readerUrl;
  });
}

/**
 * Selector de alimento con lista tradicional + botón directo "Buscar alimento" que abre
 * búsqueda por nombre comercial, sinónimo regional, código IG o filtro por animal.
 */
export function FeedSearchPicker({
  label = "Alimento",
  help,
  value,
  feeds,
  targetSpecies,
  onChange,
  onInspectFeed,
  compact = false,
  allowEmpty = true,
  emptyLabel = "Selecciona un alimento...",
}: {
  label?: string;
  help?: string;
  value: string;
  feeds: SelectableFeedItem[];
  targetSpecies?: FeedingSpecies | null;
  onChange: (feedId: string) => void;
  onInspectFeed?: (feed: SelectableFeedItem) => void;
  compact?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<string>(targetSpecies || "all");

  const selectedFeed = useMemo(
    () => feeds.find((f) => f.id === value) || null,
    [feeds, value],
  );

  const openModal = () => {
    setSpeciesFilter(targetSpecies || "all");
    setQuery("");
    setSearchOpen(true);
  };

  const results = useMemo(() => {
    return feeds.filter((feed) => {
      const speciesList = normalizeFeedSpeciesList(feed.allowedSpecies);
      if (speciesFilter !== "all" && speciesList.length > 0 && !speciesList.includes(speciesFilter as FeedingSpecies)) {
        return false;
      }
      if (!query.trim()) return true;
      return matchesTextQuery(query, [
        feed.name,
        feed.standardCatalogId,
        feed.catalogGroup,
        feed.category,
        feed.feedType,
        feed.description,
        normalizeRegionalNamesList(feed.regionalNames).join(" "),
        speciesList.join(" "),
      ]);
    });
  }, [feeds, query, speciesFilter]);

  const incompatibleWithTarget = Boolean(
    targetSpecies &&
      selectedFeed &&
      normalizeFeedSpeciesList(selectedFeed.allowedSpecies).length > 0 &&
      !isFeedCompatibleWithSpecies(selectedFeed.allowedSpecies, targetSpecies),
  );

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <label className={compact ? "block text-xs font-medium text-slate-600" : "block text-xs font-semibold text-[var(--iw-semantic-text-primary)]"}>
              {label}
            </label>
            {help && <Tooltip text={help} />}
          </div>
          {onInspectFeed && selectedFeed && (
            <button
              type="button"
              onClick={() => onInspectFeed(selectedFeed)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--iw-semantic-action-primary)] hover:underline"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              Ver ficha
            </button>
          )}
        </div>
      )}

      <div className="flex items-stretch gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label || "Seleccionar alimento"}
          className={
            compact
              ? "min-h-[42px] w-full flex-1 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--iw-semantic-text-primary)]"
              : "min-h-[46px] w-full flex-1 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 text-sm text-[var(--iw-semantic-text-primary)]"
          }
        >
          {allowEmpty && <option value="">{emptyLabel}</option>}
          {feeds.map((f) => {
            const stockTxt =
              f.currentStock !== undefined && f.currentStock !== null
                ? ` (${Number(f.currentStock).toFixed(1)} ${f.unit} disp.)`
                : "";
            return (
              <option key={f.id} value={f.id}>
                {f.name}
                {stockTxt}
              </option>
            );
          })}
        </select>

        <Button
          type="button"
          variant="secondary"
          onClick={openModal}
          className={compact ? "min-h-[42px] shrink-0 px-2.5 text-xs" : "min-h-[46px] shrink-0 px-3 text-xs sm:text-sm"}
          title="Buscar alimento directamente por nombre, alias regional o animal"
        >
          <Search className="h-4 w-4 shrink-0 sm:mr-1.5" aria-hidden="true" />
          <span className={compact ? "hidden sm:inline" : ""}>Buscar alimento</span>
        </Button>
      </div>

      {incompatibleWithTarget && targetSpecies && selectedFeed && (
        <p className="text-[11px] font-medium text-[var(--iw-semantic-status-warning)]">
          Nota: <strong>{selectedFeed.name}</strong> está indicado para{" "}
          {normalizeFeedSpeciesList(selectedFeed.allowedSpecies)
            .map((sp) => SPECIES_LABELS[sp]?.plural || sp)
            .join(", ")}.
        </p>
      )}

      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Buscar alimento"
        subtitle="Encuentra rápido por nombre, código IG, alias regional o especie animal"
        size="lg"
      >
        <div className="space-y-4">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej: cuido ponedora, cuyina, ahuyama, zapallo, chonque, pasto..."
                className="min-h-[44px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] py-2 pl-9 pr-9 text-sm text-[var(--iw-semantic-text-primary)] outline-none focus:border-[var(--iw-semantic-focus-ring)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--iw-semantic-text-secondary)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <Button type="submit" className="min-h-[44px] shrink-0">
              Buscar
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSpeciesFilter("all")}
              className={`min-h-[34px] rounded-full border px-3 py-1 text-xs font-semibold ${
                speciesFilter === "all"
                  ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                  : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)]"
              }`}
            >
              Todos
            </button>
            {FEED_SPECIES_SELECTOR_OPTIONS.map((sp) => (
              <button
                key={sp.value}
                type="button"
                onClick={() => setSpeciesFilter(sp.value)}
                className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                  speciesFilter === sp.value
                    ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                    : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)]"
                }`}
              >
                <AppIcon icon={SPECIES_ICON_MAP[sp.value]} className="h-3.5 w-3.5" />
                <span>{sp.shortLabel}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {results.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--iw-semantic-border-default)] py-8 text-center text-sm text-[var(--iw-semantic-text-secondary)]">
                No hay alimentos que coincidan con esa búsqueda.
              </p>
            ) : (
              results.map((feed) => {
                const thumb =
                  feed.imageUrl ||
                  inferDefaultImageByFeed({
                    standardCatalogId: feed.standardCatalogId,
                    group: feed.catalogGroup,
                    feedType: feed.feedType,
                    name: feed.name,
                  });
                const regional = normalizeRegionalNamesList(feed.regionalNames);
                const isSelected = feed.id === value;
                return (
                  <div
                    key={feed.id}
                    className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                      isSelected
                        ? "border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-bg-feature)]"
                        : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt={feed.name}
                        className="h-14 w-16 shrink-0 rounded-lg border border-[var(--iw-semantic-border-default)] object-cover"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-[var(--iw-semantic-text-primary)]">
                            {feed.name}
                          </span>
                          {feed.standardCatalogId && (
                            <span className="rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--iw-semantic-text-secondary)]">
                              {feed.standardCatalogId}
                            </span>
                          )}
                        </div>
                        <SpeciesTagList species={feed.allowedSpecies} compact />
                        {regional.length > 0 && (
                          <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                            También: {regional.join(" · ")}
                          </p>
                        )}
                        {feed.currentStock !== undefined && feed.currentStock !== null && (
                          <p className="text-xs font-semibold text-[var(--iw-semantic-text-primary)] tabular-nums">
                            Stock: {Number(feed.currentStock).toFixed(1)} {feed.unit}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      {onInspectFeed && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onInspectFeed(feed)}
                          className="min-h-[36px] px-3 py-1 text-xs"
                        >
                          Ver ficha
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => {
                          onChange(feed.id);
                          setSearchOpen(false);
                        }}
                        className="min-h-[36px] px-3 py-1 text-xs"
                      >
                        {isSelected ? "Seleccionado" : "Elegir"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

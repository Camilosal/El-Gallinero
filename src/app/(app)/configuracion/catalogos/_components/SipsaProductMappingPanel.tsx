"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { getSipsaIProductMappingKey, type SipsaIProductMappings } from "@/lib/external-sources/sipsa-product-mapping";
import { matchesTextQuery } from "@/lib/text";

interface Observation {
  id: string;
  observedAt: string;
  dimensions: Record<string, unknown>;
}

interface PurchaseProduct {
  id: string;
  name: string;
  expenseCategory: string;
  defaultPresentation: string | null;
  defaultUnit: string;
}

interface ProductOption {
  key: string;
  article: string;
  presentation: string;
  cpcCode: string;
  group: string;
  period: string;
  localities: Set<string>;
}

interface Props {
  history: Observation[];
  purchaseProducts: PurchaseProduct[];
  mappings: SipsaIProductMappings;
  busy?: boolean;
  onSave: (mappings: SipsaIProductMappings) => void;
}

const PAGE_SIZE = 30;

export default function SipsaProductMappingPanel({
  history,
  purchaseProducts,
  mappings,
  busy = false,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<SipsaIProductMappings>(mappings);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => setDraft(mappings), [mappings]);
  useEffect(() => setPage(0), [search]);

  const products = useMemo(() => {
    const byKey = new Map<string, ProductOption>();
    for (const observation of history) {
      const dimensions = observation.dimensions || {};
      const key = getSipsaIProductMappingKey(dimensions);
      if (!key) continue;
      const current = byKey.get(key);
      const locality = [dimensions.municipality, dimensions.department].filter(Boolean).join(", ");
      if (current) {
        if (locality) current.localities.add(String(locality));
        continue;
      }
      byKey.set(key, {
        key,
        article: String(dimensions.article || "Producto sin nombre"),
        presentation: String(dimensions.presentation ?? dimensions.characteristics ?? "Presentación no informada"),
        cpcCode: String(dimensions.cpcCode || ""),
        group: String(dimensions.group || ""),
        period: String(dimensions.period || new Date(observation.observedAt).toISOString().slice(0, 7)),
        localities: new Set(locality ? [String(locality)] : []),
      });
    }
    return [...byKey.values()].sort((a, b) =>
      `${a.article} ${a.presentation}`.localeCompare(`${b.article} ${b.presentation}`, "es"),
    );
  }, [history]);

  const filtered = useMemo(
    () => products.filter((item) => matchesTextQuery(search, [item.article, item.presentation, item.cpcCode, item.group])),
    [products, search],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const mappedCount = products.filter((item) => Boolean(draft[item.key])).length;

  const setMapping = (key: string, productId: string) => {
    setDraft((current) => {
      const next = { ...current };
      if (productId) next[key] = productId;
      else delete next[key];
      return next;
    });
  };

  return (
    <Card className="mt-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Equivalencias con productos de compra</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            Relaciona cada artículo y presentación SIPSA-I con un producto de esta granja. La equivalencia solo conecta referencias; no modifica precios maestros, egresos ni cálculos de costos.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {products.length} productos DANE disponibles · {mappedCount} vinculados · se muestra el periodo y territorio de la referencia en la tabla SIPSA-I.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={busy || products.length === 0}
          onClick={() => onSave(draft)}
          className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          {busy ? "Guardando..." : "Guardar equivalencias"}
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Aún no hay productos SIPSA-I con código CPC, artículo y presentación para vincular. Actualiza la fuente oficial o importa el archivo de respaldo.
        </p>
      ) : purchaseProducts.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Crea primero productos en el catálogo de compras de esta granja; aparecerán aquí para relacionarlos.
        </p>
      ) : (
        <>
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar artículo, presentación o código CPC..."
            resultCount={filtered.length}
            totalCount={products.length}
          />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Artículo SIPSA-I</th>
                  <th className="px-3 py-2">Presentación · CPC</th>
                  <th className="px-3 py-2">Producto local de compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((item) => (
                  <tr key={item.key}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900">{item.article}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {item.group || "SIPSA-I"} · {item.period} · {item.localities.size} municipios
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      <div>{item.presentation}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-500">CPC {item.cpcCode}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Select
                        aria-label={`Producto de compra para ${item.article}, ${item.presentation}`}
                        value={draft[item.key] || ""}
                        onChange={(event) => setMapping(item.key, event.target.value)}
                      >
                        <option value="">Sin vincular</option>
                        {draft[item.key] && !purchaseProducts.some((product) => product.id === draft[item.key]) && (
                          <option value={draft[item.key]}>Producto local inactivo</option>
                        )}
                        {purchaseProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}{product.defaultPresentation ? ` · ${product.defaultPresentation}` : ""} · {product.expenseCategory}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">No hay productos SIPSA-I que coincidan con la búsqueda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Página {page + 1} de {pageCount}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs">
                <ArrowLeft className="h-3 w-3" /> Anterior
              </Button>
              <Button type="button" variant="secondary" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs">
                Siguiente <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

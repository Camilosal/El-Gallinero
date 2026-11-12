"use client";

import { useState } from "react";
import { Settings, ShoppingCart, Sprout } from "lucide-react";
import { Badge, EmptyState, Table } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import {
  feedCategoryLabel,
  isFreshFeedCategory,
  isPurchasedFeedCategory,
} from "@/lib/feed-classification";
import { matchesTextQuery } from "@/lib/text";

export interface FeedInventoryRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  daysRemaining: number | null;
  costPerUnit: number;
  estimatedValue: number;
  isLow: boolean;
}

export function AlimentacionInventoryClient({
  items,
  initialQuery = "",
}: {
  items: FeedInventoryRow[];
  initialQuery?: string;
}) {
  const [search, setSearch] = useState(initialQuery);

  const filtered = items.filter((f) =>
    matchesTextQuery(search, [
      f.name,
      f.category,
      feedCategoryLabel(f.category),
      isPurchasedFeedCategory(f.category)
        ? "suplementario comprado"
        : isFreshFeedCategory(f.category)
          ? "granja fresco"
          : "procesado",
      f.unit,
      f.currentStock,
      f.minStock,
      f.costPerUnit,
      f.daysRemaining,
      f.isLow ? "stock bajo" : "",
    ]),
  );

  return (
    <div className="space-y-4">
      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Buscar por alimento, categoría o stock..."
        resultCount={filtered.length}
        totalCount={items.length}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="wheat"
          message={
            search.trim()
              ? "No hay alimentos que coincidan con la búsqueda"
              : "No hay alimentos registrados"
          }
        />
      ) : (
        <Table
          headers={[
            "Alimento",
            "Categoría",
            "Stock",
            "Mínimo",
            "Días Rest.",
            "Costo/Unidad",
            "Valor Estimado",
          ]}
        >
          {filtered.map((f) => (
            <tr key={f.id} className={f.isLow ? "bg-red-50" : "hover:bg-slate-50"}>
              <td className="px-4 py-3 font-medium">{f.name}</td>
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
              <td className="px-4 py-3">
                ${Number(f.costPerUnit).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-semibold text-blue-600">
                ${Math.round(f.estimatedValue).toLocaleString()}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

export interface CatalogItem {
  id: string;
  category: string;
  value: string;
  price: string | null;
  units: number | null;
  sortOrder: number;
  isActive: boolean;
}

// Carga las opciones de un catálogo desde /api/catalogos
export function useCatalog(category: string, fallback: string[] = []) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [values, setValues] = useState<string[]>(fallback);
  const fallbackKey = fallback.join("|");

  useEffect(() => {
    let active = true;
    const fb = fallbackKey.split("|").filter(Boolean);
    apiFetch(`/api/catalogos?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((list: CatalogItem[]) => {
        if (!active) return;
        const vals = list.map((i) => i.value);
        setItems(list);
        setValues(vals.length > 0 ? vals : fb);
      })
      .catch(() => {
        if (active) setValues(fb);
      });
    return () => { active = false; };
  }, [category, fallbackKey]);

  return { items, values };
}

"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

export interface CatalogItem {
  id: string;
  category: string;
  value: string;
  tipo: string | null;
  price: string | null;
  units: number | null;
  sortOrder: number;
  isActive: boolean;
}

// Carga las opciones de un catálogo desde /api/configuracion/catalogos
export function useCatalog(category: string, fallback: string[] = []) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [values, setValues] = useState<string[]>(fallback);
  const [reloadKey, setReloadKey] = useState(0);
  const fallbackKey = fallback.join("|");

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    const fb = fallbackKey.split("|").filter(Boolean);
    apiFetch(`/api/configuracion/catalogos?category=${encodeURIComponent(category)}`)
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
  }, [category, fallbackKey, reloadKey]);

  return { items, values, reload };
}

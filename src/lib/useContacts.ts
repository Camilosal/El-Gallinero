"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, getApiCacheKey } from "@/lib/fetch";
import {
  getCachedCatalog,
  getCachedRecords,
  setCachedRecords,
} from "@/lib/offline/db";
import { SYNC_COMPLETED_EVENT } from "@/lib/offline/syncManager";
import { OFFLINE_QUEUED_EVENT } from "@/lib/offline/optimisticCache";
import {
  contactMatchesRole,
  normalizeContactNameKey,
  type ContactRecord,
} from "@/lib/contacts-shared";
import type { CatalogItem } from "@/lib/useCatalog";

export const CONTACTS_UPDATED_EVENT = "gallinero-contacts-updated";

export function notifyContactsChanged(contact?: ContactRecord) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONTACTS_UPDATED_EVENT, { detail: contact }));
}

export function findContactByName(
  contacts: ContactRecord[],
  name: string | null | undefined,
): ContactRecord | null {
  const key = normalizeContactNameKey(name);
  if (!key) return null;
  return contacts.find((c) => normalizeContactNameKey(c.name) === key) || null;
}

function buildFallbackFromCatalogs(
  clients: CatalogItem[] | null,
  suppliers: CatalogItem[] | null,
): ContactRecord[] {
  const map = new Map<string, ContactRecord>();

  for (const item of clients || []) {
    if (!item?.value?.trim()) continue;
    const key = normalizeContactNameKey(item.value);
    map.set(key, {
      id: item.id,
      name: item.value.trim(),
      role: "cliente",
      personType: "natural",
      documentType: null,
      documentNumber: null,
      contactName: null,
      phone: null,
      whatsapp: null,
      email: null,
      address: null,
      city: null,
      department: null,
      zone: null,
      locationNotes: null,
      categoryTag: null,
      paymentMethod: null,
      creditDays: 0,
      deliverySchedule: null,
      notes: null,
      isActive: item.isActive !== false,
    });
  }

  for (const item of suppliers || []) {
    if (!item?.value?.trim()) continue;
    const key = normalizeContactNameKey(item.value);
    const existing = map.get(key);
    if (existing) {
      existing.role = "ambos";
    } else {
      map.set(key, {
        id: item.id,
        name: item.value.trim(),
        role: "proveedor",
        personType: "natural",
        documentType: null,
        documentNumber: null,
        contactName: null,
        phone: null,
        whatsapp: null,
        email: null,
        address: null,
        city: null,
        department: null,
        zone: null,
        locationNotes: null,
        categoryTag: null,
        paymentMethod: null,
        creditDays: 0,
        deliverySchedule: null,
        notes: null,
        isActive: item.isActive !== false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function useContacts(
  roleFilter: "cliente" | "proveedor" | "ambos" | "all" = "all",
  options: { includeStats?: boolean; includeInactive?: boolean } = {},
) {
  const { includeStats = false, includeInactive = false } = options;
  const [allContacts, setAllContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleUpdate = () => setReloadKey((k) => k + 1);
    const handleQueued = (ev: Event) => {
      const detail = (ev as CustomEvent<{ endpoint?: string }>).detail;
      if (!detail?.endpoint || detail.endpoint.startsWith("/api/contactos")) {
        setReloadKey((k) => k + 1);
      }
    };
    window.addEventListener(CONTACTS_UPDATED_EVENT, handleUpdate);
    window.addEventListener(SYNC_COMPLETED_EVENT, handleUpdate);
    window.addEventListener(OFFLINE_QUEUED_EVENT, handleQueued);
    return () => {
      window.removeEventListener(CONTACTS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(SYNC_COMPLETED_EVENT, handleUpdate);
      window.removeEventListener(OFFLINE_QUEUED_EVENT, handleQueued);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const endpoint = includeStats ? "/api/contactos?includeStats=1" : "/api/contactos";

    async function hydrateFromCache() {
      const cached =
        (await getCachedRecords<ContactRecord[]>(getApiCacheKey(endpoint)).catch(() => null)) ||
        (await getCachedRecords<ContactRecord[]>(getApiCacheKey("/api/contactos?includeStats=1")).catch(() => null)) ||
        (await getCachedRecords<ContactRecord[]>(getApiCacheKey("/api/contactos")).catch(() => null));

      if (active && Array.isArray(cached) && cached.length > 0) {
        setAllContacts(cached);
        setLoading(false);
        return;
      }

      const [clients, suppliers] = await Promise.all([
        getCachedCatalog<CatalogItem[]>("catalog_comprador").catch(() => null),
        getCachedCatalog<CatalogItem[]>("catalog_proveedor").catch(() => null),
      ]);
      const fallback = buildFallbackFromCatalogs(clients, suppliers);
      if (active && fallback.length > 0) {
        setAllContacts(fallback);
        setLoading(false);
      }
    }

    void hydrateFromCache();

    apiFetch(endpoint)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((list: ContactRecord[]) => {
        if (!active || !Array.isArray(list)) return;
        setAllContacts(list);
        void setCachedRecords(getApiCacheKey(endpoint), list);
      })
      .catch(() => {
        // En offline se conservan los registros recuperados desde IndexedDB
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [includeStats, reloadKey]);

  const contacts = useMemo(() => {
    return allContacts.filter((contact) => {
      if (!includeInactive && contact.isActive === false) return false;
      return contactMatchesRole(contact.role, roleFilter);
    });
  }, [allContacts, includeInactive, roleFilter]);

  return { contacts, allContacts, loading, reload };
}


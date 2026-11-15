"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";
import NormativeCatalogBrowser, {
  type NewNormativeItemInput,
} from "@/components/NormativeCatalogBrowser";
import { apiFetch } from "@/lib/fetch";
import type { NormativeCatalogItem, NormativeCatalogMeta } from "@/lib/normative-catalog";

export default function NormasGuiasTab() {
  const [meta, setMeta] = useState<NormativeCatalogMeta | null>(null);
  const [items, setItems] = useState<NormativeCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const loadNormas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/configuracion/fuentes-externas?section=normas");
      const json = (await res.json()) as NormativeCatalogMeta & { error?: string };
      if (!res.ok) {
        throw new Error(json?.error || "Error cargando el catálogo normativo.");
      }
      setMeta(json);
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "No se pudo cargar el catálogo normativo.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadNormas);
  }, [loadNormas]);

  const applyPostCatalogResponse = useCallback(
    async (json: {
      normativeCatalog?: NormativeCatalogItem[];
      normativeCatalogMeta?: Omit<NormativeCatalogMeta, "items">;
    }) => {
      if (Array.isArray(json.normativeCatalog) && json.normativeCatalogMeta) {
        setItems(json.normativeCatalog);
        setMeta({
          ...json.normativeCatalogMeta,
          items: json.normativeCatalog,
        });
      } else {
        await loadNormas();
      }
    },
    [loadNormas],
  );

  const handleSyncCatalog = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch("/api/configuracion/fuentes-externas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_source",
          sourceKey: "standards_normative_feed",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo verificar el catálogo normativo.");
      await applyPostCatalogResponse(json);
      setNotice({
        type: "ok",
        text: "Catálogo de normas, estándares y guías actualizado a la última versión disponible.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Error actualizando el catálogo normativo.",
      });
    } finally {
      setBusy(false);
    }
  }, [applyPostCatalogResponse]);

  const handleAddCustomItem = useCallback(
    async (input: NewNormativeItemInput) => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await apiFetch("/api/configuracion/fuentes-externas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_normative_item",
            ...input,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "No se pudo guardar la referencia normativa.");
        await applyPostCatalogResponse(json);
        setNotice({
          type: "ok",
          text: `Referencia "${input.code}" agregada al catálogo con sus adjuntos vinculados.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error guardando referencia normativa.";
        setNotice({ type: "error", text: msg });
        throw new Error(msg);
      } finally {
        setBusy(false);
      }
    },
    [applyPostCatalogResponse],
  );

  const handleDeleteCustomItem = useCallback(
    async (id: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await apiFetch("/api/configuracion/fuentes-externas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_normative_item",
            id,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "No se pudo eliminar la referencia.");
        await applyPostCatalogResponse(json);
        setNotice({
          type: "ok",
          text: "Referencia normativa propia eliminada del catálogo.",
        });
      } catch (err) {
        setNotice({
          type: "error",
          text: err instanceof Error ? err.message : "Error eliminando referencia.",
        });
      } finally {
        setBusy(false);
      }
    },
    [applyPostCatalogResponse],
  );

  if (loading && items.length === 0) {
    return (
      <Card>
        <p className="py-10 text-center text-sm text-slate-500">
          Cargando catálogo de normas, estándares y guías aplicables...
        </p>
      </Card>
    );
  }

  if (items.length === 0 && !meta) {
    return (
      <Card>
        <EmptyState
          icon={<BookOpen className="w-7 h-7" />}
          message={notice?.text || "No se pudo cargar el catálogo de normas, estándares y guías."}
        />
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="primary" onClick={() => void loadNormas()}>
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {notice.text}
        </div>
      )}

      <NormativeCatalogBrowser
        catalog={items}
        meta={meta}
        busy={busy}
        onSyncCatalog={() => void handleSyncCatalog()}
        syncButtonLabel="Buscar última versión"
        defaultExpanded={true}
        onAddCustomItem={handleAddCustomItem}
        onDeleteCustomItem={handleDeleteCustomItem}
      />
    </div>
  );
}

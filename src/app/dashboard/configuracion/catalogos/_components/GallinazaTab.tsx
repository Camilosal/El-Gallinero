"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Table } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface ManureFactor {
  id: string;
  key: string;
  label: string;
  birdGroup: string;
  stageCatalogoId: string | null;
  kgPerBirdPerDay: number;
}

export default function GallinazaTab() {
  const [items, setItems] = useState<ManureFactor[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/factores-gallinaza")
      .then((r) => r.json())
      .then((data: ManureFactor[]) => {
        setItems(data);
        setEdits(Object.fromEntries(data.map((item) => [item.id, String(item.kgPerBirdPerDay)])));
      })
      .catch(() => setError("No se pudieron cargar los factores de gallinaza"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAll = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      for (const item of items) {
        const value = edits[item.id];
        if (value === undefined || Number(value) === item.kgPerBirdPerDay) continue;
        const res = await apiFetch("/api/configuracion/factores-gallinaza", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, kgPerBirdPerDay: value }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Error al guardar ${item.label}`);
        }
      }
      setMessage("Factores actualizados. La estimación de gallinaza usará los nuevos valores.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los factores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700">🌱 Factores de producción de gallinaza</h3>
            <p className="text-xs text-slate-500 mt-1">
              Kilogramos de gallinaza por animal y por día para cada etapa, gallos y lotes.
              La estimación diaria se calcula multiplicando el factor por el número de animales.
            </p>
          </div>
          <Button onClick={saveAll} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded-lg">{message}</p>}
      </Card>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : (
          <Table headers={["Grupo", "Tipo", "kg/animal/día", "Equivalente"]}>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{item.label}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{item.birdGroup}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={edits[item.id] ?? String(item.kgPerBirdPerDay)}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </td>
                <td className="px-4 py-3 text-slate-500">{Number(edits[item.id] || 0).toFixed(3)} kg</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

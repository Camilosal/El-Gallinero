"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface SettingItem {
  key: string;
  label: string;
  description: string;
  group: string;
  type: "number" | "integer" | "boolean" | "string";
  default: string;
  value: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export default function ParametrosTab() {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/parametros")
      .then((r) => r.json())
      .then((data: SettingItem[]) => {
        setItems(data);
        setValues(Object.fromEntries(data.map((item) => [item.key, item.value])));
      })
      .catch(() => setError("No se pudieron cargar los parámetros"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, SettingItem[]>();
    for (const item of items) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [items]);

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updates = items.map((item) => ({ key: item.key, value: values[item.key] ?? item.value }));
      const res = await apiFetch("/api/configuracion/parametros", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al guardar los parámetros");
        return;
      }
      setItems(data);
      setValues(Object.fromEntries((data as SettingItem[]).map((item) => [item.key, item.value])));
      setMessage("Parámetros actualizados. Los cálculos ya usan los nuevos valores.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center py-10 text-slate-400">Cargando parámetros...</p>;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700">⚙️ Parámetros globales de cálculo</h3>
            <p className="text-xs text-slate-500 mt-1">
              Estos valores alimentan el ciclo de vida, la parvada, la valoración de inventario y las validaciones.
              Los cambios se aplican de inmediato a los próximos cálculos.
            </p>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded-lg">{message}</p>}
      </Card>

      {grouped.map(([group, groupItems]) => (
        <Card key={group}>
          <h4 className="font-semibold text-slate-700 mb-3">{group}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupItems.map((item) => (
              <div key={item.key} className="border border-slate-200 rounded-lg p-3">
                <Input
                  label={`${item.label}${item.unit ? ` (${item.unit})` : ""}`}
                  type={item.type === "number" || item.type === "integer" ? "number" : "text"}
                  step={item.step}
                  min={item.min}
                  max={item.max}
                  value={values[item.key] ?? item.value}
                  onChange={(e) => setValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                  help={item.description}
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Clave: <code>{item.key}</code> · Valor por defecto: <code>{item.default}</code>
                </p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

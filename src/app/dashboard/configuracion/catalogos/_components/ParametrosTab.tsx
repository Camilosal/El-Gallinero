"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Textarea } from "@/components/ui";
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
  inputType?: "text" | "date" | "email" | "tel";
  multiline?: boolean;
  setupRequired?: boolean;
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

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

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
      setMessage("Datos de la granja y parámetros guardados correctamente.");
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
            <h3 className="font-semibold text-slate-700">⚙️ Parámetros y datos de la granja</h3>
            <p className="text-xs text-slate-500 mt-1">
              Completa primero los datos generales de la granja y el responsable. Luego podrás editar esta información y los parámetros de cálculo desde aquí.
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
                {item.multiline ? (
                  <Textarea
                    label={`${item.label}${item.setupRequired ? " · requerido para el inicio" : ""}`}
                    value={values[item.key] ?? item.value}
                    onChange={(e) => setValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    help={item.description}
                  />
                ) : (
                  <Input
                    label={`${item.label}${item.unit ? ` (${item.unit})` : ""}${item.setupRequired ? " · requerido para el inicio" : ""}`}
                    type={item.type === "number" || item.type === "integer" ? "number" : item.inputType || "text"}
                    step={item.step}
                    min={item.min}
                    max={item.max}
                    value={values[item.key] ?? item.value}
                    onChange={(e) => setValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    help={item.description}
                  />
                )}
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

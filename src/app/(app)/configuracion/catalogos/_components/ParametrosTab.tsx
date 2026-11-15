"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { Button, Card, EmptyState, Input, Select, Textarea } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import {
  COLOMBIA_DEPARTMENTS,
  COLOMBIA_DIVIPOLA_CATALOG,
  getMunicipalitiesByDepartment,
  resolveDivipolaMunicipality,
  type DivipolaMunicipality,
} from "@/lib/divipola-catalog";

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
  const [search, setSearch] = useState("");

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

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesTextQuery(search, [
          item.label,
          item.description,
          item.group,
          item.key,
          values[item.key] ?? item.value,
          item.unit,
        ]),
      ),
    [items, search, values],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SettingItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

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
      setMessage("Datos de la granja guardados. Clima, precios de referencia y vigilancia de la zona fueron actualizados.");
    } finally {
      setSaving(false);
    }
  };

  const countryVal = (values["farm.country"] ?? "Colombia").trim();
  const isColombia = countryVal === "" || countryVal.toLowerCase().includes("colombia");
  const selectedDept = (values["farm.department"] ?? "").trim();
  const deptMunicipalities = useMemo(() => {
    const filtered = getMunicipalitiesByDepartment(selectedDept);
    return filtered.length > 0 ? filtered : COLOMBIA_DIVIPOLA_CATALOG;
  }, [selectedDept]);

  const applyDivipolaSelection = useCallback((muni: DivipolaMunicipality) => {
    setValues((prev) => ({
      ...prev,
      "farm.country": "Colombia",
      "farm.department": muni.department,
      "farm.city": muni.municipality,
      "farm.dane_municipality_code": muni.daneCode,
      "farm.altitude_meters": String(muni.altitudeMeters),
      "farm.latitude": String(muni.latitude),
      "farm.longitude": String(muni.longitude),
    }));
  }, []);

  if (loading) return <p className="text-center py-10 text-slate-400">Cargando parámetros...</p>;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" aria-hidden="true" />
              Parámetros y datos de la granja
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Completa primero los datos generales de la granja y el responsable. Luego podrás editar esta información y los parámetros de cálculo desde aquí.
            </p>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded-lg">{message}</p>}
      </Card>

      {items.length > 0 && (
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar parámetro por nombre, grupo, clave o descripción..."
          resultCount={filteredItems.length}
          totalCount={items.length}
        />
      )}

      {grouped.length === 0 ? (
        <Card>
          <EmptyState icon="clipboard" message="No hay parámetros que coincidan con la búsqueda" />
        </Card>
      ) : (
        grouped.map(([group, groupItems]) => (
        <Card key={group}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="font-semibold text-slate-700">{group}</h4>
            {group === "Ubicación general" && isColombia && (
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                Selector DIVIPOLA activo: al guardar, el sistema carga clima, precios y sanidad de la zona (o promedio regional/nacional).
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupItems.map((item) => {
              const currentValue = values[item.key] ?? item.value;
              const isCountryKey = item.key === "farm.country";
              const isDeptKey = item.key === "farm.department" && isColombia;
              const isCityKey = item.key === "farm.city" && isColombia;
              const isDaneKey = item.key === "farm.dane_municipality_code" && isColombia;

              return (
              <div key={item.key} className="border border-slate-200 rounded-lg p-3">
                {isCountryKey ? (
                  <div className="space-y-2">
                    <Select
                      label={`${item.label}${item.setupRequired ? " · requerido para el inicio" : ""}`}
                      value={isColombia ? "Colombia" : "__OTHER__"}
                      onChange={(e) => {
                        const chosen = e.target.value;
                        if (chosen === "Colombia") {
                          const muni = resolveDivipolaMunicipality(values["farm.dane_municipality_code"] || values["farm.city"]);
                          applyDivipolaSelection(muni);
                        } else {
                          setValues((prev) => ({ ...prev, "farm.country": "Otro país" }));
                        }
                      }}
                      help={item.description}
                    >
                      <option value="Colombia">Colombia (Catálogo oficial DIVIPOLA)</option>
                      <option value="__OTHER__">Otro país</option>
                    </Select>
                    {!isColombia && (
                      <Input
                        label="Nombre del país"
                        value={currentValue}
                        onChange={(e) => setValues((prev) => ({ ...prev, "farm.country": e.target.value }))}
                        placeholder="Ej: Ecuador, Perú, México"
                      />
                    )}
                  </div>
                ) : isDeptKey ? (
                  <Select
                    label={`${item.label} (DIVIPOLA)${item.setupRequired ? " · requerido para el inicio" : ""}`}
                    value={currentValue}
                    onChange={(e) => {
                      const dept = e.target.value;
                      const firstMuni = getMunicipalitiesByDepartment(dept)[0];
                      if (firstMuni) {
                        applyDivipolaSelection(firstMuni);
                      } else {
                        setValues((prev) => ({ ...prev, "farm.department": dept }));
                      }
                    }}
                    help={item.description}
                  >
                    {!COLOMBIA_DEPARTMENTS.includes(currentValue) && currentValue && (
                      <option value={currentValue}>{currentValue}</option>
                    )}
                    {COLOMBIA_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </Select>
                ) : isCityKey ? (
                  <Select
                    label={`${item.label} (Lista DIVIPOLA)${item.setupRequired ? " · requerido para el inicio" : ""}`}
                    value={currentValue}
                    onChange={(e) => {
                      const muni = resolveDivipolaMunicipality(e.target.value, values["farm.department"]);
                      applyDivipolaSelection(muni);
                    }}
                    help="Seleccione el municipio oficial de Colombia; departamento, código DANE, coordenadas y altitud se completan automáticamente."
                  >
                    {!deptMunicipalities.some((m) => m.municipality === currentValue) && currentValue && (
                      <option value={currentValue}>{currentValue} (valor previo)</option>
                    )}
                    {deptMunicipalities.map((m) => (
                      <option key={m.daneCode} value={m.municipality}>
                        {m.municipality} ({m.department}) · {m.altitudeMeters} msnm
                      </option>
                    ))}
                  </Select>
                ) : isDaneKey ? (
                  <Select
                    label={`${item.label} (DIVIPOLA DANE)`}
                    value={currentValue}
                    onChange={(e) => {
                      const muni = resolveDivipolaMunicipality(e.target.value);
                      applyDivipolaSelection(muni);
                    }}
                    help="Al elegir el código DANE se actualizan municipio, departamento, coordenadas y altitud."
                  >
                    {!COLOMBIA_DIVIPOLA_CATALOG.some((m) => m.daneCode === currentValue) && currentValue && (
                      <option value={currentValue}>{currentValue}</option>
                    )}
                    {COLOMBIA_DIVIPOLA_CATALOG.map((m) => (
                      <option key={m.daneCode} value={m.daneCode}>
                        {m.daneCode} — {m.municipality} ({m.department})
                      </option>
                    ))}
                  </Select>
                ) : item.multiline ? (
                  <Textarea
                    label={`${item.label}${item.setupRequired ? " · requerido para el inicio" : ""}`}
                    value={currentValue}
                    onChange={(e) => setValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    help={item.description}
                  />
                ) : item.type === "boolean" ? (
                  <Select
                    label={`${item.label}${item.setupRequired ? " · requerido para el inicio" : ""}`}
                    value={currentValue}
                    onChange={(e) => setValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    help={item.description}
                  >
                    <option value="true">Activado (Sí)</option>
                    <option value="false">Desactivado (No)</option>
                  </Select>
                ) : (
                  <Input
                    label={`${item.label}${item.unit ? ` (${item.unit})` : ""}${item.setupRequired ? " · requerido para el inicio" : ""}`}
                    type={item.type === "number" || item.type === "integer" ? "number" : item.inputType || "text"}
                    step={item.step}
                    min={item.min}
                    max={item.max}
                    value={currentValue}
                    onChange={(e) => setValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    help={item.description}
                  />
                )}
                <p className="text-[11px] text-slate-400 mt-2">
                  Clave: <code>{item.key}</code> · Valor por defecto: <code>{item.default}</code>
                </p>
              </div>
              );
            })}
          </div>
        </Card>
      ))
      )}
    </div>
  );
}

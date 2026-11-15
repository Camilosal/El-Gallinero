"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Lock, Radio, Thermometer, Unlock } from "lucide-react";
import { PageHeader, Card, StatCard, Table, Modal, Button, Badge, Input, Select, Textarea, EmptyState } from "@/components/ui";
import FarmLocationSelect from "@/components/FarmLocationSelect";
import { apiFetch } from "@/lib/fetch";
import { useActionQuery } from "@/lib/useActionQuery";
import FeatureGateBanner from "@/components/FeatureGateBanner";

interface DailyClosureRow {
  id: string;
  closureDate: string;
  status: string;
  closedAt: string;
  reopenedAt: string | null;
  reopenReason: string | null;
  notes: string | null;
  summarySnapshot?: Record<string, number | string> | null;
}

interface SensorRow {
  id: string;
  recordedAt: string;
  locationName: string | null;
  deviceId: string;
  metricType: string;
  value: string;
  unit: string;
  ithIndex: string | null;
  alertTriggered: boolean;
}

export default function CierreYSensoresPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <CierreYSensoresInner />
    </Suspense>
  );
}

function CierreYSensoresInner() {
  const searchParams = useSearchParams();
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split("T")[0]);
  const [closures, setClosures] = useState<DailyClosureRow[]>([]);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [sensorSummary, setSensorSummary] = useState<{ totalReadings: number; alertCount: number; maxIth: number | null; maxNh3Ppm: number | null; latestScaleKg: number | null } | null>(null);
  const [closureMsg, setClosureMsg] = useState("");
  const [reopenTarget, setReopenTarget] = useState<DailyClosureRow | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [sensorModal, setSensorModal] = useState(false);
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [sensorError, setSensorError] = useState("");
  const [sensorForm, setSensorForm] = useState({
    deviceId: "galpon-sensor-01",
    locationId: "",
    metricType: "ith",
    temperatureC: "29",
    humidityPct: "80",
    value: "",
  });

  const loadAll = useCallback(() => {
    Promise.all([
      apiFetch(`/api/operaciones/cierre-diario?date=${targetDate}`).then((r) => r.json()),
      apiFetch("/api/operaciones/sensores").then((r) => r.json()),
    ]).then(([cData, sData]) => {
      setClosures(Array.isArray(cData?.closures) ? cData.closures : []);
      setPreview(cData?.preview || null);
      setSensors(Array.isArray(sData?.readings) ? sData.readings : []);
      setSensorSummary(sData?.summary || null);
    });
  }, [targetDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openSensorModal = () => {
    setSensorError("");
    setSensorModal(true);
  };

  useActionQuery(searchParams.get("nuevo"), {
    "1": openSensorModal,
    sensor: openSensorModal,
    cierre: () => {
      setClosureMsg("");
      setClosureModalOpen(true);
    },
  });

  const currentClosure = closures.find((c) => c.closureDate === targetDate);
  const isClosedToday = currentClosure?.status === "cerrado";

  const closeDay = async () => {
    setClosureMsg("");
    const res = await apiFetch("/api/operaciones/cierre-diario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closureDate: targetDate }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setClosureMsg(data.error || "No se pudo cerrar el día");
      return;
    }
    loadAll();
  };

  const confirmReopen = async () => {
    if (!reopenTarget) return;
    setClosureMsg("");
    const res = await apiFetch("/api/operaciones/cierre-diario", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reopenTarget.id, closureDate: reopenTarget.closureDate, action: "reopen", reopenReason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setClosureMsg(data.error || "No tienes permiso para reabrir este cierre");
      return;
    }
    setReopenTarget(null);
    setReopenReason("");
    loadAll();
  };

  const submitSensor = async () => {
    setSensorError("");
    const payload: Record<string, unknown> = {
      deviceId: sensorForm.deviceId,
      locationId: sensorForm.locationId || null,
      metricType: sensorForm.metricType,
    };
    if (sensorForm.metricType === "ith") {
      payload.temperatureC = Number(sensorForm.temperatureC);
      payload.humidityPct = Number(sensorForm.humidityPct);
    } else {
      payload.value = Number(sensorForm.value);
    }
    const res = await apiFetch("/api/operaciones/sensores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSensorError(data.error || "No se pudo guardar lectura");
      return;
    }
    setSensorModal(false);
    loadAll();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cierre Diario Auditable y Telemetría Ambiental"
        description="Bloqueo operativo de jornadas cerradas (reapertura restringida a Admin/Propietario) y monitoreo ITH, NH3, T°, HR% y básculas"
        actions={<Button onClick={openSensorModal}>+ Registrar Lectura Sensor</Button>}
      />

      <FeatureGateBanner flagKey="genealogia_3gen_qr_iot" mode="gate">
      {closureMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
          {closureMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                {isClosedToday ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
                <span>Cierre Operativo del Día</span>
              </h3>
              <p className="text-xs text-slate-500">Bloquea ediciones retroactivas una vez auditada la jornada.</p>
            </div>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>

          {preview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="p-2.5 bg-slate-50 rounded-lg border">
                <p className="text-[11px] text-slate-500">Huevos</p>
                <p className="text-lg font-bold">{preview.eggsCollected || 0}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border">
                <p className="text-[11px] text-slate-500">Bajas</p>
                <p className="text-lg font-bold text-red-600">{preview.mortalityUnits || 0}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border">
                <p className="text-[11px] text-slate-500">Ventas COP</p>
                <p className="text-lg font-bold text-emerald-700">${Number(preview.salesTotalCop || 0).toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border">
                <p className="text-[11px] text-slate-500">Sanidad</p>
                <p className="text-lg font-bold">{preview.sanitaryEvents || 0}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Badge color={isClosedToday ? "red" : currentClosure?.status === "reabierto" ? "yellow" : "green"}>
              {currentClosure ? `Estado: ${currentClosure.status}` : "Jornada abierta"}
            </Badge>
            {isClosedToday && currentClosure ? (
              <Button variant="secondary" onClick={() => setReopenTarget(currentClosure)}>Reabrir (Admin)</Button>
            ) : (
              <Button onClick={closeDay}>Cerrar y Bloquear Jornada</Button>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon="alert"
            label="Alertas ITH / NH3"
            value={sensorSummary?.alertCount ?? 0}
            color={(sensorSummary?.alertCount ?? 0) > 0 ? "red" : "green"}
          />
          <StatCard
            icon="thermometer"
            label="ITH Máximo"
            value={sensorSummary?.maxIth != null ? sensorSummary.maxIth : "—"}
            color={(sensorSummary?.maxIth ?? 0) >= 72 ? "red" : "blue"}
          />
          <StatCard
            icon="shield"
            label="NH3 Máx (ppm)"
            value={sensorSummary?.maxNh3Ppm != null ? `${sensorSummary.maxNh3Ppm} ppm` : "—"}
            color={(sensorSummary?.maxNh3Ppm ?? 0) >= 20 ? "red" : "green"}
          />
          <StatCard
            icon="scale"
            label="Último Peso Báscula"
            value={sensorSummary?.latestScaleKg != null ? `${sensorSummary.latestScaleKg} kg` : "—"}
            color="purple"
          />
        </div>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-blue-600" />
          <span>Lecturas Recientes de Sensores Ambientales y Báscula</span>
        </h3>
        {sensors.length === 0 ? (
          <EmptyState icon="thermometer" message="No hay lecturas de telemetría registradas" />
        ) : (
          <Table headers={["Fecha/Hora", "Dispositivo", "Lugar", "Métrica", "Valor / ITH", "Estado"]}>
            {sensors.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-xs text-slate-500">{new Date(s.recordedAt).toLocaleString("es-CO")}</td>
                <td className="px-4 py-2 text-sm font-mono">{s.deviceId}</td>
                <td className="px-4 py-2 text-sm">{s.locationName || "General"}</td>
                <td className="px-4 py-2 text-sm capitalize">{s.metricType.replace("_", " ")}</td>
                <td className="px-4 py-2 text-sm font-semibold">
                  {Number(s.value).toFixed(2)} {s.unit}
                  {s.ithIndex && <span className="ml-2 text-xs text-slate-500">(ITH {s.ithIndex})</span>}
                </td>
                <td className="px-4 py-2">
                  {s.alertTriggered ? (
                    <Badge color="red">
                      <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alerta</span>
                    </Badge>
                  ) : (
                    <Badge color="green">Normal</Badge>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-800 mb-3">Historial de Cierres Diarios</h3>
        {closures.length === 0 ? (
          <EmptyState icon="clipboard" message="Aún no se han ejecutado cierres diarios" />
        ) : (
          <Table headers={["Fecha Cierre", "Estado", "Huevos", "Ventas", "Motivo Reapertura", ""]}>
            {closures.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm font-medium">{c.closureDate}</td>
                <td className="px-4 py-2">
                  <Badge color={c.status === "cerrado" ? "red" : "yellow"}>{c.status}</Badge>
                </td>
                <td className="px-4 py-2 text-sm">{c.summarySnapshot?.eggsCollected ?? "—"}</td>
                <td className="px-4 py-2 text-sm">${Number(c.summarySnapshot?.salesTotalCop || 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{c.reopenReason || "—"}</td>
                <td className="px-4 py-2">
                  {c.status === "cerrado" && (
                    <button onClick={() => setReopenTarget(c)} className="text-xs text-blue-600 hover:underline">Reabrir</button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={!!reopenTarget} onClose={() => setReopenTarget(null)} title={`Reabrir Jornada ${reopenTarget?.closureDate || ""}`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-600">Solo un usuario con rol Administrador o Propietario puede desbloquear una fecha cerrada.</p>
          <Textarea label="Motivo de auditoría *" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Ej: Corrección factura de venta #124" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReopenTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmReopen}>Confirmar Reapertura</Button>
          </div>
        </div>
      </Modal>

      <Modal open={closureModalOpen} onClose={() => setClosureModalOpen(false)} title="Ejecutar Cierre Diario Auditable">
        <div className="space-y-4">
          {closureMsg && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{closureMsg}</p>}
          <Input label="Fecha de jornada" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          {preview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-lg border"><p className="text-[11px] text-slate-500">Huevos</p><p className="text-base font-bold">{preview.eggsCollected || 0}</p></div>
              <div className="p-2.5 bg-slate-50 rounded-lg border"><p className="text-[11px] text-slate-500">Bajas</p><p className="text-base font-bold text-red-600">{preview.mortalityUnits || 0}</p></div>
              <div className="p-2.5 bg-slate-50 rounded-lg border"><p className="text-[11px] text-slate-500">Ventas</p><p className="text-base font-bold text-emerald-700">${Number(preview.salesTotalCop || 0).toLocaleString()}</p></div>
              <div className="p-2.5 bg-slate-50 rounded-lg border"><p className="text-[11px] text-slate-500">Sanidad</p><p className="text-base font-bold">{preview.sanitaryEvents || 0}</p></div>
            </div>
          )}
          {isClosedToday ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              La jornada {targetDate} ya se encuentra cerrada.
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              Al confirmar, la jornada quedará bloqueada contra ediciones retroactivas (solo Admin/Propietario puede reabrirla).
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setClosureModalOpen(false)}>Cancelar</Button>
            {!isClosedToday && (
              <Button onClick={async () => { await closeDay(); setClosureModalOpen(false); }}>
                Cerrar y Bloquear Jornada
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={sensorModal} onClose={() => setSensorModal(false)} title="Registrar Telemetría Ambiental / Báscula">
        <div className="space-y-4">
          {sensorError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{sensorError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dispositivo *" value={sensorForm.deviceId} onChange={(e) => setSensorForm({ ...sensorForm, deviceId: e.target.value })} />
            <FarmLocationSelect value={sensorForm.locationId} onChange={(v) => setSensorForm({ ...sensorForm, locationId: v })} allowUnassigned />
          </div>
          <Select label="Tipo de lectura *" value={sensorForm.metricType} onChange={(e) => setSensorForm({ ...sensorForm, metricType: e.target.value })}>
            <option value="ith">Índice Temperatura-Humedad (ITH automático)</option>
            <option value="amoniaco_ppm">Amoníaco NH3 (ppm)</option>
            <option value="temperatura">Temperatura (°C)</option>
            <option value="humedad">Humedad relativa (%)</option>
            <option value="peso_bascula">Peso Báscula Automática (kg)</option>
          </Select>
          {sensorForm.metricType === "ith" ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Temperatura (°C) *" type="number" step="0.1" value={sensorForm.temperatureC} onChange={(e) => setSensorForm({ ...sensorForm, temperatureC: e.target.value })} />
              <Input label="Humedad Relativa (%) *" type="number" step="0.5" value={sensorForm.humidityPct} onChange={(e) => setSensorForm({ ...sensorForm, humidityPct: e.target.value })} />
            </div>
          ) : (
            <Input
              label={`Valor (${sensorForm.metricType === "amoniaco_ppm" ? "ppm, alerta ≥20" : sensorForm.metricType}) *`}
              type="number"
              step="0.1"
              value={sensorForm.value}
              onChange={(e) => setSensorForm({ ...sensorForm, value: e.target.value })}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSensorModal(false)}>Cancelar</Button>
            <Button onClick={submitSensor}>Guardar Telemetría</Button>
          </div>
        </div>
      </Modal>
      </FeatureGateBanner>
    </div>
  );
}

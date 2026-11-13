"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Download, ShieldCheck } from "lucide-react";
import { PageHeader, Card, StatCard, Table, Modal, Button, Badge, Input, Select, Textarea, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import FarmLocationSelect from "@/components/FarmLocationSelect";
import AttachmentPanel from "@/components/attachments/AttachmentPanel";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { bindDraftAttachments, createDraftEntityId } from "@/lib/attachments-shared";
import { useActionQuery } from "@/lib/useActionQuery";
import FeatureGateBanner from "@/components/FeatureGateBanner";

interface BiosecurityLog {
  id: string;
  date: string;
  logType: string;
  locationId: string | null;
  locationName: string | null;
  species: string | null;
  checklistItems: Record<string, boolean | number | string>;
  welfareScore: number | null;
  complianceStatus: string;
  inspectorName: string | null;
  staffName: string | null;
  trainingTopic: string | null;
  trainingCertificateUntil: string | null;
  disinfectantUsed: string | null;
  notes: string | null;
  certificateDaysLeft?: number | null;
  certificateStatus?: string | null;
}

interface CertAlert {
  id: string;
  staffName: string;
  trainingTopic: string;
  validUntil: string | null;
  daysLeft: number | null;
  status: string | null;
}

interface SummaryData {
  totalLogs: number;
  poeCompliancePct: number | null;
  latestWelfareScore: number | null;
  mixedFarmBiosecurityScore: number;
  isolationPct: number;
  certificateAlerts: CertAlert[];
}

const LOG_TYPE_LABELS: Record<string, string> = {
  poe_gab: "POE GAB (ICA 3651/3652)",
  bienestar_animal: "Bienestar Animal (Res. 8452/2025)",
  capacitacion: "Capacitación Personal (5 años)",
  ingreso_visitante: "Ingreso Visitantes / Cuarentena 72h",
  desinfeccion: "Desinfección / Vacío Sanitario",
};

const POE_ITEMS = [
  { key: "pediluvio_activo", label: "Pediluvio / arco sanitario con solución vigente" },
  { key: "malla_antipajaro", label: "Malla antipájaros íntegra sin roturas" },
  { key: "control_roedores", label: "Estaciones de roedores y cebos revisados" },
  { key: "aislamiento_especies", label: "Aislamiento por especie respetado (aves/conejos/cuyes)" },
  { key: "agua_potable", label: "Calidad y cloración/potabilidad de agua verificada" },
  { key: "limpieza_bodega", label: "Bodega de alimentos y huevos libre de plagas" },
];

export default function BioseguridadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <BioseguridadPageInner />
    </Suspense>
  );
}

function BioseguridadPageInner() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<BiosecurityLog[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BiosecurityLog | null>(null);
  const [draftAttachmentId, setDraftAttachmentId] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    logType: "poe_gab",
    locationId: "",
    species: "",
    welfareScore: "100",
    complianceStatus: "",
    inspectorName: "",
    staffName: "",
    trainingTopic: "",
    trainingCertificateUntil: "",
    disinfectantUsed: "",
    notes: "",
    checklistItems: Object.fromEntries(POE_ITEMS.map((item) => [item.key, true])) as Record<string, boolean>,
  });

  const load = useCallback(() => {
    apiFetch("/api/sanidad/bioseguridad")
      .then((r) => r.json())
      .then((d) => {
        setLogs(Array.isArray(d?.logs) ? d.logs : []);
        setSummary(d?.summary || null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setDraftAttachmentId(createDraftEntityId());
    setError("");
    setForm({
      date: new Date().toISOString().split("T")[0],
      logType: "poe_gab",
      locationId: "",
      species: "",
      welfareScore: "100",
      complianceStatus: "",
      inspectorName: "",
      staffName: "",
      trainingTopic: "",
      trainingCertificateUntil: "",
      disinfectantUsed: "",
      notes: "",
      checklistItems: Object.fromEntries(POE_ITEMS.map((item) => [item.key, true])),
    });
    setModalOpen(true);
  };

  useActionQuery(searchParams.get("nuevo"), {
    "1": openNew,
    bioseguridad: openNew,
  });

  const openEdit = (l: BiosecurityLog) => {
    setEditing(l);
    setDraftAttachmentId(l.id);
    setError("");
    const checks: Record<string, boolean> = {};
    for (const item of POE_ITEMS) {
      checks[item.key] = l.checklistItems?.[item.key] !== false;
    }
    setForm({
      date: l.date,
      logType: l.logType,
      locationId: l.locationId || "",
      species: l.species || "",
      welfareScore: l.welfareScore != null ? String(l.welfareScore) : "100",
      complianceStatus: l.complianceStatus || "",
      inspectorName: l.inspectorName || "",
      staffName: l.staffName || "",
      trainingTopic: l.trainingTopic || "",
      trainingCertificateUntil: l.trainingCertificateUntil || "",
      disinfectantUsed: l.disinfectantUsed || "",
      notes: l.notes || "",
      checklistItems: checks,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    const payload = {
      id: editing?.id,
      date: form.date,
      logType: form.logType,
      locationId: form.locationId || null,
      species: form.species || null,
      welfareScore: form.logType === "bienestar_animal" ? Number(form.welfareScore) : null,
      complianceStatus: form.complianceStatus || undefined,
      inspectorName: form.inspectorName || null,
      staffName: form.staffName || null,
      trainingTopic: form.trainingTopic || null,
      trainingCertificateUntil: form.trainingCertificateUntil || null,
      disinfectantUsed: form.disinfectantUsed || null,
      notes: form.notes || null,
      checklistItems: form.logType === "poe_gab" ? form.checklistItems : {},
    };

    const res = await apiFetch("/api/sanidad/bioseguridad", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo guardar el registro");
      return;
    }
    if (!editing && draftAttachmentId && data?.id) {
      await bindDraftAttachments("biosecurity", draftAttachmentId, data.id).catch(() => { });
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta bitácora de bioseguridad?")) return;
    const res = await apiFetch(`/api/sanidad/bioseguridad?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar");
      return;
    }
    load();
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (typeFilter !== "all" && l.logType !== typeFilter) return false;
      if (!search.trim()) return true;
      return matchesTextQuery(search, [
        l.date,
        LOG_TYPE_LABELS[l.logType] || l.logType,
        l.locationName,
        l.species,
        l.inspectorName,
        l.staffName,
        l.trainingTopic,
        l.disinfectantUsed,
        l.complianceStatus,
        l.notes,
      ]);
    });
  }, [logs, typeFilter, search]);

  return (
    <div>
      <PageHeader
        title="Bioseguridad ICA y Bienestar Animal"
        description="Control POE GAB (Res. ICA 3651/3652), evaluación de bienestar (Res. 8452/2025), certificaciones a 5 años y paquete auditable"
        actions={
          <div className="flex flex-wrap gap-2">
            <a href="/api/sanidad/bioseguridad?export=xlsx" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100">
              <Download className="w-4 h-4" />
              <span>Exportar ICA XLSX</span>
            </a>
            <a href="/api/sanidad/bioseguridad?export=csv" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">
              <span>CSV</span>
            </a>
            <a href="/api/sanidad/bioseguridad?export=json" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">
              <span>JSON</span>
            </a>
            <Button onClick={openNew}>+ Registrar Bitácora</Button>
          </div>
        }
      />

      <FeatureGateBanner flagKey="auditoria_poe_gab_ica" mode="gate">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
        <StatCard
          icon="shield"
          label="Índice Granja Mixta"
          value={summary ? `${summary.mixedFarmBiosecurityScore}/100` : "—"}
          color="green"
        />
        <StatCard
          icon="clipboard"
          label="Cumplimiento POE GAB"
          value={summary?.poeCompliancePct != null ? `${summary.poeCompliancePct}%` : "Sin POE"}
          color="blue"
        />
        <StatCard
          icon="sparkles"
          label="Último Bienestar Res. 8452"
          value={summary?.latestWelfareScore != null ? `${summary.latestWelfareScore} pts` : "Sin eval."}
          color="purple"
        />
        <StatCard
          icon="alert"
          label="Alertas Certificados (5a)"
          value={summary?.certificateAlerts?.length ?? 0}
          color={(summary?.certificateAlerts?.length ?? 0) > 0 ? "red" : "green"}
        />
      </div>

      {(summary?.certificateAlerts?.length ?? 0) > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Certificados de capacitación de personal vencidos o por vencer (vigencia 5 años)</span>
          </p>
          <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
            {summary!.certificateAlerts.map((a) => (
              <li key={a.id}>
                <strong>{a.staffName}</strong> — {a.trainingTopic} · Vence {a.validUntil} ({a.status === "vencido" ? "VENCIDO" : `${a.daysLeft} días`})
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "Todos" },
              { id: "poe_gab", label: "POE GAB" },
              { id: "bienestar_animal", label: "Bienestar Res. 8452" },
              { id: "capacitacion", label: "Capacitación 5a" },
              { id: "ingreso_visitante", label: "Visitantes" },
              { id: "desinfeccion", label: "Desinfección" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${typeFilter === f.id ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar inspector, personal, lugar..."
            resultCount={filteredLogs.length}
            totalCount={logs.length}
            className="w-full sm:w-64"
          />
        </div>

        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredLogs.length === 0 ? (
          <EmptyState icon="shield" message="No hay bitácoras de bioseguridad o bienestar registradas" />
        ) : (
          <Table headers={["Fecha", "Módulo", "Lugar / Especie", "Evaluación / Responsable", "Cumplimiento", ""]}>
            {filteredLogs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium">{new Date(`${l.date}T12:00:00`).toLocaleDateString("es-CO")}</td>
                <td className="px-4 py-3 text-sm font-semibold">{LOG_TYPE_LABELS[l.logType] || l.logType}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <div>{l.locationName || "Toda la granja"}</div>
                  {l.species && <div className="text-xs capitalize text-slate-400">{l.species}</div>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {l.welfareScore != null && <div className="font-semibold text-purple-700">Bienestar: {l.welfareScore} pts</div>}
                  {l.staffName && <div>Personal: {l.staffName} · Vence {l.trainingCertificateUntil || "—"}</div>}
                  {l.inspectorName && <div className="text-xs text-slate-500">Resp.: {l.inspectorName}</div>}
                  {l.disinfectantUsed && <div className="text-xs text-slate-500">Prod.: {l.disinfectantUsed}</div>}
                </td>
                <td className="px-4 py-3">
                  <Badge color={l.complianceStatus === "cumple" ? "green" : l.complianceStatus === "parcial" ? "yellow" : "red"}>
                    {l.complianceStatus.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => openEdit(l)} className="text-blue-600 hover:underline">Editar</button>
                    <button onClick={() => remove(l.id)} className="text-red-600 hover:underline">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Bitácora Bioseguridad / Bienestar" : "Nueva Bitácora Bioseguridad / Bienestar"}
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="Tipo de registro *" value={form.logType} onChange={(e) => setForm({ ...form, logType: e.target.value })}>
              {Object.entries(LOG_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FarmLocationSelect
              value={form.locationId}
              onChange={(val) => setForm({ ...form, locationId: val })}
              allowUnassigned
            />
            <Select label="Especie (opcional)" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
              <option value="">Multiespecie / General</option>
              <option value="gallina">Gallinas</option>
              <option value="pollo">Pollos</option>
              <option value="codorniz">Codornices</option>
              <option value="pato">Patos</option>
              <option value="conejo">Conejos</option>
              <option value="cuy">Cuyes</option>
            </Select>
          </div>

          {form.logType === "poe_gab" && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span>Lista de Chequeo POE GAB (ICA 3651/3652)</span>
              </p>
              <div className="space-y-1.5">
                {POE_ITEMS.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.checklistItems[item.key] !== false}
                      onChange={(e) => setForm((prev) => ({
                        ...prev,
                        checklistItems: { ...prev.checklistItems, [item.key]: e.target.checked },
                      }))}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.logType === "bienestar_animal" && (
            <Select
              label="Calificación Res. 8452/2025 *"
              value={form.welfareScore}
              onChange={(e) => setForm({ ...form, welfareScore: e.target.value })}
            >
              <option value="100">100 — Excelente (Cumplimiento pleno)</option>
              <option value="55">55 — Aceptable / Con oportunidades de mejora</option>
              <option value="20">20 — Parcial (Requiere plan correctivo)</option>
              <option value="0">0 — Crítico / No cumple</option>
            </Select>
          )}

          {form.logType === "capacitacion" && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nombre trabajador *" value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} placeholder="Ej: Juan Pérez" />
              <Input label="Vigencia certificado (auto +5 años)" type="date" value={form.trainingCertificateUntil} onChange={(e) => setForm({ ...form, trainingCertificateUntil: e.target.value })} />
              <Input className="col-span-2" label="Tema capacitación *" value={form.trainingTopic} onChange={(e) => setForm({ ...form, trainingTopic: e.target.value })} placeholder="Bioseguridad avícola, GAB, manejo sanitario" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Inspector / Responsable" value={form.inspectorName} onChange={(e) => setForm({ ...form, inspectorName: e.target.value })} />
            <Input label="Desinfectante / Producto" value={form.disinfectantUsed} onChange={(e) => setForm({ ...form, disinfectantUsed: e.target.value })} placeholder="Ej: Amonio cuaternario / Cal" />
          </div>

          <Textarea label="Hallazgos y acciones correctivas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <AttachmentPanel
            entityType="biosecurity"
            entityId={editing?.id || draftAttachmentId}
            defaultCategory="certificado_genetico"
            compact
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Guardar Cambios" : "Registrar Bitácora"}</Button>
          </div>
        </div>
      </Modal>
      </FeatureGateBanner>
    </div>
  );
}

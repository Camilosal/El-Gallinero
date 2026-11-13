"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard, Table, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useFarmLocations } from "@/lib/useFarmLocations";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useSearchParams } from "next/navigation";
import { QrCode } from "lucide-react";
import EntityQrModal from "@/components/EntityQrModal";
import { useActionQuery } from "@/lib/useActionQuery";
import AttachmentPanel from "@/components/attachments/AttachmentPanel";
import { bindDraftAttachments, createDraftEntityId } from "@/lib/attachments-shared";

interface FarmAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  acquisitionDate: string | null;
  acquisitionCost: string;
  warrantyUntil: string | null;
  locationId: string | null;
  locationName: string | null;
  status: string;
  description: string | null;
  notes: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  operativo: { label: "Operativo", color: "green" },
  requiere_mantenimiento: { label: "Requiere atención", color: "yellow" },
  fuera_servicio: { label: "Fuera de servicio", color: "red" },
  retirado: { label: "Retirado", color: "gray" },
};

const emptyForm = {
  name: "", category: "equipo", brand: "", model: "", serialNumber: "", acquisitionDate: "",
  acquisitionCost: "0", warrantyUntil: "", locationId: "", status: "operativo", description: "", notes: "",
};

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-CO") : "—";
}

export default function ActivosPage() {
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<FarmAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FarmAsset | null>(null);
  const [draftAssetId, setDraftAssetId] = useState(() => createDraftEntityId("asset"));
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [qrAsset, setQrAsset] = useState<FarmAsset | null>(null);
  const { locations } = useFarmLocations();

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/operaciones/activos");
      if (!response.ok) throw new Error("No se pudo cargar el inventario de activos");
      setAssets(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los activos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setDraftAssetId(createDraftEntityId("asset"));
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": openNew });

  const openEdit = (asset: FarmAsset) => {
    setEditing(asset);
    setForm({
      name: asset.name,
      category: asset.category,
      brand: asset.brand || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      acquisitionDate: asset.acquisitionDate || "",
      acquisitionCost: asset.acquisitionCost || "0",
      warrantyUntil: asset.warrantyUntil || "",
      locationId: asset.locationId || "",
      status: asset.status,
      description: asset.description || "",
      notes: asset.notes || "",
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    const response = await apiFetch("/api/operaciones/activos", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
    });
    const saved = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(saved.error || "No se pudo guardar el activo");
      return;
    }
    if (!editing && saved?.id) {
      await bindDraftAttachments(draftAssetId, saved.id, "asset");
    }
    setModalOpen(false);
    await load();
  };

  const retire = async (asset: FarmAsset) => {
    if (!confirm(`¿Retirar ${asset.name} del inventario? Se conservará su ficha e historial.`)) return;
    const response = await apiFetch(`/api/operaciones/activos?id=${asset.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "No se pudo retirar el activo");
      return;
    }
    await load();
  };

  const visibleAssets = useMemo(() => assets.filter((asset) => matchesTextQuery(search, [
    asset.code, asset.name, asset.category, asset.brand, asset.model, asset.serialNumber,
    asset.locationName, asset.status, statusLabels[asset.status]?.label,
  ])), [assets, search]);

  const activeCount = assets.filter((asset) => asset.status !== "retirado").length;
  const attentionCount = assets.filter((asset) => ["requiere_mantenimiento", "fuera_servicio"].includes(asset.status)).length;
  const retiredCount = assets.length - activeCount;

  return (
    <div>
      <PageHeader
        title="Activos y equipos"
        description="Identifica equipos, herramientas e infraestructura, y conéctalos con su lugar y mantenimiento."
        help="Registra un activo una sola vez para asociar a su ficha las tareas y reparaciones futuras. El código se asigna automáticamente. Retirar conserva el historial."
        actions={<Button onClick={openNew}>+ Nuevo activo</Button>}
      />
      {error && !modalOpen && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3">
        <StatCard icon="equipment" label="Activos vigentes" value={activeCount} color="green" />
        <StatCard icon="wrench" label="Requieren atención" value={attentionCount} color={attentionCount ? "yellow" : "blue"} />
        <StatCard icon="package" label="Retirados con historial" value={retiredCount} color="blue" />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-800">Inventario de activos</h2>
            <p className="mt-1 text-sm text-slate-500">Los equipos se vinculan a un lugar para ubicar sus revisiones y reparaciones.</p>
          </div>
          <a href="/dashboard/operaciones/mantenimiento" className="text-sm font-medium text-green-700 hover:underline">Ver tareas de mantenimiento →</a>
        </div>
        <TableSearch value={search} onChange={setSearch} placeholder="Buscar por nombre, código, serie o lugar..." resultCount={visibleAssets.length} totalCount={assets.length} className="mb-4" />
        {loading ? (
          <p className="py-8 text-center text-slate-400">Cargando activos...</p>
        ) : visibleAssets.length === 0 ? (
          <>
            <EmptyState icon="equipment" message={search ? "No hay activos que coincidan con la búsqueda" : "Aún no hay equipos registrados"} />
            {!search && <div className="-mt-6 mb-6 text-center"><p className="mb-3 text-sm text-slate-500">Empieza por los equipos que revisas o reparas con frecuencia, como la bomba de agua o la incubadora.</p><Button onClick={openNew}>Registrar primer activo</Button></div>}
          </>
        ) : (
          <Table headers={["Activo", "Tipo", "Lugar", "Estado", "Garantía hasta", "Costo registrado", "Acciones"]}>
              {visibleAssets.map((asset) => (
                <tr key={asset.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{asset.name}</div>
                    <div className="text-xs text-slate-500">{asset.code}{asset.serialNumber ? ` · Serie ${asset.serialNumber}` : ""}</div>
                    {(asset.brand || asset.model) && <div className="text-xs text-slate-500">{[asset.brand, asset.model].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize">{asset.category}</td>
                  <td className="px-4 py-3">{asset.locationName || "Finca / sin lugar"}</td>
                  <td className="px-4 py-3"><Badge color={statusLabels[asset.status]?.color || "gray"}>{statusLabels[asset.status]?.label || asset.status}</Badge></td>
                  <td className="px-4 py-3">{dateLabel(asset.warrantyUntil)}</td>
                  <td className="px-4 py-3">{Number(asset.acquisitionCost) > 0 ? `$${Number(asset.acquisitionCost).toLocaleString("es-CO")}` : "—"}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2 whitespace-nowrap">
                    <button onClick={() => setQrAsset(asset)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline" title="Etiqueta QR del activo">
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>QR</span>
                    </button>
                    <button onClick={() => openEdit(asset)} className="text-xs text-blue-700 hover:underline">Editar</button>
                    {asset.status !== "retirado" && <button onClick={() => void retire(asset)} className="text-xs text-slate-600 hover:underline">Retirar</button>}
                  </div></td>
                </tr>
              ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Editar ${editing.code}` : "Registrar activo o equipo"}>
        <div className="space-y-4">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Input label="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej: Bomba de agua principal" required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Tipo" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="equipo">Equipo</option><option value="herramienta">Herramienta</option><option value="estructura">Estructura</option><option value="vehiculo">Vehículo</option><option value="otro">Otro</option>
            </Select>
            <Select label="Lugar de manejo" value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}>
              <option value="">Finca / sin lugar específico</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Marca" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
            <Input label="Modelo" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
            <Input label="Número de serie" value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Fecha de adquisición" type="date" value={form.acquisitionDate} onChange={(event) => setForm({ ...form, acquisitionDate: event.target.value })} />
            <Input label="Costo de adquisición ($)" type="number" min="0" step="0.01" value={form.acquisitionCost} onChange={(event) => setForm({ ...form, acquisitionCost: event.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Garantía hasta" type="date" value={form.warrantyUntil} onChange={(event) => setForm({ ...form, warrantyUntil: event.target.value })} />
            <Select label="Estado" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="operativo">Operativo</option><option value="requiere_mantenimiento">Requiere atención</option><option value="fuera_servicio">Fuera de servicio</option><option value="retirado">Retirado</option>
            </Select>
          </div>
          <Textarea label="Descripción" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Uso, capacidad o características útiles" />
          <Textarea label="Notas" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Observaciones para futuras revisiones" />
          <AttachmentPanel
            entityType="asset"
            entityId={editing ? editing.id : draftAssetId}
            defaultCategory="placa_serie"
            title="Placa de serie, garantía o manual técnico"
            helpText="Adjunta foto de la placa del equipo, factura de compra o certificado de garantía."
            compact
          />
          <div className="flex gap-3"><Button onClick={() => void save()} disabled={!form.name.trim()}>{editing ? "Guardar cambios" : "Crear ficha"}</Button><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button></div>
        </div>
      </Modal>

      <EntityQrModal
        open={Boolean(qrAsset)}
        onClose={() => setQrAsset(null)}
        entityType="activo"
        entityId={qrAsset?.id || ""}
        code={qrAsset?.code}
        title={qrAsset?.name || "Activo"}
        subtitle={qrAsset ? `${qrAsset.category}${qrAsset.locationName ? ` · ${qrAsset.locationName}` : ""}` : undefined}
      />
    </div>
  );
}

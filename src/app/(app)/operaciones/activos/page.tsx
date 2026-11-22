"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, HeroActionButton, Input, Modal, PageHeader, Select, StatCard, Table, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useFarmLocations } from "@/lib/useFarmLocations";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useSearchParams } from "next/navigation";
import { QrCode, RefreshCw } from "lucide-react";
import EntityQrModal from "@/components/EntityQrModal";
import { useActionQuery } from "@/lib/useActionQuery";
import AttachmentPanel from "@/components/attachments/AttachmentPanel";
import { bindDraftAttachments, createDraftEntityId } from "@/lib/attachments-shared";
import StandardCapexPicker, { type CapexPickerSelectionPatch } from "@/components/finance/StandardCapexPicker";
import {
  CAPEX_CLASSIFICATION_LABELS,
  CAPEX_DESTINATIONS,
  LEGACY_ASSET_CATEGORY_LABELS,
  PRODUCTIVE_CAPEX_FAMILIES,
  computeSuggestedResidualCop,
  findStandardCapexById,
  type CapexClassificationType,
} from "@/lib/finance/standard-capex-catalog";

interface FarmAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  capexCatalogId?: string | null;
  capexFamily?: string | null;
  capexSubfamily?: string | null;
  capexClassification?: string | null;
  capexDestination?: string | null;
  capexDriver?: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  acquisitionDate: string | null;
  acquisitionCost: string;
  usefulLifeMonths?: number | null;
  usefulLifeCycles?: number | null;
  residualValue?: string | null;
  depreciationBasis?: string | null;
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
  name: "", category: "equipo",
  capexCatalogId: "", capexFamily: "", capexSubfamily: "",
  capexClassification: "CAPEX_DEPRECIABLE", capexDestination: "Compartido", capexDriver: "según activo",
  brand: "", model: "", serialNumber: "", acquisitionDate: "",
  acquisitionCost: "0", usefulLifeMonths: "36", usefulLifeCycles: "", residualValue: "0",
  depreciationBasis: "meses", recordCashPurchase: false,
  warrantyUntil: "", locationId: "", status: "operativo", description: "", notes: "",
};

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-CO") : "—";
}

export default function ActivosPage() {
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<FarmAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [aligning, setAligning] = useState(false);
  const [alignNotice, setAlignNotice] = useState("");
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

  const runAlignment = async () => {
    setAligning(true);
    setAlignNotice("");
    try {
      const response = await apiFetch("/api/operaciones/activos/alinear-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCatalogosList: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setAlignNotice(data?.error || "No se pudo alinear los activos al catálogo estándar.");
        return;
      }
      setAlignNotice(
        `Catálogo aplicado: ${data?.updatedAssets ?? 0} activos históricos estandarizados y ${data?.addedCatalogEntries ?? 0} familias sincronizadas sin alterar costos ni saldos.`,
      );
      await load();
    } finally {
      setAligning(false);
    }
  };

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
      capexCatalogId: asset.capexCatalogId || "",
      capexFamily: asset.capexFamily || "",
      capexSubfamily: asset.capexSubfamily || "",
      capexClassification: asset.capexClassification || "CAPEX_DEPRECIABLE",
      capexDestination: asset.capexDestination || "Compartido",
      capexDriver: asset.capexDriver || "según activo",
      brand: asset.brand || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      acquisitionDate: asset.acquisitionDate || "",
      acquisitionCost: asset.acquisitionCost || "0",
      usefulLifeMonths:
        asset.usefulLifeMonths === 0
          ? "0"
          : asset.usefulLifeMonths
            ? String(asset.usefulLifeMonths)
            : "36",
      usefulLifeCycles: asset.usefulLifeCycles ? String(asset.usefulLifeCycles) : "",
      residualValue: asset.residualValue || "0",
      depreciationBasis: asset.depreciationBasis || "meses",
      recordCashPurchase: false,
      warrantyUntil: asset.warrantyUntil || "",
      locationId: asset.locationId || "",
      status: asset.status,
      description: asset.description || "",
      notes: asset.notes || "",
    });
    setError("");
    setModalOpen(true);
  };

  const handleCapexSelect = (patch: CapexPickerSelectionPatch) => {
    setForm((prev) => ({
      ...prev,
      capexCatalogId: patch.capexCatalogId,
      capexFamily: patch.capexFamily,
      capexSubfamily: patch.capexSubfamily,
      capexClassification: patch.capexClassification,
      capexDestination: patch.capexDestination,
      capexDriver: patch.capexDriver,
      category: patch.category,
      name: patch.suggestedName ? patch.suggestedName : prev.name,
      usefulLifeMonths:
        patch.suggestedLifeMonths !== undefined && patch.suggestedLifeMonths !== null
          ? String(patch.suggestedLifeMonths)
          : prev.usefulLifeMonths,
      residualValue:
        patch.suggestedResidualValue !== undefined
          ? String(patch.suggestedResidualValue)
          : prev.residualValue,
    }));
  };

  const handleAcquisitionCostChange = (nextCost: string) => {
    setForm((prev) => {
      const selected = findStandardCapexById(prev.capexCatalogId);
      const shouldSuggestResidual =
        selected &&
        !editing &&
        (prev.residualValue === "0" || prev.residualValue === "" || prev.residualValue === String(computeSuggestedResidualCop(Number(prev.acquisitionCost || 0), selected.suggestedResidualRate)));
      const nextResidual =
        shouldSuggestResidual && selected
          ? String(computeSuggestedResidualCop(Number(nextCost || 0), selected.suggestedResidualRate))
          : prev.residualValue;
      return {
        ...prev,
        acquisitionCost: nextCost,
        residualValue: nextResidual,
      };
    });
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

  const visibleAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (familyFilter !== "all" && (asset.capexFamily || "Sin clasificar") !== familyFilter) {
          return false;
        }
        if (
          destinationFilter !== "all" &&
          (asset.capexDestination || "Compartido") !== destinationFilter
        ) {
          return false;
        }
        if (
          classificationFilter !== "all" &&
          (asset.capexClassification || "CAPEX_DEPRECIABLE") !== classificationFilter
        ) {
          return false;
        }
        return matchesTextQuery(search, [
          asset.code,
          asset.name,
          asset.category,
          asset.capexCatalogId,
          asset.capexFamily,
          asset.capexSubfamily,
          asset.capexDestination,
          asset.capexClassification,
          asset.brand,
          asset.model,
          asset.serialNumber,
          asset.locationName,
          asset.status,
          statusLabels[asset.status]?.label,
        ]);
      }),
    [assets, search, familyFilter, destinationFilter, classificationFilter],
  );

  const unalignedCount = assets.filter((asset) => !asset.capexCatalogId || !asset.capexFamily).length;
  const activeCount = assets.filter((asset) => asset.status !== "retirado").length;
  const attentionCount = assets.filter((asset) => ["requiere_mantenimiento", "fuera_servicio"].includes(asset.status)).length;
  const retiredCount = assets.length - activeCount;
  const totalCapexCost = assets
    .filter((asset) => asset.status !== "retirado")
    .reduce((sum, asset) => sum + Number(asset.acquisitionCost || 0), 0);

  const isNonDepreciableSelected = form.capexClassification === "CAPEX_NO_DEPRECIABLE";
  const isFrontierSelected = ["ACTIVO_BIOLOGICO", "INVENTARIO", "OPEX_NO_CAPEX", "FINANCIACION"].includes(
    form.capexClassification,
  );

  return (
    <div>
      <PageHeader
        title="Activos, infraestructura e inversiones (CapEx)"
        description="Clasifica equipos, estructuras, herramientas y terreno con el catálogo estándar (21 familias · 242 conceptos CAP) para depreciación y ROI exactos."
        help="Registra cada activo según su familia, subfamilia, destino productivo y clasificación contable. Retirar conserva el historial sin borrar trazabilidad."
        actions={<HeroActionButton tone="solid" onClick={openNew}>+ Nuevo activo</HeroActionButton>}
      />
      {error && !modalOpen && (
        <p className="mb-4 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-color-paper)] p-3 text-sm text-[var(--iw-semantic-status-danger)]">
          {error}
        </p>
      )}
      {alignNotice && (
        <p className="mb-4 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-success)]/40 bg-[var(--iw-color-paper)] p-3 text-sm font-medium text-[var(--iw-semantic-status-success)]">
          {alignNotice}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <StatCard icon="equipment" label="Activos vigentes" value={activeCount} color="green" />
        <StatCard
          icon="banknote"
          label="CapEx invertido"
          value={`$${Math.round(totalCapexCost).toLocaleString("es-CO")}`}
          color="blue"
        />
        <StatCard icon="wrench" label="Requieren atención" value={attentionCount} color={attentionCount ? "yellow" : "blue"} />
        <StatCard icon="package" label="Retirados con historial" value={retiredCount} color="purple" />
      </div>

      {unalignedCount > 0 && (
        <Card className="mb-4 border-[var(--iw-semantic-status-warning)]/40 bg-[var(--iw-color-paper)]">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                Tienes {unalignedCount} activo(s) previos sin código CAP o familia estándar asignada
              </p>
              <p className="mt-0.5 text-xs text-[var(--iw-semantic-text-secondary)]">
                Aplica el Catálogo Maestro de CapEx para asignar familia, subfamilia, clasificación y destino sin modificar costos ni fechas.
              </p>
            </div>
            <Button onClick={() => void runAlignment()} disabled={aligning} variant="secondary" className="shrink-0">
              <RefreshCw className={`mr-1.5 h-4 w-4 ${aligning ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{aligning ? "Alineando..." : "Alinear al catálogo CapEx"}</span>
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--iw-semantic-text-primary)]">Inventario de activos e inversiones</h2>
            <p className="mt-1 text-sm text-[var(--iw-semantic-text-secondary)]">
              Estandarizado por familia CapEx, destino anti-subsidio cruzado y lugar de manejo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void runAlignment()}
              disabled={aligning}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--iw-semantic-action-primary)] hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${aligning ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{aligning ? "Sincronizando..." : "Sincronizar catálogo"}</span>
            </button>
            <a href="/operaciones/mantenimiento" className="text-sm font-medium text-[var(--iw-semantic-action-primary)] hover:underline">
              Ver tareas de mantenimiento →
            </a>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <TableSearch value={search} onChange={setSearch} placeholder="Buscar código CAP, nombre, serie o lugar..." resultCount={visibleAssets.length} totalCount={assets.length} />
          </div>
          <Select label="Familia CapEx" value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}>
            <option value="all">Todas las familias</option>
            {PRODUCTIVE_CAPEX_FAMILIES.map((f) => (
              <option key={f.code} value={f.name}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select label="Destino productivo" value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)}>
            <option value="all">Todos los destinos</option>
            {CAPEX_DESTINATIONS.map((dest) => (
              <option key={dest} value={dest}>
                {dest}
              </option>
            ))}
          </Select>
          <Select label="Clasificación contable" value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)}>
            <option value="all">Todas las clasificaciones</option>
            {(["CAPEX_DEPRECIABLE", "CAPEX_NO_DEPRECIABLE", "INTANGIBLE_AMORTIZABLE"] as CapexClassificationType[]).map((cls) => (
              <option key={cls} value={cls}>
                {CAPEX_CLASSIFICATION_LABELS[cls]}
              </option>
            ))}
          </Select>
        </div>
        {loading ? (
          <p className="py-8 text-center text-[var(--iw-semantic-text-muted)]">Cargando activos...</p>
        ) : visibleAssets.length === 0 ? (
          <>
            <EmptyState icon="equipment" message={search || familyFilter !== "all" || destinationFilter !== "all" ? "No hay activos que coincidan con los filtros" : "Aún no hay equipos o inversiones registradas"} />
            {!search && familyFilter === "all" && destinationFilter === "all" && (
              <div className="-mt-6 mb-6 text-center">
                <p className="mb-3 text-sm text-[var(--iw-semantic-text-secondary)]">
                  Registra estructuras, equipos de agua, energía solar, incubación, cercas o terrenos según el catálogo estándar.
                </p>
                <Button onClick={openNew}>Registrar primer activo</Button>
              </div>
            )}
          </>
        ) : (
          <Table headers={["Activo / Código", "Familia / Subfamilia CapEx", "Destino y tipo", "Lugar y estado", "Costo / Depreciación", "Acciones"]}>
              {visibleAssets.map((asset) => {
                const cost = Number(asset.acquisitionCost || 0);
                const residual = Number(asset.residualValue || 0);
                const depreciable = Math.max(0, cost - residual);
                const basis = asset.depreciationBasis === "ciclos" ? "ciclos" : "meses";
                const isLandOrZero =
                  asset.capexClassification === "CAPEX_NO_DEPRECIABLE" ||
                  (basis === "meses" && asset.usefulLifeMonths === 0);
                const lifeCount = isLandOrZero
                  ? 0
                  : basis === "ciclos"
                    ? Math.max(1, Number(asset.usefulLifeCycles || 18))
                    : Math.max(1, Number(asset.usefulLifeMonths || 36));
                const perUnitDepr = !isLandOrZero && depreciable > 0 && lifeCount > 0 ? depreciable / lifeCount : 0;
                const clsKey = (asset.capexClassification || "CAPEX_DEPRECIABLE") as CapexClassificationType;
                return (
                <tr key={asset.id} className="border-t border-[var(--iw-semantic-border-default)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--iw-semantic-text-primary)]">{asset.name}</div>
                    <div className="text-xs text-[var(--iw-semantic-text-secondary)]">
                      {asset.code}
                      {asset.capexCatalogId && (
                        <span className="ml-1.5 font-mono font-semibold text-[var(--iw-semantic-action-primary)]">
                          · {asset.capexCatalogId}
                        </span>
                      )}
                      {asset.serialNumber ? ` · Serie ${asset.serialNumber}` : ""}
                    </div>
                    {(asset.brand || asset.model) && (
                      <div className="text-xs text-[var(--iw-semantic-text-muted)]">
                        {[asset.brand, asset.model].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-[var(--iw-semantic-text-primary)]">
                      {asset.capexFamily || "Sin familia estándar"}
                    </div>
                    <div className="mt-0.5 text-[var(--iw-semantic-text-secondary)]">
                      {asset.capexSubfamily || "—"}
                    </div>
                    <div className="mt-1">
                      <Badge color={clsKey === "CAPEX_NO_DEPRECIABLE" ? "blue" : "green"}>
                        {CAPEX_CLASSIFICATION_LABELS[clsKey] || clsKey}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-[var(--iw-semantic-text-primary)]">
                      {asset.capexDestination || "Compartido"}
                    </div>
                    <div className="text-[var(--iw-semantic-text-secondary)] capitalize">
                      {LEGACY_ASSET_CATEGORY_LABELS[asset.category as keyof typeof LEGACY_ASSET_CATEGORY_LABELS] || asset.category}
                    </div>
                    {asset.capexDriver && (
                      <div className="text-[11px] text-[var(--iw-semantic-text-muted)]">
                        Driver: {asset.capexDriver}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-[var(--iw-semantic-text-primary)]">
                      {asset.locationName || "Finca / sin lugar"}
                    </div>
                    <div className="mt-1">
                      <Badge color={statusLabels[asset.status]?.color || "gray"}>
                        {statusLabels[asset.status]?.label || asset.status}
                      </Badge>
                    </div>
                    {asset.warrantyUntil && (
                      <div className="mt-1 text-[11px] text-[var(--iw-semantic-text-muted)]">
                        Garantía: {dateLabel(asset.warrantyUntil)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--iw-semantic-text-primary)]">
                      {cost > 0 ? `$${cost.toLocaleString("es-CO")}` : "—"}
                    </div>
                    {isLandOrZero ? (
                      <div className="text-xs text-[var(--iw-semantic-text-secondary)]">
                        No depreciable ($0/mes)
                      </div>
                    ) : perUnitDepr > 0 ? (
                      <div className="text-xs text-[var(--iw-semantic-status-success)]">
                        {basis === "ciclos"
                          ? `$${Math.round(perUnitDepr).toLocaleString("es-CO")}/lote (${lifeCount} lotes)`
                          : `$${Math.round(perUnitDepr).toLocaleString("es-CO")}/mes (${lifeCount} m)`}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2 whitespace-nowrap">
                    <button onClick={() => setQrAsset(asset)} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--iw-semantic-status-success)] hover:underline" title="Etiqueta QR del activo">
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>QR</span>
                    </button>
                    <button onClick={() => openEdit(asset)} className="text-xs text-[var(--iw-semantic-action-primary)] hover:underline">Editar</button>
                    {asset.status !== "retirado" && <button onClick={() => void retire(asset)} className="text-xs text-[var(--iw-semantic-text-secondary)] hover:underline">Retirar</button>}
                  </div></td>
                </tr>
              );})}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Editar ${editing.code}` : "Registrar activo o inversión CapEx"}>
        <div className="space-y-4">
          {error && (
            <p className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-color-paper)] p-3 text-sm text-[var(--iw-semantic-status-danger)]">
              {error}
            </p>
          )}
          <StandardCapexPicker
            capexCatalogId={form.capexCatalogId}
            capexFamily={form.capexFamily}
            capexSubfamily={form.capexSubfamily}
            capexClassification={form.capexClassification}
            capexDestination={form.capexDestination}
            capexDriver={form.capexDriver}
            category={form.category}
            acquisitionCost={form.acquisitionCost}
            name={form.name}
            onSelect={handleCapexSelect}
            onDestinationChange={(dest) => setForm((prev) => ({ ...prev, capexDestination: dest }))}
          />
          <Input label="Nombre del activo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej: Bomba de agua principal o Galpón #1" required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Tipo operativo" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="equipo">Equipo</option><option value="herramienta">Herramienta</option><option value="estructura">Estructura</option><option value="vehiculo">Vehículo</option><option value="otro">Otro / Intangible</option>
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
            <Input label="Costo de adquisición ($)" type="number" min="0" step="0.01" value={form.acquisitionCost} onChange={(event) => handleAcquisitionCostChange(event.target.value)} />
          </div>
          <div className="space-y-3 rounded-[var(--iw-radius-card)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3">
            <p className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
              {isNonDepreciableSelected
                ? "Terreno / Activo no depreciable: no genera depreciación ni pérdida mensual artificial"
                : "Duración y depreciación (reparte el gasto para no distorsionar costos diarios)"}
            </p>
            {isNonDepreciableSelected ? (
              <p className="text-xs text-[var(--iw-semantic-text-secondary)]">
                Vida útil: <strong>0 meses (No depreciable)</strong> · Valor residual: <strong>$0</strong>
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select label="¿Cómo se desgasta?" value={form.depreciationBasis} onChange={(event) => setForm({ ...form, depreciationBasis: event.target.value })}>
                  <option value="meses">Por meses de uso</option>
                  <option value="ciclos">Por ciclos / lotes</option>
                </Select>
                {form.depreciationBasis === "ciclos" ? (
                  <Input label="¿Cuántos lotes servirá?" type="number" min="1" max="500" value={form.usefulLifeCycles} onChange={(event) => setForm({ ...form, usefulLifeCycles: event.target.value })} placeholder="Ej: 18" />
                ) : (
                  <Input label="¿Cuántos meses servirá?" type="number" min="1" max="600" value={form.usefulLifeMonths} onChange={(event) => setForm({ ...form, usefulLifeMonths: event.target.value })} placeholder="Ej: 72" />
                )}
                <Input label="Valor residual estimado ($)" type="number" min="0" step="0.01" value={form.residualValue} onChange={(event) => setForm({ ...form, residualValue: event.target.value })} />
              </div>
            )}
            {!editing && Number(form.acquisitionCost) > 0 && !isFrontierSelected && (
              <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--iw-semantic-text-primary)]">
                <input
                  type="checkbox"
                  checked={form.recordCashPurchase}
                  onChange={(event) => setForm({ ...form, recordCashPurchase: event.target.checked })}
                  className="mt-0.5 rounded border-[var(--iw-semantic-border-default)]"
                />
                <span>Anotar salida en Caja (Familia 22 Activos / inversión CapEx; solo descuenta desgaste en utilidad real).</span>
              </label>
            )}
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
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={!form.name.trim() || isFrontierSelected}>
              {editing ? "Guardar cambios" : "Crear ficha CapEx"}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            {isFrontierSelected && (
              <span className="text-xs font-medium text-[var(--iw-semantic-status-warning)]">
                Este concepto es una frontera contable; regístralo en el módulo sugerido arriba.
              </span>
            )}
          </div>
        </div>
      </Modal>

      <EntityQrModal
        open={Boolean(qrAsset)}
        onClose={() => setQrAsset(null)}
        entityType="activo"
        entityId={qrAsset?.id || ""}
        code={qrAsset?.code}
        title={qrAsset?.name || "Activo"}
        subtitle={qrAsset ? `${qrAsset.capexFamily || qrAsset.category}${qrAsset.locationName ? ` · ${qrAsset.locationName}` : ""}` : undefined}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Paperclip,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Textarea } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import AttachmentPanel from "@/components/attachments/AttachmentPanel";
import { createDraftEntityId } from "@/lib/attachments-shared";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { askGinaWithContext } from "@/lib/assistant-events";
import { useActionQuery } from "@/lib/useActionQuery";
import type {
  NormativeCatalogItem,
  NormativeCatalogMeta,
  NormativeDocumentKind,
  NormativeVerificationStatus,
} from "@/lib/normative-catalog";

export interface NewNormativeItemInput {
  code: string;
  kind: NormativeDocumentKind;
  authority: string;
  title: string;
  version: string;
  species: string[];
  moduleLabel: string;
  appRoute: string;
  sourceUrl: string;
  summary: string;
  keyReferences: string[];
  complianceChecklist: string[];
  draftEntityId: string;
}

interface NormativeCatalogBrowserProps {
  catalog: NormativeCatalogItem[];
  meta?: NormativeCatalogMeta | null;
  busy?: boolean;
  onSyncCatalog: () => void;
  syncButtonLabel?: string;
  catalogLinkHref?: string;
  defaultExpanded?: boolean;
  onAddCustomItem?: (input: NewNormativeItemInput) => Promise<void> | void;
  onDeleteCustomItem?: (id: string) => Promise<void> | void;
  onReviewCustomItem?: (id: string, status: NormativeVerificationStatus, note: string) => Promise<void> | void;
}

const KIND_FILTER_OPTIONS: Array<{ key: "" | NormativeDocumentKind; label: string }> = [
  { key: "", label: "Todas" },
  { key: "norma", label: "Requisitos legales" },
  { key: "estandar", label: "Estándares y NTC" },
  { key: "guia", label: "Guías técnicas" },
];

const SPECIES_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todas las especies" },
  { value: "gallina", label: "Gallinas ponedoras" },
  { value: "pollo", label: "Pollos de engorde" },
  { value: "codorniz", label: "Codornices" },
  { value: "pato", label: "Patos" },
  { value: "conejo", label: "Conejos" },
  { value: "cuy", label: "Cuyes / Curíes" },
];

const MODULE_OPTIONS: Array<{ appRoute: string; moduleLabel: string }> = [
  { appRoute: "/sanidad/bioseguridad", moduleLabel: "Sanidad y Bioseguridad" },
  { appRoute: "/sanidad/control", moduleLabel: "Control Sanitario y Retiro" },
  { appRoute: "/produccion?tab=huevos", moduleLabel: "Producción de Huevos" },
  { appRoute: "/produccion?tab=animales", moduleLabel: "Gestión Animal" },
  { appRoute: "/produccion?tab=alimentacion", moduleLabel: "Nutrición y Raciones" },
  { appRoute: "/operaciones/compostaje", moduleLabel: "Compostaje y Residuos" },
  { appRoute: "/finanzas", moduleLabel: "Finanzas y Normativa" },
  { appRoute: "/configuracion/catalogos?tab=normas", moduleLabel: "Catálogos y Documentación" },
];

const SPECIES_LABELS: Record<string, string> = {
  gallina: "Gallina",
  pollo: "Pollo",
  codorniz: "Codorniz",
  pato: "Pato",
  conejo: "Conejo",
  cuy: "Cuy",
  todas: "Todas las especies",
};

function getKindBadgeColor(kind: NormativeDocumentKind): string {
  if (kind === "norma") return "red";
  if (kind === "estandar") return "blue";
  return "green";
}

function getKindIcon(kind: NormativeDocumentKind) {
  if (kind === "norma") return <Scale className="w-3.5 h-3.5 text-red-600 shrink-0" />;
  if (kind === "estandar") return <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
  return <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
}

function formatVerifiedDate(iso?: string | null): string {
  if (!iso) return "Pendiente";
  try {
    return new Date(iso).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function getVerificationBadge(
  status?: NormativeCatalogItem["verificationStatus"],
  lastVerifiedAt?: string | null,
): { label: string; color: "green" | "yellow" | "gray" } {
  if (status === "verificado" && lastVerifiedAt) {
    return { label: `Verificada ${formatVerifiedDate(lastVerifiedAt)}`, color: "green" };
  }
  if (status === "reemplazado" || status === "derogado") {
    return {
      label: status === "reemplazado" ? "Antecedente reemplazado" : "Derogada",
      color: "gray",
    };
  }
  return { label: "Pendiente de verificación", color: "yellow" };
}

export default function NormativeCatalogBrowser({
  catalog,
  meta,
  busy = false,
  onSyncCatalog,
  syncButtonLabel = "Buscar última versión",
  catalogLinkHref,
  defaultExpanded = false,
  onAddCustomItem,
  onDeleteCustomItem,
  onReviewCustomItem,
}: NormativeCatalogBrowserProps) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | NormativeDocumentKind>("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [openAttachmentsMap, setOpenAttachmentsMap] = useState<Record<string, boolean>>({});
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [reviewOpenMap, setReviewOpenMap] = useState<Record<string, boolean>>({});
  const [reviewStatusMap, setReviewStatusMap] = useState<Record<string, NormativeVerificationStatus>>({});
  const [reviewNoteMap, setReviewNoteMap] = useState<Record<string, string>>({});

  // Modal de registro de norma / estándar / guía propia con adjuntos
  const [createOpen, setCreateOpen] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [formError, setFormError] = useState("");
  const [draftEntityId, setDraftEntityId] = useState(() => createDraftEntityId("norm"));
  const [newCode, setNewCode] = useState("");
  const [newKind, setNewKind] = useState<NormativeDocumentKind>("guia");
  const [newAuthority, setNewAuthority] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newModuleIdx, setNewModuleIdx] = useState(0);
  const [newSpecies, setNewSpecies] = useState<string[]>(["todas"]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newKeyRefs, setNewKeyRefs] = useState("");
  const [newChecklist, setNewChecklist] = useState("");

  const loadAttachmentCounts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/adjuntos?entityType=normative_doc&metaOnly=1");
      if (!res.ok) return;
      const rows = (await res.json().catch(() => [])) as Array<{ entityId?: string }>;
      if (!Array.isArray(rows)) return;
      const counts: Record<string, number> = {};
      for (const row of rows) {
        if (row.entityId) {
          counts[row.entityId] = (counts[row.entityId] || 0) + 1;
        }
      }
      setAttachmentCounts(counts);
    } catch {
      // Offline: conserva conteo local
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAttachmentCounts);
  }, [loadAttachmentCounts, catalog.length]);

  const countsByKind = useMemo(() => {
    if (meta?.countsByKind) return meta.countsByKind;
    return catalog.reduce<Record<NormativeDocumentKind, number>>(
      (acc, item) => {
        acc[item.kind] = (acc[item.kind] || 0) + 1;
        return acc;
      },
      { norma: 0, estandar: 0, guia: 0 },
    );
  }, [catalog, meta?.countsByKind]);

  const filteredItems = useMemo(() => {
    return catalog.filter((item) => {
      if (kindFilter && item.kind !== kindFilter) return false;
      if (
        speciesFilter &&
        !item.species.includes(speciesFilter) &&
        !item.species.includes("todas")
      ) {
        return false;
      }
      return matchesTextQuery(search, [
        item.code,
        item.title,
        item.authority,
        item.kindLabel,
        item.moduleLabel,
        item.summary,
        ...item.species.map((sp) => SPECIES_LABELS[sp] || sp),
        ...item.keyReferences,
        ...item.complianceChecklist,
      ]);
    });
  }, [catalog, kindFilter, search, speciesFilter]);

  const anyFilteredExpanded = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.some((item) => expandedMap[item.id] ?? defaultExpanded);
  }, [defaultExpanded, expandedMap, filteredItems]);

  const toggleItemExpanded = (id: string) => {
    setExpandedMap((prev) => {
      const current = prev[id] ?? defaultExpanded;
      return { ...prev, [id]: !current };
    });
  };

  const toggleAttachmentsPanel = (id: string) => {
    setOpenAttachmentsMap((prev) => {
      const next = !prev[id];
      return { ...prev, [id]: next };
    });
    void Promise.resolve().then(loadAttachmentCounts);
  };

  const toggleAllFiltered = () => {
    const nextExpanded = !anyFilteredExpanded;
    setExpandedMap((prev) => {
      const next = { ...prev };
      for (const item of filteredItems) {
        next[item.id] = nextExpanded;
      }
      return next;
    });
  };

  const handleAskGinaGeneral = (item: NormativeCatalogItem) => {
    askGinaWithContext({
      prompt: `Explícame en detalle la referencia "${item.code} — ${item.title}" y dime cómo debo verificar su cumplimiento hoy en la granja.`,
      referenceContext: item,
    });
  };

  const openCreateModal = () => {
    setDraftEntityId(createDraftEntityId("norm"));
    setNewCode("");
    setNewKind("guia");
    setNewAuthority("");
    setNewVersion("");
    setNewTitle("");
    setNewSummary("");
    setNewModuleIdx(0);
    setNewSpecies(["todas"]);
    setNewSourceUrl("");
    setNewKeyRefs("");
    setNewChecklist("");
    setFormError("");
    setCreateOpen(true);
  };

  useActionQuery(onAddCustomItem ? searchParams.get("nuevo") : null, {
    "1": openCreateModal,
    norma: openCreateModal,
    guia: openCreateModal,
  });

  const toggleNewSpecies = (spKey: string) => {
    if (spKey === "todas") {
      setNewSpecies(["todas"]);
      return;
    }
    setNewSpecies((prev) => {
      const withoutAll = prev.filter((x) => x !== "todas");
      const exists = withoutAll.includes(spKey);
      const next = exists ? withoutAll.filter((x) => x !== spKey) : [...withoutAll, spKey];
      return next.length > 0 ? next : ["todas"];
    });
  };

  const handleCreateCustomItem = async () => {
    if (!onAddCustomItem) return;
    if (!newCode.trim() || !newTitle.trim()) {
      setFormError("Ingresa al menos el código/referencia y el título del documento.");
      return;
    }
    setFormError("");
    setSavingCustom(true);
    try {
      const mod = MODULE_OPTIONS[newModuleIdx] || MODULE_OPTIONS[0];
      await onAddCustomItem({
        code: newCode.trim(),
        kind: newKind,
        authority: newAuthority.trim() || "Protocolo interno / documental",
        title: newTitle.trim(),
        version: newVersion.trim() || `Edición ${new Date().getFullYear()}`,
        species: newSpecies,
        moduleLabel: mod.moduleLabel,
        appRoute: mod.appRoute,
        sourceUrl: newSourceUrl.trim(),
        summary: newSummary.trim() || newTitle.trim(),
        keyReferences: newKeyRefs
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        complianceChecklist: newChecklist
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        draftEntityId,
      });
      setCreateOpen(false);
      void Promise.resolve().then(loadAttachmentCounts);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la referencia normativa.");
    } finally {
      setSavingCustom(false);
    }
  };

  const versionLabel = meta?.version || "Vigente";
  const lastSyncLabel = formatVerifiedDate(meta?.lastSyncAt || meta?.lastCheckedAt);
  const frequencyLabel = meta?.updateFrequencyLabel || "Sincronización semanal (7 días) · Revisión documental independiente";
  const verifiedCount = meta?.verifiedCount ?? catalog.filter((i) => i.verificationStatus === "verificado").length;
  const pendingCount = meta?.pendingCount ?? catalog.filter((i) => i.verificationStatus === "pendiente").length;

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-white to-sky-50/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <Scale className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Catálogo de Normas, Estándares y Guías Aplicables
              </h3>
              <Badge color="green">{versionLabel}</Badge>
              <Badge color="gray">{catalog.length} referencias</Badge>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              Consulta umbrales sanitarios, bienestar animal, clasificación de huevo, curvas zootécnicas y guías de manejo, adjunta PDFs oficiales o actas de respaldo en cada norma y pregúntale a <strong>Gina</strong> sobre cualquiera de estas referencias.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
              <span>Última sincronización técnica: <strong className="text-slate-700">{lastSyncLabel}</strong></span>
              <span>Cadencia: <strong className="text-slate-700">{frequencyLabel}</strong></span>
              <span>
                {verifiedCount} verificadas · {pendingCount} pendientes · {countsByKind.norma} obligatorias · {countsByKind.estandar} estándares · {countsByKind.guia} guías
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {catalogLinkHref && (
              <Link
                href={catalogLinkHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Ver catálogo completo en Datos Maestros
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {onAddCustomItem && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar norma o guía
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={onSyncCatalog}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
              {busy ? "Verificando..." : syncButtonLabel}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {KIND_FILTER_OPTIONS.map((opt) => {
              const count = opt.key ? countsByKind[opt.key] || 0 : catalog.length;
              const active = kindFilter === opt.key;
              return (
                <button
                  key={opt.key || "all"}
                  type="button"
                  onClick={() => setKindFilter(opt.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? "bg-white/20 text-white" : "bg-white text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredItems.length > 0 && (
            <button
              type="button"
              onClick={toggleAllFiltered}
              className="inline-flex items-center gap-1 self-start lg:self-auto rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {anyFilteredExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Contraer referencias
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Expandir referencias
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-8">
            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar por código ICA, NTC, FEDNA, bienestar, bioseguridad, retiro, especie..."
              resultCount={filteredItems.length}
              totalCount={catalog.length}
            />
          </div>
          <div className="md:col-span-4">
            <Select
              aria-label="Filtrar por especie"
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
            >
              {SPECIES_FILTER_OPTIONS.map((sp) => (
                <option key={sp.value || "all"} value={sp.value}>
                  {sp.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {filteredItems.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="w-7 h-7" />}
            message="No hay normas, estándares o guías que coincidan con el filtro aplicado."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => {
            const isExpanded = expandedMap[item.id] ?? defaultExpanded;
            const isAttachOpen = Boolean(openAttachmentsMap[item.id]);
            const attachCount = attachmentCounts[item.id] || 0;
            const hasExternalUrl = Boolean(item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl));

            return (
              <Card key={item.id} className="flex flex-col justify-between gap-4 border-slate-200 hover:border-slate-300 transition-colors">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getKindIcon(item.kind)}
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {item.code}
                      </span>
                      <Badge color={getKindBadgeColor(item.kind)}>{item.kindLabel}</Badge>
                      <Badge color="gray">{item.authority}</Badge>
                      {item.isCustom && <Badge color="orange">Propia / Local</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <span>{item.version}</span>
                      <Badge color={getVerificationBadge(item.verificationStatus, item.lastVerifiedAt).color}>
                        {getVerificationBadge(item.verificationStatus, item.lastVerifiedAt).label}
                      </Badge>
                      {item.isCustom && onDeleteCustomItem && (
                        <button
                          type="button"
                          onClick={() => void onDeleteCustomItem(item.id)}
                          className="rounded p-1 text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar referencia propia"
                          aria-label={`Eliminar ${item.code}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {item.summary}
                    </p>
                    {item.applicableScope && (
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        <strong className="text-slate-700">Alcance ({item.jurisdiction}):</strong> {item.applicableScope}
                      </p>
                    )}
                    {item.verificationNote && (
                      <p className="mt-1 text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-md px-2 py-1">
                        {item.verificationNote}
                      </p>
                    )}
                    {item.verifiedBy && item.lastVerifiedAt && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Revisión registrada por {item.verifiedBy} · {formatVerifiedDate(item.lastVerifiedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge color="purple">{item.moduleLabel}</Badge>
                    {item.species.map((sp) => (
                      <Badge key={sp} color="yellow">
                        {SPECIES_LABELS[sp] || sp}
                      </Badge>
                    ))}
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 mb-1.5">
                          Referencias técnicas y umbrales clave
                        </p>
                        <ul className="space-y-1 text-slate-700 list-disc pl-4">
                          {item.keyReferences.map((refLine, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {refLine}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="font-semibold text-slate-800 mb-1.5">
                          Lista de chequeo en granja
                        </p>
                        <ul className="space-y-1.5 text-slate-700">
                          {item.complianceChecklist.map((checkLine, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{checkLine}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {item.ginaPrompts.length > 0 && (
                        <div className="pt-1 border-t border-slate-200/80">
                          <p className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            Preguntas rápidas para Gina sobre esta referencia
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.ginaPrompts.map((promptText, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  askGinaWithContext({
                                    prompt: promptText,
                                    referenceContext: item,
                                  })
                                }
                                className="text-left rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 transition-colors"
                              >
                                “{promptText}”
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isAttachOpen && (
                    <div className="pt-1">
                      <AttachmentPanel
                        entityType="normative_doc"
                        entityId={item.id}
                        defaultCategory="norma_guia"
                        title={`Adjuntos de ${item.code}`}
                        helpText="Adjunte el PDF oficial de la norma o guía, instructivos internos, certificados o fotos de señalización en galpón (PDF hasta 1.5 MB o imágenes comprimidas)."
                      />
                    </div>
                  )}
                  {item.isCustom && onReviewCustomItem && reviewOpenMap[item.id] && (
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                      <p className="text-xs font-semibold text-amber-950">
                        Registra la revisión de esta versión. El sistema guardará quién la hizo y cuándo.
                      </p>
                      <Select
                        label="Estado de la revisión"
                        value={reviewStatusMap[item.id] || item.verificationStatus}
                        onChange={(event) => setReviewStatusMap((current) => ({
                          ...current,
                          [item.id]: event.target.value as NormativeVerificationStatus,
                        }))}
                      >
                        <option value="pendiente">Pendiente de revisar</option>
                        <option value="verificado">Vigente y revisada</option>
                        <option value="reemplazado">Reemplazada por otra versión</option>
                        <option value="derogado">Derogada</option>
                      </Select>
                      <Textarea
                        label="Fuente consultada o resultado *"
                        rows={2}
                        value={reviewNoteMap[item.id] || ""}
                        onChange={(event) => setReviewNoteMap((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Ej.: Resolución publicada por ICA; revisé los artículos aplicables a postura."
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => setReviewOpenMap((current) => ({ ...current, [item.id]: false }))} className="px-3 py-1.5 text-xs">
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          disabled={busy || (reviewNoteMap[item.id] || "").trim().length < 10}
                          onClick={async () => {
                            try {
                              await onReviewCustomItem(
                                item.id,
                                reviewStatusMap[item.id] || item.verificationStatus,
                                (reviewNoteMap[item.id] || "").trim(),
                              );
                              setReviewOpenMap((current) => ({ ...current, [item.id]: false }));
                              setReviewNoteMap((current) => ({ ...current, [item.id]: "" }));
                            } catch {
                              // The catalog tab shows the save error; keep the review form open.
                            }
                          }}
                          className="px-3 py-1.5 text-xs"
                        >
                          Guardar revisión
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleAskGinaGeneral(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Consultar con Gina
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleAttachmentsPanel(item.id)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isAttachOpen || attachCount > 0
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {attachCount > 0 ? `Adjuntos (${attachCount})` : "Incluir adjunto"}
                    </button>
                    {item.isCustom && onReviewCustomItem && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewStatusMap((current) => ({ ...current, [item.id]: current[item.id] || item.verificationStatus }));
                          setReviewOpenMap((current) => ({ ...current, [item.id]: !current[item.id] }));
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {item.verificationStatus === "pendiente" ? "Registrar revisión" : "Actualizar revisión"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleItemExpanded(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Ocultar detalle
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          Ver referencias ({item.keyReferences.length})
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Link
                      href={item.appRoute}
                      className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      {item.appRouteLabel}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                    {hasExternalUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 hover:underline"
                        title={item.sourceLabel}
                      >
                        Fuente oficial
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Agregar norma, estándar o guía al catálogo"
      >
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Las referencias nuevas quedan pendientes hasta que una persona contraste la versión con su fuente y registre la revisión.
          </p>
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Código / Referencia *"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Ej: POE-BIO-02 / Res. ICA"
            />
            <Select
              label="Clasificación *"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as NormativeDocumentKind)}
            >
              <option value="norma">Norma obligatoria</option>
              <option value="estandar">Estándar técnico</option>
              <option value="guia">Guía de manejo</option>
            </Select>
          </div>

          <Input
            label="Título del documento o guía *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ej: Protocolo de limpieza de bebederos y control de amoníaco"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Entidad o autor emisor"
              value={newAuthority}
              onChange={(e) => setNewAuthority(e.target.value)}
              placeholder="Ej: ICA / FENAVI / Granja"
            />
            <Input
              label="Versión / año"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              placeholder="Ej: Vigente 2026"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Módulo relacionado en la app"
              value={newModuleIdx}
              onChange={(e) => setNewModuleIdx(Number(e.target.value))}
            >
              {MODULE_OPTIONS.map((opt, idx) => (
                <option key={opt.appRoute} value={idx}>
                  {opt.moduleLabel}
                </option>
              ))}
            </Select>
            <Input
              label="Enlace web oficial (opcional)"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-slate-700 mb-1.5">
              Especies aplicables
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SPECIES_LABELS).map(([key, label]) => {
                const selected = newSpecies.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleNewSpecies(key)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Textarea
            label="Resumen y alcance operativo"
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            rows={2}
            placeholder="Describe brevemente qué regula o estandariza este documento..."
          />

          <Textarea
            label="Umbrales o referencias clave (una por línea)"
            value={newKeyRefs}
            onChange={(e) => setNewKeyRefs(e.target.value)}
            rows={2}
            placeholder="Ej: Mantener NH3 < 15 ppm en cama&#10;Desinfección cada 21 días de vacío sanitario"
          />

          <Textarea
            label="Lista de chequeo en granja (una por línea)"
            value={newChecklist}
            onChange={(e) => setNewChecklist(e.target.value)}
            rows={2}
            placeholder="Ej: Registrar fecha y producto aplicado&#10;Verificar almacenamiento del biológico entre 2 y 8 °C"
          />

          <AttachmentPanel
            entityType="normative_doc"
            entityId={draftEntityId}
            defaultCategory="norma_guia"
            title="Adjuntar PDF oficial, guía o foto soporte"
            helpText="Sube aquí la resolución en PDF, ficha técnica o instructivo. Quedará vinculado automáticamente al guardar."
            compact
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={savingCustom}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleCreateCustomItem()}
              disabled={savingCustom}
            >
              {savingCustom ? "Guardando..." : "Guardar en catálogo"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

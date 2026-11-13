"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Power,
  Receipt,
  Trash2,
  User,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, StatCard } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import ContactFormModal from "@/components/contacts/ContactFormModal";
import {
  PERSON_TYPE_LABELS,
  ROLE_LABELS,
  buildWhatsAppUrl,
  contactMatchesRole,
  formatContactLocation,
  getContactCompleteness,
  getPaymentMethodLabel,
  type ContactRecord,
  type ContactRole,
} from "@/lib/contacts-shared";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { useActionQuery } from "@/lib/useActionQuery";
import { notifyContactsChanged, useContacts } from "@/lib/useContacts";

interface ContactsDirectoryProps {
  initialRole?: "all" | "cliente" | "proveedor" | "ambos";
  embedded?: boolean;
  actionNuevo?: string | null;
}

const fmtMoney = (n: number | undefined | null) =>
  `$${Math.round(Number(n || 0)).toLocaleString()}`;

const dateFmt = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    return new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("es", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

function roleBadgeColor(role: string): "green" | "blue" | "purple" | "gray" {
  if (role === "cliente") return "green";
  if (role === "proveedor") return "blue";
  if (role === "ambos") return "purple";
  return "gray";
}

function resolveDefaultModalRole(roleFilter: "all" | "cliente" | "proveedor" | "ambos"): ContactRole {
  if (roleFilter === "proveedor") return "proveedor";
  if (roleFilter === "ambos") return "ambos";
  return "cliente";
}

export default function ContactsDirectory({
  initialRole = "all",
  embedded = false,
  actionNuevo = null,
}: ContactsDirectoryProps) {
  const { allContacts, loading, reload } = useContacts("all", {
    includeStats: true,
    includeInactive: true,
  });

  const [roleOverride, setRoleOverride] = useState<{
    base: "all" | "cliente" | "proveedor" | "ambos";
    value: "all" | "cliente" | "proveedor" | "ambos";
  } | null>(null);
  const roleFilter = roleOverride && roleOverride.base === initialRole ? roleOverride.value : initialRole;
  const setRoleFilter = useCallback(
    (value: "all" | "cliente" | "proveedor" | "ambos") => {
      setRoleOverride({ base: initialRole, value });
    },
    [initialRole],
  );
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaultRole, setFormDefaultRole] = useState<ContactRole>(resolveDefaultModalRole(initialRole));
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const [detailContact, setDetailContact] = useState<ContactRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreateModal = useCallback(
    (forcedRole?: ContactRole) => {
      setEditingContact(null);
      setFormDefaultRole(forcedRole || resolveDefaultModalRole(roleFilter));
      setFormOpen(true);
    },
    [roleFilter],
  );

  const actionHandlers = useMemo(
    () => ({
      cliente: () => openCreateModal("cliente"),
      proveedor: () => openCreateModal("proveedor"),
      ambos: () => openCreateModal("ambos"),
      "1": () => openCreateModal(),
      true: () => openCreateModal(),
    }),
    [openCreateModal],
  );

  useActionQuery(actionNuevo, actionHandlers);

  const activeContacts = useMemo(
    () => allContacts.filter((c) => c.isActive !== false),
    [allContacts],
  );

  const metrics = useMemo(() => {
    const clients = activeContacts.filter((c) => contactMatchesRole(c.role, "cliente"));
    const suppliers = activeContacts.filter((c) => contactMatchesRole(c.role, "proveedor"));
    const both = activeContacts.filter((c) => c.role === "ambos");
    const totalReceivable = activeContacts.reduce(
      (sum, c) => sum + (c.stats?.receivablePending || 0),
      0,
    );
    const totalPayable = activeContacts.reduce(
      (sum, c) => sum + (c.stats?.payablePending || 0),
      0,
    );
    const incomplete = activeContacts.filter((c) => getContactCompleteness(c).scorePct < 75).length;
    const inactiveCount = allContacts.length - activeContacts.length;
    return {
      totalActive: activeContacts.length,
      clientsCount: clients.length,
      suppliersCount: suppliers.length,
      bothCount: both.length,
      totalReceivable,
      totalPayable,
      incomplete,
      inactiveCount,
    };
  }, [activeContacts, allContacts.length]);

  const filteredContacts = useMemo(() => {
    return allContacts.filter((c) => {
      if (statusFilter === "active" && c.isActive === false) return false;
      if (statusFilter === "inactive" && c.isActive !== false) return false;
      if (!contactMatchesRole(c.role, roleFilter)) return false;
      if (!search.trim()) return true;
      return matchesTextQuery(search, [
        c.name,
        c.contactName,
        c.documentType,
        c.documentNumber,
        c.phone,
        c.whatsapp,
        c.email,
        c.address,
        c.city,
        c.department,
        c.zone,
        c.locationNotes,
        c.categoryTag,
        c.deliverySchedule,
        c.notes,
        ROLE_LABELS[c.role as ContactRole] || c.role,
      ]);
    });
  }, [allContacts, roleFilter, statusFilter, search]);

  const handleEdit = (contact: ContactRecord) => {
    setEditingContact(contact);
    setFormDefaultRole(
      (["cliente", "proveedor", "ambos"].includes(contact.role)
        ? contact.role
        : "cliente") as ContactRole,
    );
    setFormOpen(true);
  };

  const handleToggleActive = async (contact: ContactRecord) => {
    setBusyId(contact.id);
    setFeedback(null);
    try {
      const res = await apiFetch("/api/contactos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id, isActive: contact.isActive === false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeedback({ type: "error", text: data.error || "No se pudo actualizar el estado." });
        return;
      }
      const updated: ContactRecord = await res.json();
      if (detailContact?.id === updated.id) {
        setDetailContact(updated);
      }
      notifyContactsChanged(updated);
      reload();
      setFeedback({
        type: "ok",
        text: updated.isActive !== false
          ? `«${updated.name}» quedó activo nuevamente.`
          : `«${updated.name}» quedó inactivo (se conserva su historial).`,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (contact: ContactRecord) => {
    const opsCount =
      (contact.stats?.salesCount || 0) +
      (contact.stats?.purchasesCount || 0) +
      (contact.stats?.associatedCatalogItems || 0);

    const confirmText =
      opsCount > 0
        ? `«${contact.name}» tiene historial registrado. Se desactivará para conservar trazabilidad contable y operativa. ¿Continuar?`
        : `¿Eliminar permanentemente a «${contact.name}» del directorio?`;

    if (!confirm(confirmText)) return;

    setBusyId(contact.id);
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/contactos?id=${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "No se pudo eliminar el contacto." });
        return;
      }
      if (detailContact?.id === contact.id) {
        setDetailContact(null);
      }
      notifyContactsChanged();
      reload();
      setFeedback({
        type: "ok",
        text: data.deactivated
          ? `«${contact.name}» tenía operaciones históricas, por lo que fue desactivado para no perder su historial.`
          : `«${contact.name}» eliminado del directorio.`,
      });
    } finally {
      setBusyId(null);
    }
  };

  const renderDirectLinks = (contact: ContactRecord) => {
    const waUrl = buildWhatsAppUrl(contact.whatsapp || contact.phone);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {contact.phone && (
          <a
            href={`tel:${contact.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            title={`Llamar a ${contact.phone}`}
          >
            <Phone className="w-3 h-3 text-slate-500" />
            <span>{contact.phone}</span>
          </a>
        )}
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            title="Escribir por WhatsApp"
          >
            <MessageCircle className="w-3 h-3" />
            <span>WhatsApp</span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            title={`Enviar correo a ${contact.email}`}
          >
            <Mail className="w-3 h-3" />
            <span className="truncate max-w-[140px]">{contact.email}</span>
          </a>
        )}
        {!contact.phone && !waUrl && !contact.email && (
          <span className="text-xs text-slate-400 italic">Sin teléfono ni correo</span>
        )}
      </div>
    );
  };

  const renderActions = (contact: ContactRecord) => {
    const isBusy = busyId === contact.id;
    return (
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setDetailContact(contact)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="Ver ficha completa"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Ficha</span>
        </button>
        <button
          type="button"
          onClick={() => handleEdit(contact)}
          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
          title="Editar datos de contacto y ubicación"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Editar</span>
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleToggleActive(contact)}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
            contact.isActive === false
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
          }`}
          title={contact.isActive === false ? "Reactivar contacto" : "Desactivar contacto"}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{contact.isActive === false ? "Activar" : "Desactivar"}</span>
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleDelete(contact)}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          title="Eliminar o desactivar si tiene historial"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 ${embedded ? "" : ""}`}>
        <StatCard
          icon="users"
          label="Contactos activos"
          value={metrics.totalActive}
          color="blue"
        />
        <StatCard
          icon="incoming"
          label="Clientes · CxC pendiente"
          value={`${metrics.clientsCount} · ${fmtMoney(metrics.totalReceivable)}`}
          color="green"
        />
        <StatCard
          icon="outgoing"
          label="Proveedores · CxP pendiente"
          value={`${metrics.suppliersCount} · ${fmtMoney(metrics.totalPayable)}`}
          color="earth"
        />
        <StatCard
          icon={metrics.incomplete > 0 ? "alert" : "check-circle"}
          label="Por completar ficha"
          value={metrics.incomplete}
          color={metrics.incomplete > 0 ? "yellow" : "purple"}
        />
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline"
          >
            Ocultar
          </button>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-4 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all" as const, label: `Todos (${metrics.totalActive})` },
                { key: "cliente" as const, label: `Clientes (${metrics.clientsCount})` },
                { key: "proveedor" as const, label: `Proveedores (${metrics.suppliersCount})` },
                { key: "ambos" as const, label: `Ambos (${metrics.bothCount})` },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRoleFilter(item.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    roleFilter === item.key
                      ? "bg-green-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                {[
                  { key: "active" as const, label: "Activos" },
                  { key: "inactive" as const, label: `Inactivos (${metrics.inactiveCount})` },
                  { key: "all" as const, label: "Todos" },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setStatusFilter(st.key)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      statusFilter === st.key
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <Button onClick={() => openCreateModal()}>
                <Plus className="w-4 h-4 mr-1 inline" />
                Nuevo cliente / proveedor
              </Button>
            </div>
          </div>

          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, documento, teléfono, ciudad, zona, categoría..."
            resultCount={filteredContacts.length}
            totalCount={allContacts.length}
          />
        </div>

        {loading ? (
          <p className="text-center py-10 text-slate-400">Cargando directorio de contactos...</p>
        ) : filteredContacts.length === 0 ? (
          <div className="pb-8">
            <EmptyState
              icon="handshake"
              message={
                search.trim()
                  ? "Sin coincidencias para esta búsqueda. Crea una ficha con teléfono, WhatsApp, ubicación y plazo de pago."
                  : "Sin clientes ni proveedores en este filtro. Crea una ficha para usarla en ventas, compras y cuentas."
              }
            />
            <div className="flex justify-center -mt-4">
              <Button onClick={() => openCreateModal()}>
                + Nuevo cliente / proveedor
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Vista escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 bg-slate-50">
                    <th className="py-3 px-3">Contacto / Rol</th>
                    <th className="py-3 px-3">Comunicación directa</th>
                    <th className="py-3 px-3">Localización</th>
                    <th className="py-3 px-3">Condiciones y operación</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContacts.map((contact) => {
                    const completeness = getContactCompleteness(contact);
                    const location = formatContactLocation(contact);
                    const stats = contact.stats;
                    return (
                      <tr
                        key={contact.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          contact.isActive === false ? "opacity-65 bg-slate-50/40" : ""
                        }`}
                      >
                        <td className="py-3 px-3 align-top">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 rounded-lg bg-slate-100 p-1.5 text-slate-600">
                              {contact.personType === "juridica" ? (
                                <Building2 className="w-4 h-4" />
                              ) : (
                                <User className="w-4 h-4" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDetailContact(contact)}
                                  className="font-semibold text-slate-900 hover:text-green-700 text-left cursor-pointer"
                                >
                                  {contact.name}
                                </button>
                                <Badge color={roleBadgeColor(contact.role)}>
                                  {ROLE_LABELS[contact.role as ContactRole] || contact.role}
                                </Badge>
                                {contact.isActive === false && <Badge color="gray">Inactivo</Badge>}
                                {contact._offlinePending && <Badge color="yellow">Pendiente sync</Badge>}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                {contact.documentNumber && (
                                  <span>
                                    {contact.documentType || "Doc"}: {contact.documentNumber}
                                  </span>
                                )}
                                {contact.categoryTag && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                                    {contact.categoryTag}
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center gap-1 font-medium ${
                                    completeness.scorePct >= 75 ? "text-emerald-700" : "text-amber-700"
                                  }`}
                                  title={
                                    completeness.missingFields.length > 0
                                      ? `Falta: ${completeness.missingFields.join(", ")}`
                                      : "Ficha completa"
                                  }
                                >
                                  {completeness.scorePct >= 75 ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : (
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  )}
                                  {completeness.scorePct}% ficha
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top">
                          <div className="space-y-1">
                            {contact.contactName && (
                              <p className="text-xs font-medium text-slate-700">
                                Encargado: {contact.contactName}
                              </p>
                            )}
                            {renderDirectLinks(contact)}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top">
                          {location || contact.address || contact.deliverySchedule ? (
                            <div className="space-y-0.5 text-xs text-slate-600">
                              {location && (
                                <p className="inline-flex items-center gap-1 font-medium text-slate-800">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{location}</span>
                                </p>
                              )}
                              {contact.address && <p className="text-slate-600">{contact.address}</p>}
                              {contact.deliverySchedule && (
                                <p className="inline-flex items-center gap-1 text-slate-500">
                                  <CalendarClock className="w-3 h-3 shrink-0" />
                                  <span>{contact.deliverySchedule}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin ubicación</span>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top">
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                              {contact.paymentMethod && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium">
                                  <Receipt className="w-3 h-3 text-slate-500" />
                                  {getPaymentMethodLabel(contact.paymentMethod)}
                                </span>
                              )}
                              {contact.creditDays > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                                  <Clock className="w-3 h-3" />
                                  {contact.creditDays}d plazo
                                </span>
                              )}
                            </div>

                            {stats && (
                              <div className="space-y-0.5 text-slate-500">
                                {stats.salesCount > 0 && (
                                  <p>
                                    Ventas: <strong className="text-slate-700">{stats.salesCount}</strong> ({fmtMoney(stats.totalSalesAmount)})
                                  </p>
                                )}
                                {stats.purchasesCount > 0 && (
                                  <p>
                                    Compras: <strong className="text-slate-700">{stats.purchasesCount}</strong> ({fmtMoney(stats.totalPurchasesAmount)})
                                  </p>
                                )}
                                {stats.receivablePending > 0 && (
                                  <p className="text-emerald-700 font-medium">
                                    CxC: {fmtMoney(stats.receivablePending)}
                                    {stats.overdueReceivables > 0 && (
                                      <span className="ml-1 text-red-600">
                                        ({stats.overdueReceivables} vencida{stats.overdueReceivables > 1 ? "s" : ""})
                                      </span>
                                    )}
                                  </p>
                                )}
                                {stats.payablePending > 0 && (
                                  <p className="text-red-700 font-medium">
                                    CxP: {fmtMoney(stats.payablePending)}
                                    {stats.overduePayables > 0 && (
                                      <span className="ml-1 text-red-700 font-bold">
                                        ({stats.overduePayables} vencida{stats.overduePayables > 1 ? "s" : ""})
                                      </span>
                                    )}
                                  </p>
                                )}
                                {stats.associatedCatalogItems > 0 && (
                                  <p>{stats.associatedCatalogItems} producto(s)/insumo(s) asociados</p>
                                )}
                                {stats.salesCount === 0 &&
                                  stats.purchasesCount === 0 &&
                                  stats.associatedCatalogItems === 0 && (
                                    <span className="text-slate-400">Sin movimientos registrados</span>
                                  )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right">
                          <div className="flex justify-end">{renderActions(contact)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista móvil */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredContacts.map((contact) => {
                const completeness = getContactCompleteness(contact);
                const location = formatContactLocation(contact);
                const stats = contact.stats;
                return (
                  <div
                    key={contact.id}
                    className={`rounded-xl border border-slate-200 p-4 space-y-3 ${
                      contact.isActive === false ? "bg-slate-50 opacity-70" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => setDetailContact(contact)}
                          className="font-semibold text-slate-900 text-left"
                        >
                          {contact.name}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge color={roleBadgeColor(contact.role)}>
                            {ROLE_LABELS[contact.role as ContactRole] || contact.role}
                          </Badge>
                          {contact.categoryTag && <Badge color="gray">{contact.categoryTag}</Badge>}
                          {contact.isActive === false && <Badge color="gray">Inactivo</Badge>}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          completeness.scorePct >= 75 ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {completeness.scorePct}%
                      </span>
                    </div>

                    {renderDirectLinks(contact)}

                    {(location || contact.address) && (
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{[location, contact.address].filter(Boolean).join(" · ")}</span>
                      </p>
                    )}

                    {(contact.creditDays > 0 || (stats && (stats.receivablePending > 0 || stats.payablePending > 0))) && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {contact.creditDays > 0 && <Badge color="blue">{contact.creditDays}d plazo</Badge>}
                        {stats && stats.receivablePending > 0 && (
                          <Badge color="green">CxC: {fmtMoney(stats.receivablePending)}</Badge>
                        )}
                        {stats && stats.payablePending > 0 && (
                          <Badge color="red">CxP: {fmtMoney(stats.payablePending)}</Badge>
                        )}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100">{renderActions(contact)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <ContactFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingContact(null);
        }}
        initialContact={editingContact}
        defaultRole={formDefaultRole}
        onSaved={(saved) => {
          reload();
          if (detailContact?.id === saved.id) {
            setDetailContact(saved);
          }
          setFeedback({
            type: "ok",
            text: `Ficha de «${saved.name}» guardada correctamente.`,
          });
        }}
      />

      {/* Modal de ficha detallada */}
      <Modal
        open={Boolean(detailContact)}
        onClose={() => setDetailContact(null)}
        title={detailContact ? `Ficha: ${detailContact.name}` : "Ficha de contacto"}
      >
        {detailContact && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={roleBadgeColor(detailContact.role)}>
                  {ROLE_LABELS[detailContact.role as ContactRole] || detailContact.role}
                </Badge>
                <Badge color="gray">
                  {PERSON_TYPE_LABELS[(detailContact.personType as "natural" | "juridica") || "natural"] ||
                    detailContact.personType}
                </Badge>
                {detailContact.categoryTag && <Badge color="blue">{detailContact.categoryTag}</Badge>}
                {detailContact.isActive === false && <Badge color="red">Inactivo</Badge>}
              </div>
              <span className="text-xs text-slate-500">
                Completitud: <strong>{getContactCompleteness(detailContact).scorePct}%</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Identificación y contacto
                </p>
                <p>
                  <span className="text-slate-500">Documento: </span>
                  <strong>
                    {detailContact.documentNumber
                      ? `${detailContact.documentType || ""} ${detailContact.documentNumber}`.trim()
                      : "Sin registrar"}
                  </strong>
                </p>
                <p>
                  <span className="text-slate-500">Encargado: </span>
                  <strong>{detailContact.contactName || "—"}</strong>
                </p>
                <div className="pt-1">{renderDirectLinks(detailContact)}</div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Localización y entrega
                </p>
                <p>
                  <span className="text-slate-500">Municipio / Zona: </span>
                  <strong>{formatContactLocation(detailContact) || "Sin registrar"}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Dirección / Finca: </span>
                  <strong>{detailContact.address || "—"}</strong>
                </p>
                {detailContact.locationNotes && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
                    {detailContact.locationNotes}
                  </p>
                )}
                {detailContact.deliverySchedule && (
                  <p className="text-xs text-slate-600">
                    <span className="font-medium">Horario / Ruta:</span> {detailContact.deliverySchedule}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Condiciones comerciales y resumen operativo
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Pago habitual</p>
                  <p className="font-medium text-slate-900">
                    {getPaymentMethodLabel(detailContact.paymentMethod) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Plazo de crédito</p>
                  <p className="font-medium text-slate-900">
                    {detailContact.creditDays > 0 ? `${detailContact.creditDays} días` : "Contado (0d)"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ventas / CxC</p>
                  <p className="font-medium text-emerald-700">
                    {fmtMoney(detailContact.stats?.totalSalesAmount)} ({detailContact.stats?.salesCount || 0})
                  </p>
                  {(detailContact.stats?.receivablePending || 0) > 0 && (
                    <p className="text-xs text-emerald-700">
                      Pendiente: {fmtMoney(detailContact.stats?.receivablePending)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Compras / CxP</p>
                  <p className="font-medium text-blue-700">
                    {fmtMoney(detailContact.stats?.totalPurchasesAmount)} ({detailContact.stats?.purchasesCount || 0})
                  </p>
                  {(detailContact.stats?.payablePending || 0) > 0 && (
                    <p className="text-xs text-red-600">
                      Pendiente: {fmtMoney(detailContact.stats?.payablePending)}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Última actividad registrada:{" "}
                <strong className="text-slate-700">{dateFmt(detailContact.stats?.lastActivityDate)}</strong>
                {" · "}
                Ítems de inventario/alimento/productos asociados:{" "}
                <strong className="text-slate-700">{detailContact.stats?.associatedCatalogItems || 0}</strong>
              </p>
              {detailContact.notes && (
                <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 whitespace-pre-wrap">
                  {detailContact.notes}
                </div>
              )}
            </div>

            {getContactCompleteness(detailContact).missingFields.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Campos sugeridos por completar:{" "}
                <strong>{getContactCompleteness(detailContact).missingFields.join(", ")}</strong>.
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
              <Link
                href="/dashboard/finanzas/cuentas"
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Ver cuentas por cobrar / pagar →
              </Link>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setDetailContact(null)}>
                  Cerrar
                </Button>
                <Button
                  onClick={() => {
                    const target = detailContact;
                    setDetailContact(null);
                    handleEdit(target);
                  }}
                >
                  Editar ficha
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

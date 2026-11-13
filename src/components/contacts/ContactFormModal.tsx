"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, MapPin, Phone, Receipt, User, X } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import {
  CLIENT_CATEGORY_SUGGESTIONS,
  DOCUMENT_TYPES,
  PAYMENT_METHODS,
  SUPPLIER_CATEGORY_SUGGESTIONS,
  type ContactRecord,
  type ContactRole,
  type PersonType,
} from "@/lib/contacts-shared";
import { notifyContactsChanged } from "@/lib/useContacts";
import AttachmentPanel from "@/components/attachments/AttachmentPanel";
import {
  bindDraftAttachments,
  createDraftEntityId,
  type OcrExtractedPayload,
} from "@/lib/attachments-shared";

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  initialContact?: ContactRecord | null;
  defaultRole?: ContactRole;
  initialName?: string;
  onSaved?: (contact: ContactRecord) => void;
}

interface FormState {
  name: string;
  role: ContactRole;
  personType: PersonType;
  documentType: string;
  documentNumber: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  department: string;
  zone: string;
  locationNotes: string;
  categoryTag: string;
  paymentMethod: string;
  creditDays: string;
  deliverySchedule: string;
  notes: string;
  isActive: boolean;
}

function buildInitialState(
  contact: ContactRecord | null | undefined,
  defaultRole: ContactRole,
  initialName: string,
): FormState {
  if (contact) {
    return {
      name: contact.name,
      role: (["cliente", "proveedor", "ambos"].includes(contact.role) ? contact.role : defaultRole) as ContactRole,
      personType: contact.personType === "juridica" ? "juridica" : "natural",
      documentType: contact.documentType || "CC",
      documentNumber: contact.documentNumber || "",
      contactName: contact.contactName || "",
      phone: contact.phone || "",
      whatsapp: contact.whatsapp || "",
      email: contact.email || "",
      address: contact.address || "",
      city: contact.city || "",
      department: contact.department || "",
      zone: contact.zone || "",
      locationNotes: contact.locationNotes || "",
      categoryTag: contact.categoryTag || "",
      paymentMethod: contact.paymentMethod || "contado",
      creditDays: String(contact.creditDays ?? 0),
      deliverySchedule: contact.deliverySchedule || "",
      notes: contact.notes || "",
      isActive: contact.isActive !== false,
    };
  }

  return {
    name: initialName,
    role: defaultRole,
    personType: "natural",
    documentType: "CC",
    documentNumber: "",
    contactName: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    department: "",
    zone: "",
    locationNotes: "",
    categoryTag: "",
    paymentMethod: "contado",
    creditDays: "0",
    deliverySchedule: "",
    notes: "",
    isActive: true,
  };
}

export default function ContactFormModal(props: ContactFormModalProps) {
  if (!props.open || typeof document === "undefined") return null;
  const resetKey = `${props.initialContact?.id ?? "new"}-${props.defaultRole ?? "cliente"}-${props.initialName ?? ""}`;
  return <ContactFormModalBody key={resetKey} {...props} />;
}

function ContactFormModalBody({
  onClose,
  initialContact = null,
  defaultRole = "cliente",
  initialName = "",
  onSaved,
}: ContactFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(initialContact, defaultRole, initialName),
  );
  const [draftContactId] = useState(() => createDraftEntityId("contact"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflictContact, setConflictContact] = useState<ContactRecord | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  const isEditing = Boolean(initialContact?.id);
  const tagSuggestions =
    form.role === "proveedor"
      ? SUPPLIER_CATEGORY_SUGGESTIONS
      : form.role === "cliente"
        ? CLIENT_CATEGORY_SUGGESTIONS
        : [...CLIENT_CATEGORY_SUGGESTIONS.slice(0, 3), ...SUPPLIER_CATEGORY_SUGGESTIONS.slice(0, 3)];

  const submitPayload = async (mergeIfExists = false) => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("El nombre o razón social es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setConflictContact(null);

    try {
      const payload = {
        ...(isEditing ? { id: initialContact!.id } : {}),
        name: trimmedName,
        role: form.role,
        personType: form.personType,
        documentType: form.documentNumber.trim() ? form.documentType : null,
        documentNumber: form.documentNumber.trim() || null,
        contactName: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        department: form.department.trim() || null,
        zone: form.zone.trim() || null,
        locationNotes: form.locationNotes.trim() || null,
        categoryTag: form.categoryTag.trim() || null,
        paymentMethod: form.paymentMethod || null,
        creditDays: Number(form.creditDays || 0),
        deliverySchedule: form.deliverySchedule.trim() || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
        ...(mergeIfExists ? { mergeIfExists: true } : {}),
      };

      const res = await apiFetch("/api/contactos", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data?.existingContact) {
          setConflictContact(data.existingContact as ContactRecord);
        }
        setError(data?.error || "No se pudo guardar el contacto.");
        return;
      }

      const savedRecord: ContactRecord =
        res.status === 202
          ? {
              id: initialContact?.id || `offline-${Date.now()}`,
              name: trimmedName,
              role: form.role,
              personType: form.personType,
              documentType: payload.documentType,
              documentNumber: payload.documentNumber,
              contactName: payload.contactName,
              phone: payload.phone,
              whatsapp: payload.whatsapp,
              email: payload.email,
              address: payload.address,
              city: payload.city,
              department: payload.department,
              zone: payload.zone,
              locationNotes: payload.locationNotes,
              categoryTag: payload.categoryTag,
              paymentMethod: payload.paymentMethod,
              creditDays: Number(form.creditDays || 0),
              deliverySchedule: payload.deliverySchedule,
              notes: payload.notes,
              isActive: form.isActive,
              _offlinePending: true,
            }
          : (data as ContactRecord);

      if (!isEditing && savedRecord.id && !savedRecord.id.startsWith("offline-")) {
        await bindDraftAttachments(draftContactId, savedRecord.id, "contact");
      }
      notifyContactsChanged(savedRecord);
      onSaved?.(savedRecord);
      onClose();
    } catch {
      setError("Error de conexión al guardar el contacto.");
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = isEditing
    ? `Editar contacto: ${initialContact?.name}`
    : form.role === "proveedor"
      ? "Nuevo proveedor"
      : form.role === "ambos"
        ? "Nuevo cliente y proveedor"
        : "Nuevo cliente";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{modalTitle}</h2>
            <p className="text-xs text-slate-500">
              Registra datos de contacto, ubicación y condiciones comerciales para agilizar ventas, compras y cobros.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitPayload(false);
          }}
          className="space-y-5 p-5"
        >
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-2">
              <p>{error}</p>
              {conflictContact && !isEditing && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {conflictContact.role !== form.role && conflictContact.role !== "ambos" && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void submitPayload(true)}
                      className="text-xs py-1.5 px-3"
                    >
                      Convertir a Cliente y Proveedor y usar aquí
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onSaved?.(conflictContact);
                      onClose();
                    }}
                    className="text-xs py-1.5 px-3"
                  >
                    Seleccionar el existente
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sección 1: Identificación y rol */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {form.personType === "juridica" ? (
                <Building2 className="h-4 w-4 text-green-700" aria-hidden="true" />
              ) : (
                <User className="h-4 w-4 text-green-700" aria-hidden="true" />
              )}
              <span>Identificación y relación comercial</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Nombre o razón social *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.role === "proveedor" ? "Ej: Agropecuaria El Campo" : "Ej: Tienda La Esquina / Don Carlos"}
                required
                autoFocus
              />
              <Select
                label="Relación con la granja"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as ContactRole })}
              >
                <option value="cliente">Cliente (nos compra)</option>
                <option value="proveedor">Proveedor (nos vende / presta servicio)</option>
                <option value="ambos">Cliente y Proveedor (ambos)</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="Tipo de persona"
                value={form.personType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    personType: e.target.value as PersonType,
                    documentType: e.target.value === "juridica" && form.documentType === "CC" ? "NIT" : form.documentType,
                  })
                }
              >
                <option value="natural">Persona natural</option>
                <option value="juridica">Empresa / Jurídica</option>
              </Select>
              <Select
                label="Tipo doc."
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </Select>
              <Input
                label="Número de documento / NIT"
                value={form.documentNumber}
                onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                placeholder="Ej: 900123456-7"
              />
            </div>

            <div className="space-y-1.5">
              <Input
                label="Categoría o segmento comercial"
                value={form.categoryTag}
                onChange={(e) => setForm({ ...form, categoryTag: e.target.value })}
                placeholder="Ej: Mayorista, Tienda, Veterinaria, Alimentos..."
              />
              <div className="flex flex-wrap gap-1.5">
                {tagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setForm({ ...form, categoryTag: tag })}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      form.categoryTag === tag
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sección 2: Datos de contacto */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <Phone className="h-4 w-4 text-green-700" aria-hidden="true" />
              <span>Datos de contacto</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Teléfono principal"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: 310 555 1234"
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">WhatsApp</label>
                  {form.phone.trim() && form.whatsapp.trim() !== form.phone.trim() && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, whatsapp: form.phone.trim() })}
                      className="text-[11px] font-medium text-green-700 hover:underline"
                    >
                      Copiar del teléfono
                    </button>
                  )}
                </div>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="Ej: 310 555 1234"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Persona de contacto / encargado"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="Ej: María Gómez (pedidos)"
              />
              <Input
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Ej: pedidos@ejemplo.com"
              />
            </div>
          </div>

          {/* Sección 3: Localización */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <MapPin className="h-4 w-4 text-green-700" aria-hidden="true" />
              <span>Localización y ruta de entrega</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Municipio / Ciudad"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ej: Rionegro"
              />
              <Input
                label="Departamento"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Ej: Antioquia"
              />
              <Input
                label="Vereda / Barrio / Zona"
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                placeholder="Ej: Vereda El Tablazo / Centro"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Dirección o nombre del local / finca"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Ej: Calle 45 # 12-30 / Finca El Mirador"
              />
              <Input
                label="Indicaciones de llegada / punto de entrega"
                value={form.locationNotes}
                onChange={(e) => setForm({ ...form, locationNotes: e.target.value })}
                placeholder="Ej: Portón verde frente a la escuela"
              />
            </div>
          </div>

          {/* Sección 4: Condiciones comerciales y notas */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <Receipt className="h-4 w-4 text-green-700" aria-hidden="true" />
              <span>Condiciones operativas y pagos</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="Forma de pago habitual"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Plazo de crédito (días)"
                type="number"
                min="0"
                max="365"
                value={form.creditDays}
                onChange={(e) => setForm({ ...form, creditDays: e.target.value })}
                help="Si es mayor a 0, sugiere automáticamente la fecha de vencimiento al marcar crédito."
              />
              <Input
                label="Frecuencia / horario"
                value={form.deliverySchedule}
                onChange={(e) => setForm({ ...form, deliverySchedule: e.target.value })}
                placeholder="Ej: Mar y Vie 7:00 AM"
              />
            </div>

            <Textarea
              label="Observaciones y acuerdos"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ej: Prefiere cubetas AA, recibe factura electrónica, entrega en bodega norte..."
              rows={2}
            />
          </div>

          <AttachmentPanel
            entityType="contact"
            entityId={initialContact?.id || draftContactId}
            defaultCategory="rut_documento"
            ocrMode="rut_contacto"
            onOcrExtracted={(extracted: OcrExtractedPayload) => {
              if (extracted.mode !== "rut_contacto") return;
              setForm((prev) => ({
                ...prev,
                name: prev.name || extracted.name || "",
                personType: extracted.personType || prev.personType,
                documentType: extracted.documentType || prev.documentType,
                documentNumber: extracted.documentNumber || prev.documentNumber,
                phone: extracted.phone || prev.phone,
                whatsapp: extracted.whatsapp || prev.whatsapp,
                email: extracted.email || prev.email,
                address: extracted.address || prev.address,
                city: extracted.city || prev.city,
                department: extracted.department || prev.department,
              }));
            }}
            title="RUT DIAN, Cédula o Certificado Bancario"
            helpText="Adjunta foto o PDF del RUT o documento para autocompletar NIT/Cédula, razón social, teléfono y municipio."
            compact
          />

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar contacto"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

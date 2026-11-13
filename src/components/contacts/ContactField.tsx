"use client";

import { useId, useMemo, useRef, useState } from "react";
import { MapPin, Pencil, Phone, Plus, UserCheck } from "lucide-react";
import { Tooltip } from "@/components/ui";
import { formatContactLocation, type ContactRecord } from "@/lib/contacts-shared";
import { findContactByName, useContacts } from "@/lib/useContacts";
import ContactFormModal from "./ContactFormModal";

interface ContactFieldProps {
  role: "cliente" | "proveedor";
  label: string;
  value: string;
  onChange: (name: string, matchedContact?: ContactRecord | null) => void;
  placeholder?: string;
  help?: string;
  required?: boolean;
  compact?: boolean;
  className?: string;
}

export default function ContactField({
  role,
  label,
  value,
  onChange,
  placeholder,
  help,
  required = false,
  compact = false,
  className = "",
}: ContactFieldProps) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const { contacts, reload } = useContacts(role);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);

  const matched = useMemo(() => findContactByName(contacts, value), [contacts, value]);

  const filteredContacts = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return contacts.slice(0, 12);
    return contacts
      .filter((c) => {
        const hay = `${c.name} ${c.contactName || ""} ${c.phone || ""} ${c.city || ""} ${c.zone || ""} ${c.categoryTag || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [contacts, value]);

  const defaultPlaceholder =
    placeholder ||
    (role === "cliente" ? "Nombre del cliente o tienda" : "Nombre del proveedor o agropecuaria");

  const buttonLabel = role === "cliente" ? "+ Cliente" : "+ Proveedor";
  const matchedLocation = matched ? formatContactLocation(matched) : "";
  const matchedPhone = matched?.phone || matched?.whatsapp || "";

  const openCreateModal = () => {
    setEditingContact(null);
    setDropdownOpen(false);
    setModalOpen(true);
  };

  const openEditModal = () => {
    if (!matched) return;
    setEditingContact(matched);
    setDropdownOpen(false);
    setModalOpen(true);
  };

  const handleSaved = (saved: ContactRecord) => {
    reload();
    onChange(saved.name, saved);
  };

  return (
    <div ref={containerRef} className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
        <span className="inline-flex items-center gap-1">
          <span>{label}</span>
          {help && <Tooltip text={help} />}
        </span>
      </label>

      <div className="relative">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <input
              id={inputId}
              type="text"
              value={value}
              required={required}
              placeholder={defaultPlaceholder}
              autoComplete="off"
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => {
                // Retraso breve para permitir clic sobre las opciones del menú
                setTimeout(() => {
                  if (!containerRef.current?.contains(document.activeElement)) {
                    setDropdownOpen(false);
                  }
                }, 140);
              }}
              onChange={(e) => {
                const next = e.target.value;
                onChange(next, findContactByName(contacts, next));
                setDropdownOpen(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />

            {dropdownOpen && filteredContacts.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
                {filteredContacts.map((item) => {
                  const loc = formatContactLocation(item);
                  const tel = item.phone || item.whatsapp;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(item.name, item);
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{item.name}</p>
                        {(tel || loc || item.categoryTag) && (
                          <p className="text-[11px] text-slate-500 truncate">
                            {[item.categoryTag, tel, loc].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      {item.creditDays > 0 && (
                        <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          {item.creditDays}d
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {matched && !compact && (
            <button
              type="button"
              onClick={openEditModal}
              title="Ver o editar ficha del contacto"
              aria-label={`Editar ficha de ${matched.name}`}
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            title={role === "cliente" ? "Crear nuevo cliente con contacto y ubicación" : "Crear nuevo proveedor con contacto y ubicación"}
            className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-2 text-xs sm:text-sm font-medium text-green-700 hover:bg-green-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{buttonLabel.replace(/^\+\s*/, "")}</span>
          </button>
        </div>

        {/* Vista compacta de ficha encontrada */}
        {matched && !compact && (matchedPhone || matchedLocation || matched.creditDays > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 border border-slate-200">
            <span className="inline-flex items-center gap-1 font-medium text-green-700">
              <UserCheck className="h-3 w-3" aria-hidden="true" />
              Ficha vinculada
            </span>
            {matchedPhone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-400" aria-hidden="true" />
                {matchedPhone}
              </span>
            )}
            {matchedLocation && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-400" aria-hidden="true" />
                {matchedLocation}
              </span>
            )}
            {matched.creditDays > 0 && (
              <span className="text-blue-700 font-medium">Crédito {matched.creditDays} días</span>
            )}
          </div>
        )}

        {/* Sugerencia rápida si el usuario escribió un nombre nuevo sin crear ficha */}
        {value.trim().length >= 2 && !matched && (
          <p className="mt-1 text-[11px] text-slate-500">
            Sin ficha aún.{" "}
            <button
              type="button"
              onClick={openCreateModal}
              className="font-medium text-green-700 hover:underline"
            >
              Guardar «{value.trim()}» como {role}
            </button>
          </p>
        )}
      </div>

      <ContactFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialContact={editingContact}
        defaultRole={role}
        initialName={editingContact ? editingContact.name : value.trim()}
        onSaved={handleSaved}
      />
    </div>
  );
}


"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import {
  getStoredAttributionSource,
  trackAnalyticsEvent,
} from "@/components/AnalyticsTracker";

const REASONS = [
  { id: "soporte", label: "Soporte técnico o ayuda de acceso" },
  { id: "implementacion", label: "Implementación (paquetes Llave en Mano)" },
  { id: "datos", label: "Datos personales, retracto o reclamos" },
] as const;

const DISCOVERY_SOURCES = [
  { value: "", label: "Selecciona una opción (opcional)" },
  { value: "ia", label: "Recomendación de IA (ChatGPT, Gemini, Perplexity, Claude)" },
  { value: "buscador", label: "Buscador web (Google o Bing)" },
  { value: "ecosistema", label: "Iwagé (iwage.co) o sitio de Camilo Saldarriaga" },
  { value: "aliado", label: "Recomendación de productor, WhatsApp o aliado rural" },
  { value: "redes", label: "Redes sociales, YouTube o GitHub" },
] as const;

type ReasonId = (typeof REASONS)[number]["id"];

export function ContactForm({
  email,
  whatsapp,
  initialOrganizationRenewal,
}: {
  email: string;
  whatsapp: string;
  initialOrganizationRenewal: { farm: string; message: string } | null;
}) {
  const headingId = useId();
  const [reason, setReason] = useState<ReasonId>(initialOrganizationRenewal ? "implementacion" : "soporte");
  const [name, setName] = useState("");
  const [farm, setFarm] = useState(initialOrganizationRenewal?.farm ?? "");
  const [contactInfo, setContactInfo] = useState("");
  const [discoverySource, setDiscoverySource] = useState("");
  const [message, setMessage] = useState(initialOrganizationRenewal?.message ?? "");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketCode: string;
    responseTime: string;
  } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const privacyRef = useRef<HTMLInputElement>(null);

  const label = REASONS.find((r) => r.id === reason)?.label ?? "";
  const body = `Motivo: ${label}\nNombre: ${name}\nGranja: ${farm}\nContacto: ${contactInfo}${discoverySource ? `\nCómo nos encontró: ${discoverySource}` : ""}\n\n${message}`;
  const hasEmail = email.includes("@");
  const rawWaDigits = whatsapp.replace(/\D/g, "");
  const waDigits =
    rawWaDigits.length === 10 && rawWaDigits.startsWith("3")
      ? `57${rawWaDigits}`
      : rawWaDigits;

  const nameError =
    touched.name && name.trim().length < 2
      ? "Ingresa tu nombre completo (mínimo 2 caracteres)."
      : "";
  const contactError =
    touched.contactInfo && contactInfo.trim().length < 5
      ? "Escribe un número de WhatsApp/celular o un correo para responderte."
      : "";
  const messageError =
    touched.message && message.trim().length < 10
      ? "Describe tu consulta o solicitud en al menos 10 caracteres."
      : "";
  const privacyError =
    touched.privacy && !acceptPrivacy
      ? "Debes autorizar el tratamiento de tus datos personales para enviar la solicitud."
      : "";

  const field =
    "public-form-input w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] text-base text-[var(--iw-semantic-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)]";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");
    setSubmittedTicket(null);
    setTouched({ name: true, contactInfo: true, message: true, privacy: true });

    if (name.trim().length < 2) {
      nameRef.current?.focus();
      return;
    }
    if (contactInfo.trim().length < 5) {
      contactRef.current?.focus();
      return;
    }
    if (message.trim().length < 10) {
      messageRef.current?.focus();
      return;
    }
    if (!acceptPrivacy) {
      privacyRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const attributionSource = getStoredAttributionSource();
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          name: name.trim(),
          farm: farm.trim(),
          contactInfo: contactInfo.trim(),
          discoverySource: discoverySource || undefined,
          attributionSource: attributionSource || undefined,
          message: message.trim(),
          website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          json.error || "No pudimos radicar tu mensaje. Intenta nuevamente o usa WhatsApp.",
        );
        return;
      }
      trackAnalyticsEvent("contact_form_submitted", {
        reason,
        discoverySource: discoverySource || attributionSource || "directo",
      });
      setSubmittedTicket({
        ticketCode: json.ticketCode || "RECIBIDO",
        responseTime: json.responseTime || "1 día hábil",
      });
      setMessage("");
      setTouched({});
    } catch {
      setSubmitError(
        "Error de conexión al enviar el formulario. Puedes escribirnos directamente por WhatsApp.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      action="/api/contacto"
      method="POST"
      aria-labelledby={headingId}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 sm:p-6 shadow-sm"
    >
      <h2 id={headingId} className="text-lg font-bold text-[var(--iw-semantic-text-primary)]">
        Radicar solicitud directa
      </h2>

      {/* Honeypot invisible para reducir spam automatizado */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="c-website">Sitio web</label>
        <input
          id="c-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[var(--iw-semantic-text-primary)] mb-1.5">
          Motivo de tu mensaje <span aria-hidden="true">*</span>
        </legend>
        <div className="grid grid-cols-1 gap-2">
          {REASONS.map((r) => {
            const inputId = `c-reason-${r.id}`;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-subtle)] px-3.5 py-2.5"
              >
                <input
                  id={inputId}
                  type="radio"
                  name="reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  className="h-5 w-5 shrink-0 accent-emerald-700"
                />
                <label
                  htmlFor={inputId}
                  className="text-sm font-medium text-[var(--iw-semantic-text-primary)] cursor-pointer flex-1"
                >
                  {r.label}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="c-name" className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
            Tu nombre <span aria-hidden="true">*</span>
          </label>
          <input
            ref={nameRef}
            id="c-name"
            name="name"
            type="text"
            required
            minLength={2}
            autoComplete="name"
            enterKeyHint="next"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (submitError) setSubmitError("");
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            aria-invalid={nameError ? "true" : undefined}
            aria-describedby={nameError ? "c-name-error" : undefined}
            className={field}
          />
          {nameError && (
            <p id="c-name-error" className="text-xs font-medium text-[var(--iw-semantic-status-danger)]">
              {nameError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="c-farm" className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
            Nombre de tu granja (opcional)
          </label>
          <input
            id="c-farm"
            name="farm"
            type="text"
            enterKeyHint="next"
            value={farm}
            onChange={(e) => setFarm(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="c-contact" className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
            Celular / WhatsApp o correo <span aria-hidden="true">*</span>
          </label>
          <input
            ref={contactRef}
            id="c-contact"
            name="contactInfo"
            type="text"
            required
            minLength={5}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            aria-describedby={contactError ? "c-contact-help c-contact-error" : "c-contact-help"}
            aria-invalid={contactError ? "true" : undefined}
            value={contactInfo}
            onChange={(e) => {
              setContactInfo(e.target.value);
              if (submitError) setSubmitError("");
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, contactInfo: true }))}
            className={field}
          />
          <span id="c-contact-help" className="text-xs text-[var(--iw-semantic-text-secondary)]">
            Si escribes tu correo, recibirás copia del radicado automáticamente.
          </span>
          {contactError && (
            <p id="c-contact-error" className="text-xs font-medium text-[var(--iw-semantic-status-danger)]">
              {contactError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="c-discovery" className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
            ¿Cómo nos encontraste? (opcional)
          </label>
          <select
            id="c-discovery"
            name="discoverySource"
            value={discoverySource}
            onChange={(e) => setDiscoverySource(e.target.value)}
            className={field}
          >
            {DISCOVERY_SOURCES.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="c-msg" className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
          Mensaje <span aria-hidden="true">*</span>
        </label>
        <textarea
          ref={messageRef}
          id="c-msg"
          name="message"
          rows={4}
          required
          minLength={10}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (submitError) setSubmitError("");
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, message: true }))}
          aria-invalid={messageError ? "true" : undefined}
          aria-describedby={messageError ? "c-msg-help c-msg-error" : "c-msg-help"}
          className={field}
        />
        <span id="c-msg-help" className="text-xs text-[var(--iw-semantic-text-secondary)]">
          Incluye la referencia de pago si solicitas retracto o aclaración de ciclo.
        </span>
        {messageError && (
          <p id="c-msg-error" className="text-xs font-medium text-[var(--iw-semantic-status-danger)]">
            {messageError}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="flex items-start gap-3 rounded-xl border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-subtle)] p-3 text-sm text-[var(--iw-semantic-text-primary)] cursor-pointer">
          <input
            ref={privacyRef}
            id="c-privacy"
            type="checkbox"
            required
            checked={acceptPrivacy}
            onChange={(e) => {
              setAcceptPrivacy(e.target.checked);
              if (submitError) setSubmitError("");
            }}
            aria-invalid={privacyError ? "true" : undefined}
            aria-describedby={privacyError ? "c-privacy-error" : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-[var(--iw-semantic-border-input)] text-[var(--iw-semantic-action-primary)]"
          />
          <span>
            Autorizo el tratamiento de mis datos personales para atender esta solicitud conforme a la{" "}
            <Link href="/privacidad" target="_blank" className="font-semibold text-[var(--iw-semantic-action-primary)] underline">
              política de tratamiento de datos (Ley 1581)
            </Link>{" "}
            y los{" "}
            <Link href="/terminos" target="_blank" className="font-semibold text-[var(--iw-semantic-action-primary)] underline">
              términos y condiciones
            </Link>
            .
          </span>
        </label>
        {privacyError && (
          <p id="c-privacy-error" className="text-xs font-medium text-[var(--iw-semantic-status-danger)]">
            {privacyError}
          </p>
        )}
      </div>

      {submitError && (
        <div role="alert" className="rounded-xl border border-[var(--iw-semantic-status-danger)]/50 bg-[var(--iw-semantic-bg-subtle)] px-4 py-3 text-sm font-medium text-[var(--iw-semantic-status-danger)]">
          {submitError}
        </div>
      )}

      <div role="status" aria-live="polite">
        {submittedTicket && (
          <div className="rounded-xl border border-[var(--iw-semantic-border-strong)] bg-[var(--iw-semantic-bg-feature)] p-4 text-sm text-[var(--iw-semantic-text-primary)] flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[var(--iw-semantic-action-primary)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold">
                Solicitud radicada: <span className="font-mono">{submittedTicket.ticketCode}</span>
              </p>
              <p className="mt-1 text-[var(--iw-semantic-text-primary)]">
                Guardamos tu mensaje con fecha y hora. Responderemos en un plazo máximo de{" "}
                <strong>{submittedTicket.responseTime}</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-xl bg-[var(--iw-semantic-action-primary)] text-white font-bold hover:bg-[var(--iw-semantic-action-primary-hover)] disabled:opacity-60"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          <span>{submitting ? "Enviando solicitud..." : "Enviar solicitud"}</span>
        </button>

        {waDigits ? (
          <a
            href={`https://wa.me/${waDigits}?text=${encodeURIComponent(body)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackAnalyticsEvent("whatsapp_click", { page: "contacto" })}
            className="inline-flex items-center min-h-[48px] px-4 py-2.5 rounded-xl border border-[var(--iw-semantic-border-strong)] text-[var(--iw-semantic-action-primary)] text-sm font-bold hover:bg-[var(--iw-semantic-bg-feature)]"
          >
            Abrir en WhatsApp
          </a>
        ) : null}

        {hasEmail ? (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(`[${label}] ${farm || "Consulta"}`)}&body=${encodeURIComponent(body)}`}
            className="inline-flex items-center min-h-[48px] px-4 py-2.5 rounded-xl border border-[var(--iw-semantic-border-input)] text-[var(--iw-semantic-text-primary)] text-sm font-semibold hover:bg-[var(--iw-semantic-bg-subtle)]"
          >
            Usar app de correo
          </a>
        ) : null}
      </div>
    </form>
  );
}

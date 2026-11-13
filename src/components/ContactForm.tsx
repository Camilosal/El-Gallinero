"use client";

import { useState } from "react";

const REASONS = [
  { id: "soporte", label: "Soporte" },
  { id: "implementacion", label: "Implementación (paquetes Llave en Mano)" },
  { id: "datos", label: "Datos personales o reclamos" },
] as const;

/** Sin backend de mensajes: arma el correo o el WhatsApp ya redactado. */
export function ContactForm({
  email,
  whatsapp,
}: {
  email: string;
  whatsapp: string;
}) {
  const [reason, setReason] = useState<(typeof REASONS)[number]["id"]>("soporte");
  const [name, setName] = useState("");
  const [farm, setFarm] = useState("");
  const [message, setMessage] = useState("");

  const label = REASONS.find((r) => r.id === reason)?.label ?? "";
  const body = `Motivo: ${label}\nNombre: ${name}\nGranja: ${farm}\n\n${message}`;
  const hasEmail = email.includes("@");
  const waDigits = whatsapp.replace(/\D/g, "");

  const field =
    "w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-400 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600";

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div>
        <label htmlFor="c-reason" className="block text-sm font-semibold text-slate-800 mb-1">Motivo</label>
        <select id="c-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={field}>
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="c-name" className="block text-sm font-semibold text-slate-800 mb-1">Tu nombre</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="c-farm" className="block text-sm font-semibold text-slate-800 mb-1">Nombre de tu granja</label>
          <input id="c-farm" value={farm} onChange={(e) => setFarm(e.target.value)} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="c-msg" className="block text-sm font-semibold text-slate-800 mb-1">Mensaje</label>
        <textarea id="c-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
      </div>
      <div className="flex flex-wrap gap-3">
        {hasEmail ? (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(`[${label}] ${farm || "Consulta"}`)}&body=${encodeURIComponent(body)}`}
            className="inline-flex items-center min-h-[48px] px-5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800"
          >
            Enviar por correo
          </a>
        ) : null}
        {waDigits ? (
          <a
            href={`https://wa.me/${waDigits}?text=${encodeURIComponent(body)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center min-h-[48px] px-5 rounded-xl border border-emerald-700 text-emerald-800 font-bold hover:bg-emerald-50"
          >
            Enviar por WhatsApp
          </a>
        ) : null}
        {!hasEmail && !waDigits ? (
          <p className="text-sm text-amber-800">Los canales de contacto se publicarán próximamente.</p>
        ) : null}
      </div>
    </form>
  );
}


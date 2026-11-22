"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { HeroFrame } from "@/components/HeroFrame";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";

export default function RecoverAccessPage() {
  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    }
    if (newPassword !== confirmation) {
      return setError("Las contraseñas no coinciden.");
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, recoveryCode, newPassword }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error || "No se pudo restablecer el acceso.");
        return;
      }
      setComplete(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100dvh-74px)] items-center justify-center bg-[var(--iw-semantic-bg-page)] px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <HeroFrame
          theme="guia"
          compact
          icon={<BrandLogo variant="mark" size={18} decorative className="rounded-sm" />}
          eyebrow="Seguridad de cuenta"
          title="Recuperar acceso"
          description="Restablece tu contraseña con un código de recuperación de un solo uso"
        />
        <section className="w-full rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-8 shadow-[var(--iw-shadow-card)]">
          <Link href="/login" className="text-sm font-medium text-[var(--iw-semantic-action-primary)] hover:underline">
            ← Volver al inicio de sesión
          </Link>
          {complete ? (
            <div className="mt-5 space-y-4">
              <p
                role="status"
                className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-success)]/40 bg-[var(--iw-semantic-bg-feature)] p-4 text-sm text-[var(--iw-semantic-status-success)]"
              >
                La contraseña se actualizó. El código quedó usado y se cerraron las sesiones anteriores.
              </p>
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] px-5 py-2.5 font-semibold text-[var(--iw-semantic-action-primary-text)] transition"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm text-[var(--iw-semantic-text-secondary)]">
                Ingresa el código de recuperación de un solo uso entregado al crear tu granja o emitido por soporte.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                  Usuario, celular o correo
                  <input
                    required
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-1 min-h-[48px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 font-normal text-[var(--iw-semantic-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)]"
                  />
                </label>
                <label className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                  Código de recuperación
                  <input
                    required
                    placeholder="Ej: IWG-..."
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                    className="mt-1 min-h-[48px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 font-mono font-normal text-[var(--iw-semantic-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)]"
                  />
                </label>
                <label className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                  Nueva contraseña (mínimo 8 caracteres)
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="mt-1 min-h-[48px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 font-normal text-[var(--iw-semantic-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)]"
                  />
                </label>
                <label className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                  Confirma la contraseña
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="mt-1 min-h-[48px] w-full rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2 font-normal text-[var(--iw-semantic-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)]"
                  />
                </label>
                {error && (
                  <p role="alert" className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-semantic-bg-subtle)] p-3 text-sm text-[var(--iw-semantic-status-danger)]">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[48px] w-full rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-action-primary)] px-4 py-3 font-semibold text-[var(--iw-semantic-action-primary-text)] hover:bg-[var(--iw-semantic-action-primary-hover)] disabled:opacity-50 transition"
                >
                  {loading ? "Actualizando…" : "Cambiar contraseña"}
                </button>
              </form>
              <p className="mt-5 text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)]">
                ¿Perdiste tu código de recuperación? Solicita uno nuevo al propietario de tu granja o escríbenos en{" "}
                <Link href="/contacto" className="font-semibold text-[var(--iw-semantic-action-primary)] underline">
                  /contacto
                </Link>
                .
              </p>
            </>
          )}
        </section>
        <DeveloperCredit variant="inline" className="justify-center" />
        <LegalLinksBar className="pt-1" />
      </div>
    </main>
  );
}

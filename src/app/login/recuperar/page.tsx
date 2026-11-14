"use client";

import { useState } from "react";
import Link from "next/link";
import { HeroFrame } from "@/components/HeroFrame";
import { DeveloperCredit } from "@/components/DeveloperCredit";

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
    <main className="flex min-h-screen items-center justify-center bg-earth-50 px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <HeroFrame
          theme="guia"
          compact
          eyebrow="Seguridad de cuenta"
          title="Recuperar acceso"
          description="Restablece tu contraseña con un código de recuperación de un solo uso"
        />
        <section className="w-full rounded-2xl border border-earth-100 bg-white p-8 shadow-xl">
          <Link href="/login" className="text-sm font-medium text-earth-700 hover:underline">
            ← Volver al inicio de sesión
          </Link>
          {complete ? (
            <div className="mt-5 space-y-4">
              <p
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              >
                La contraseña se actualizó. El código quedó usado y se cerraron las sesiones anteriores.
              </p>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-earth-700 px-4 py-2 font-semibold text-white"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm text-slate-600">
                Ingresa el código de recuperación de un solo uso entregado al crear tu granja o emitido por soporte.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Usuario, celular o correo
                  <input
                    required
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
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
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Nueva contraseña (mínimo 8 caracteres)
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Confirma la contraseña
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[48px] w-full rounded-lg bg-earth-700 px-4 py-3 font-semibold text-white hover:bg-earth-800 disabled:opacity-50"
                >
                  {loading ? "Actualizando…" : "Cambiar contraseña"}
                </button>
              </form>
              <p className="mt-5 text-xs leading-relaxed text-slate-600">
                ¿Perdiste tu código de recuperación? Solicita uno nuevo al propietario de tu granja o escríbenos en{" "}
                <Link href="/contacto" className="font-semibold text-earth-800 underline">
                  /contacto
                </Link>
                .
              </p>
            </>
          )}
        </section>
        <DeveloperCredit variant="inline" className="justify-center" />
      </div>
    </main>
  );
}

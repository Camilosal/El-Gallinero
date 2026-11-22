"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { HeroFrame } from "@/components/HeroFrame";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al iniciar sesión");
        return;
      }
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/inicio";
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-74px)] flex-col bg-[var(--iw-semantic-bg-page)]">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 pb-12">
        <div className="w-full max-w-md">
          {/* Hero Header */}
          <HeroFrame
            theme="inicio"
            compact
            icon={<BrandLogo variant="mark" size={18} decorative className="rounded-sm bg-white/95 p-0.5" />}
            eyebrow="Acceso al sistema"
            title="IwaGranja"
            description="Tu granja, todo bajo control."
            className="mb-6"
          />

          {/* Login Form */}
          <div className="bg-[var(--iw-semantic-bg-surface)] rounded-2xl shadow-[var(--iw-shadow-card)] p-8 border border-[var(--iw-semantic-border-default)]">
            <div className="flex justify-center mb-5">
              <BrandLogo
                variant="square"
                size={96}
                className="rounded-2xl bg-[var(--iw-semantic-bg-page)] p-1.5 border border-[var(--iw-semantic-border-default)] shadow-xs"
              />
            </div>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)] mb-2">
                  Usuario
                </label>
                <input
                  className="w-full min-h-[48px] px-4 py-3 border border-[var(--iw-semantic-border-input)] rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] placeholder:text-[var(--iw-semantic-text-secondary)]/75 focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)] transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)] mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  className="w-full min-h-[48px] px-4 py-3 border border-[var(--iw-semantic-border-input)] rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] placeholder:text-[var(--iw-semantic-text-secondary)]/75 focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)] transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div role="alert" className="bg-[var(--iw-semantic-bg-subtle)] border border-[var(--iw-semantic-status-danger)] text-[var(--iw-semantic-status-danger)] px-4 py-3 rounded-[var(--iw-radius-control)] text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full min-h-[48px] py-3 bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] text-[var(--iw-semantic-action-primary-text)] rounded-[var(--iw-radius-control)] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Ingresando...
                  </span>
                ) : (
                  "Iniciar Sesión"
                )}
              </button>
              <div className="text-center space-y-2">
                <div>
                  <Link href="/login/recuperar" className="text-sm font-medium text-[var(--iw-semantic-action-primary)] hover:underline">¿Olvidaste tu contraseña?</Link>
                </div>
                <div className="pt-2 border-t border-[var(--iw-semantic-border-default)]">
                  <span className="text-sm text-[var(--iw-semantic-text-secondary)]">¿Es tu primera vez? </span>
                  <Link href="/registro" className="text-sm font-bold text-[var(--iw-semantic-action-primary)] hover:underline">
                    Crear cuenta de finca gratis (3 min)
                  </Link>
                </div>
              </div>
            </form>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-sm text-[var(--iw-semantic-text-secondary)]">
              <Leaf className="w-4 h-4 text-[var(--iw-semantic-action-primary)]" />
              <span>Granja Autosustentable Iwagé</span>
            </div>
            <DeveloperCredit variant="inline" className="justify-center" />
            <LegalLinksBar className="pt-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

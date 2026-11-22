"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";
import { HERO_THEMES } from "@/lib/hero-themes";

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
          {/* Login Card with Unified Single Header */}
          <div className="overflow-hidden rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-[var(--iw-shadow-card)]">
            <header className="gallinero-hero border-b border-[var(--iw-semantic-border-default)] px-6 py-5">
              <picture className="gallinero-hero-picture">
                <source
                  type="image/webp"
                  srcSet={`${HERO_THEMES.inicio.src1xWebp} 1x, ${HERO_THEMES.inicio.src2xWebp} 2x`}
                />
                <img
                  src={HERO_THEMES.inicio.fallbackJpg}
                  alt={HERO_THEMES.inicio.alt}
                  width={1600}
                  height={560}
                  decoding="async"
                  fetchPriority="high"
                  className="gallinero-hero-img"
                />
              </picture>
              <div className="gallinero-hero-scrim" aria-hidden="true" />
              <div className="relative z-10 flex items-center gap-4">
                <BrandLogo
                  variant="square"
                  size={68}
                  priority
                  className="shrink-0 rounded-xl border border-white/30 bg-white/95 p-1 shadow-sm"
                />
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-[var(--iw-color-paper)]">
                    Acceso al sistema
                  </span>
                  <h1 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                    IwaGranja
                  </h1>
                  <p className="mt-0.5 text-sm leading-snug text-[var(--iw-color-paper)]/90">
                    Tu granja, todo bajo control.
                  </p>
                </div>
              </div>
            </header>

            <div className="p-6 sm:p-8">
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

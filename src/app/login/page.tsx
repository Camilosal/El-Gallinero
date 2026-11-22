"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, Leaf } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";
import {
  LAST_FARM_CODE_STORAGE_KEY,
  readCachedActiveFarmMeta,
  writeCachedActiveFarmMeta,
} from "@/lib/active-farm-client";
import { clearOfflineCryptoKey } from "@/lib/offline/crypto";
import {
  describeFarmCodeError,
  isValidFarmCode,
  normalizeFarmCode,
} from "@/lib/farm-code";
import { HERO_THEMES } from "@/lib/hero-themes";

export default function LoginPage() {
  const router = useRouter();
  const farmCodeErrorId = useId();
  const farmCodeInputRef = useRef<HTMLInputElement>(null);

  const [farmCode, setFarmCode] = useState("");
  const [farmCodePrefilledFromUrl, setFarmCodePrefilledFromUrl] = useState(false);
  const [farmCodeTouched, setFarmCodeTouched] = useState(false);
  const [farmCodeRequired, setFarmCodeRequired] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      const urlFarm = params.get("granja") || params.get("f") || params.get("farm") || "";
      const normalizedUrlFarm = normalizeFarmCode(urlFarm);
      if (normalizedUrlFarm) {
        setFarmCode(normalizedUrlFarm);
        setFarmCodePrefilledFromUrl(true);
        return;
      }
      try {
        const remembered = window.localStorage.getItem(LAST_FARM_CODE_STORAGE_KEY) || "";
        const normalizedRemembered = normalizeFarmCode(remembered);
        if (normalizedRemembered) {
          setFarmCode(normalizedRemembered);
        }
      } catch {
        // Ignore storage access errors
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const normalizedFarmCode = normalizeFarmCode(farmCode);
  const clientFarmCodeError =
    farmCodeTouched && normalizedFarmCode.length > 0
      ? describeFarmCodeError(normalizedFarmCode)
      : null;
  const farmCodeInvalid = farmCodeRequired && !isValidFarmCode(normalizedFarmCode)
    ? describeFarmCodeError(normalizedFarmCode) ||
      "Ingresa el Código de Granja de 6 caracteres (ej. 7K4M2P)."
    : clientFarmCodeError;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (normalizedFarmCode.length > 0 && !isValidFarmCode(normalizedFarmCode)) {
      setFarmCodeTouched(true);
      const msg = describeFarmCodeError(normalizedFarmCode) || "Código de granja inválido.";
      setError(msg);
      farmCodeInputRef.current?.focus();
      return;
    }

    if (farmCodeRequired && normalizedFarmCode.length === 0) {
      setFarmCodeTouched(true);
      setError("Tu usuario existe en más de una finca. Ingresa el Código de Granja (ej. 7K4M2P).");
      farmCodeInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          ...(normalizedFarmCode ? { farmCode: normalizedFarmCode } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data.code === "FARM_CODE_REQUIRED") {
          setFarmCodeRequired(true);
          setFarmCodeTouched(true);
          setError(
            data.error ||
              "Hay más de una cuenta con este usuario. Ingresa el Código de Granja (6 caracteres, ej. 7K4M2P).",
          );
          setTimeout(() => farmCodeInputRef.current?.focus(), 0);
          return;
        }
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      if (data?.farmId) {
        const previousFarm = readCachedActiveFarmMeta();
        if (previousFarm?.id && previousFarm.id !== String(data.farmId)) {
          clearOfflineCryptoKey(true);
        }
        writeCachedActiveFarmMeta({
          id: String(data.farmId),
          code: typeof data.farmCode === "string" ? data.farmCode : normalizedFarmCode || null,
          name: typeof data.farmName === "string" ? data.farmName : null,
          slug: null,
        });
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const nextPath =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
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
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="login-farm-code"
                      className="text-sm font-semibold text-[var(--iw-semantic-text-primary)]"
                    >
                      Código de granja {farmCodeRequired ? "(obligatorio)" : "(opcional)"}
                    </label>
                    {farmCodePrefilledFromUrl && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--iw-semantic-bg-feature)] px-2 py-0.5 text-[11px] font-semibold text-[var(--iw-semantic-action-primary)]">
                        <KeyRound className="w-3 h-3" aria-hidden="true" />
                        Desde QR/enlace
                      </span>
                    )}
                  </div>
                  <input
                    ref={farmCodeInputRef}
                    id="login-farm-code"
                    name="farmCode"
                    type="text"
                    autoComplete="organization"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="next"
                    maxLength={12}
                    required={farmCodeRequired}
                    aria-invalid={Boolean(farmCodeInvalid)}
                    aria-describedby={farmCodeInvalid ? farmCodeErrorId : undefined}
                    value={farmCode}
                    onChange={(e) => {
                      setFarmCode(e.target.value.toUpperCase());
                      if (error) setError("");
                    }}
                    onBlur={() => setFarmCodeTouched(true)}
                    placeholder="Ej. 7K4M2P (solo si operas varias fincas)"
                    className={`w-full min-h-[48px] px-4 py-3 font-mono tracking-widest uppercase border rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-[var(--iw-semantic-text-secondary)]/75 focus:outline-none focus:ring-2 transition-all ${
                      farmCodeInvalid
                        ? "border-[var(--iw-semantic-status-danger)] focus:ring-[var(--iw-semantic-status-danger)]/40"
                        : "border-[var(--iw-semantic-border-input)] focus:ring-[var(--iw-semantic-focus-ring)]"
                    }`}
                  />
                  {farmCodeInvalid ? (
                    <p
                      id={farmCodeErrorId}
                      className="mt-1 text-xs font-medium text-[var(--iw-semantic-status-danger)]"
                    >
                      {farmCodeInvalid}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)]">
                      Identifica tu finca al instante. Si tu usuario es único, puedes dejarlo vacío.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)] mb-1.5"
                  >
                    Usuario
                  </label>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    className="w-full min-h-[48px] px-4 py-3 border border-[var(--iw-semantic-border-input)] rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] placeholder:text-[var(--iw-semantic-text-secondary)]/75 focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)] transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresa tu usuario"
                    autoFocus={!farmCodePrefilledFromUrl}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)] mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      enterKeyHint="done"
                      className="w-full min-h-[48px] pl-4 pr-12 py-3 border border-[var(--iw-semantic-border-input)] rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] placeholder:text-[var(--iw-semantic-text-secondary)]/75 focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)] transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-[var(--iw-radius-control)] text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)]"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="bg-[var(--iw-semantic-bg-subtle)] border border-[var(--iw-semantic-status-danger)] text-[var(--iw-semantic-status-danger)] px-4 py-3 rounded-[var(--iw-radius-control)] text-sm font-medium"
                  >
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
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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
                    <Link
                      href={normalizedFarmCode ? `/login/recuperar?granja=${encodeURIComponent(normalizedFarmCode)}` : "/login/recuperar"}
                      className="text-sm font-medium text-[var(--iw-semantic-action-primary)] hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
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
              <Leaf className="w-4 h-4 text-[var(--iw-semantic-action-primary)]" aria-hidden="true" />
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

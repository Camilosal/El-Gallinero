"use client";

import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";
import { trackAnalyticsEvent } from "@/components/AnalyticsTracker";

function fallbackCopyText(text: string): boolean {
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

function RegistroQueryReader({
  onRead,
}: {
  onRead: (params: { qrSource: string; allyCode: string }) => void;
}) {
  const searchParams = useSearchParams();
  const qrSource = searchParams.get("qr") || searchParams.get("origen") || "";
  const allyCode = searchParams.get("aliado") || searchParams.get("ally") || "";

  useEffect(() => {
    onRead({ qrSource, allyCode });
  }, [onRead, qrSource, allyCode]);

  if (!qrSource && !allyCode) {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2">
      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
      <span>
        Registro con acompañamiento rural
        {allyCode ? ` · Aliado: ${allyCode}` : ""}
        {qrSource ? ` (${qrSource})` : ""}
      </span>
    </div>
  );
}

export default function RegistroPage() {
  const router = useRouter();
  const codeId = useId();
  const trackingParamsRef = useRef({ qrSource: "", allyCode: "" });

  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdAccount, setCreatedAccount] = useState<{
    farmName: string;
    username: string;
    recoveryCode: string;
    redirectTo: string;
  } | null>(null);

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [copyLiveMessage, setCopyLiveMessage] = useState("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnouncementRef = useRef("");

  const handleReadParams = useCallback((params: { qrSource: string; allyCode: string }) => {
    trackingParamsRef.current = params;
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function handleCopyRecoveryCode() {
    if (!createdAccount?.recoveryCode) return;
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    let succeeded = false;
    try {
      await navigator.clipboard.writeText(createdAccount.recoveryCode);
      succeeded = true;
    } catch {
      succeeded = fallbackCopyText(createdAccount.recoveryCode);
    }

    let msg = succeeded ? "Copiado" : "No se pudo copiar";
    if (msg === lastAnnouncementRef.current) {
      msg += "\u00A0";
    }
    lastAnnouncementRef.current = msg;

    setCopyState(succeeded ? "copied" : "failed");
    setCopyLiveMessage("");
    requestAnimationFrame(() => setCopyLiveMessage(msg));

    copyTimerRef.current = setTimeout(() => {
      setCopyState("idle");
      setCopyLiveMessage("");
    }, 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { qrSource, allyCode } = trackingParamsRef.current;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmName,
          ownerName,
          username,
          password,
          acceptLegal,
          qrSource: qrSource || undefined,
          allyCode: allyCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo completar el registro");
        setLoading(false);
        return;
      }
      trackAnalyticsEvent("farm_created");
      if (data.recoveryCode) {
        setCreatedAccount({
          farmName: data.farm?.name || farmName,
          username: data.user?.username || username,
          recoveryCode: String(data.recoveryCode),
          redirectTo: data.redirectTo || "/inicio?wizard=1",
        });
        setLoading(false);
        return;
      }
      router.push(data.redirectTo || "/inicio?wizard=1");
      router.refresh();
    } catch {
      setError("Error de conexión. Revisa tu señal e intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-earth-100 via-earth-50 to-amber-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-earth-200 p-6 sm:p-8">
        <div className="text-center mb-6">
          <BrandLogo
            variant="full"
            size={84}
            className="mx-auto mb-3 rounded-2xl border border-earth-200 shadow-sm"
          />
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Iwagé Granja · Plan Semilla
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {createdAccount
              ? "¡Tu granja ya está creada!"
              : "Crea tu granja gratis en menos de 3 minutos"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {createdAccount
              ? "Guarda tu código de recuperación antes de continuar al asistente Día 1"
              : "Sin tarjeta de crédito · Funciona sin señal en el galpón"}
          </p>
        </div>

        {createdAccount ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-3">
              <div className="flex items-start gap-2">
                <KeyRound className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">Código de recuperación de cuenta</p>
                  <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                    Si algún día olvidas tu contraseña, este código de un solo uso te permitirá recuperarla sin perder acceso a{" "}
                    <strong>{createdAccount.farmName}</strong>. Anótalo o guárdalo por WhatsApp.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-300 bg-white p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">
                    Usuario: {createdAccount.username}
                  </p>
                  <pre className="mt-0.5 text-base font-bold tracking-wider text-slate-900">
                    <code id={codeId}>{createdAccount.recoveryCode}</code>
                  </pre>
                </div>

                <div className="relative inline-flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyRecoveryCode()}
                    aria-label="Copiar código de recuperación"
                    data-copied={copyState === "copied" ? "" : undefined}
                    data-failed={copyState === "failed" ? "" : undefined}
                    className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 hover:bg-slate-100"
                  >
                    {copyState === "copied" ? (
                      <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-700" aria-hidden="true" />
                    )}
                    <span>{copyState === "copied" ? "Listo" : "Copiar"}</span>
                  </button>
                  <span
                    role="status"
                    className={`text-xs font-semibold transition-opacity ${
                      copyLiveMessage ? "opacity-100 text-emerald-800" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    {copyLiveMessage}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-600 px-1">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Por seguridad, este código se muestra solo una vez al crear la cuenta.</span>
            </div>

            <button
              type="button"
              onClick={() => {
                router.push(createdAccount.redirectTo);
                router.refresh();
              }}
              className="w-full min-h-[48px] px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <span>Entrar a mi granja ahora</span>
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <Suspense fallback={null}>
              <RegistroQueryReader onRead={handleReadParams} />
            </Suspense>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-sm font-medium text-red-800">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Nombre de tu granja o finca
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="Ej: Finca La Esperanza"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-400 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Tu nombre
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ej: María Fernanda Gómez"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-400 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Usuario, celular o correo
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  autoComplete="username"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: 3104567890 o maria@correo.com"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-400 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Contraseña (mínimo 8 caracteres)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crea una contraseña segura"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-400 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={acceptLegal}
                  onChange={(e) => setAcceptLegal(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400 text-emerald-700"
                />
                <span>
                  Acepto los{" "}
                  <Link href="/terminos" target="_blank" className="font-semibold text-emerald-800 underline">
                    términos y condiciones
                  </Link>
                  , la{" "}
                  <Link href="/retracto" target="_blank" className="font-semibold text-emerald-800 underline">
                    política de retracto
                  </Link>{" "}
                  y autorizo el tratamiento de mis datos personales según la{" "}
                  <Link href="/privacidad" target="_blank" className="font-semibold text-emerald-800 underline">
                    política de tratamiento de datos
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !acceptLegal}
                className="w-full min-h-[48px] px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  "Creando tu granja..."
                ) : (
                  <>
                    Empezar gratis ahora
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <ul className="mt-5 space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                1 lote o unidad productiva gratis para siempre + 30 días de prueba completa
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Arrancas con tus animales vivos de hoy, sin digitar meses pasados
              </li>
            </ul>

            <div className="mt-5 pt-4 border-t border-slate-200 text-center text-sm">
              <span className="text-slate-600">¿Ya tienes cuenta? </span>
              <Link href="/login" className="font-bold text-emerald-800 hover:underline">
                Iniciar sesión
              </Link>
            </div>
          </>
        )}

        <div className="mt-6 text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Leaf className="w-3.5 h-3.5" />
            <span>Iwagé Granja · Estándar ICA / NTC 1240</span>
          </div>
          <DeveloperCredit variant="inline" className="justify-center" />
          <LegalLinksBar className="pt-1" />
        </div>
      </div>
    </div>
  );
}

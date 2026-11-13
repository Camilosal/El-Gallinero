"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Egg, Leaf, ShieldCheck } from "lucide-react";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";

function RegistroFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrSource = searchParams.get("qr") || searchParams.get("origen") || "";
  const allyCode = searchParams.get("aliado") || searchParams.get("ally") || "";

  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
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
      router.push(data.redirectTo || "/dashboard?wizard=1");
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-700 to-amber-600 shadow-md mb-3">
            <Egg className="w-7 h-7 text-white" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Iwagé Granja · Plan Semilla
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Crea tu granja gratis en menos de 3 minutos
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Sin tarjeta de crédito · Funciona sin señal en el galpón
          </p>
        </div>

        {(qrSource || allyCode) && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
            <span>
              Registro con acompañamiento rural
              {allyCode ? ` · Aliado: ${allyCode}` : ""}
              {qrSource ? ` (${qrSource})` : ""}
            </span>
          </div>
        )}

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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: 3104567890 o maria"
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
              <Link href="/terminos" target="_blank" className="font-semibold text-emerald-800 underline">términos y condiciones</Link>
              , la{" "}
              <Link href="/retracto" target="_blank" className="font-semibold text-emerald-800 underline">política de retracto</Link>
              {" "}y autorizo el tratamiento de mis datos personales según la{" "}
              <Link href="/privacidad" target="_blank" className="font-semibold text-emerald-800 underline">política de tratamiento de datos</Link>.
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

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-earth-50" />}>
      <RegistroFormInner />
    </Suspense>
  );
}


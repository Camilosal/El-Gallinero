"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bird, Leaf } from "lucide-react";

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
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-earth-50 via-white to-earth-100">
      {/* Header */}
      <div className="p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-earth-600 hover:text-earth-700 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-earth-100 rounded-2xl mb-4">
              <Bird className="w-10 h-10 text-earth-700" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-bold text-earth-900 mb-2">El Gallinero</h1>
            <p className="text-earth-600">Sistema de Gestión Avícola</p>
          </div>

          {/* Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-earth-100">
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-earth-800 mb-2">
                  Usuario
                </label>
                <input
                  className="w-full px-4 py-3 border-2 border-earth-200 rounded-xl text-earth-900 placeholder:text-earth-400 focus:outline-none focus:border-earth-500 focus:ring-4 focus:ring-earth-100 transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-earth-800 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 border-2 border-earth-200 rounded-xl text-earth-900 placeholder:text-earth-400 focus:outline-none focus:border-earth-500 focus:ring-4 focus:ring-earth-100 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-3.5 bg-earth-600 hover:bg-earth-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
              <div className="text-center">
                <Link href="/login/recuperar" className="text-sm font-medium text-earth-700 hover:underline">¿Olvidaste tu contraseña?</Link>
              </div>
            </form>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-earth-600">
              <Leaf className="w-4 h-4" />
              <span>Granja Autosustentable Iwagé</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Lock, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import { Badge, Card } from "@/components/ui";

interface DelegationToolView {
  name: string;
  description: string;
  hardFloor: boolean;
  defaultMode: "auto" | "confirm";
  mode: "auto" | "confirm";
  effectiveMode: "auto" | "confirm";
}

interface DelegationResponse {
  policy: Record<string, "auto" | "confirm">;
  tools: DelegationToolView[];
  hardFloor: string[];
  canEdit: boolean;
}

function toolLabel(name: string): string {
  const label = name.replace(/^registrar_/, "").replace(/^gestionar_/, "").replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function DelegationPolicyPanel() {
  const [data, setData] = useState<DelegationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/asistente/delegacion", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "No se pudo cargar la política de delegación");
      setData(body as DelegationResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando la política");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const putPolicy = async (payload: Record<string, unknown>, key: string, okText: string) => {
    setSavingKey(key);
    setFeedback(null);
    try {
      const res = await fetch("/api/asistente/delegacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "No se pudo guardar la política");
      setData(body as DelegationResponse);
      setFeedback({ type: "ok", text: okText });
    } catch (err) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Error al guardar" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = (tool: DelegationToolView) => {
    if (!data || !data.canEdit || tool.hardFloor) return;
    const next = tool.effectiveMode === "auto" ? "confirm" : "auto";
    void putPolicy(
      { policy: { ...data.policy, [tool.name]: next } },
      tool.name,
      next === "auto"
        ? `${toolLabel(tool.name)}: el asistente la ejecutará sin tarjeta, con auditoría delegated_auto.`
        : `${toolLabel(tool.name)}: volverá a pedir confirmación humana.`,
    );
  };

  const handleReset = () => {
    void putPolicy({ reset: true }, "__reset__", "Política recomendada restaurada.");
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 text-violet-700">
            <Bot className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">Delegación del asistente</h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              Decide qué escrituras rutinarias ejecuta Gina sin tarjeta de confirmación. Las ventas, el dinero,
              los animales y los cierres siempre piden confirmación humana: ese piso duro no es configurable.
            </p>
          </div>
        </div>
        {data?.canEdit && (
          <button
            type="button"
            onClick={handleReset}
            disabled={savingKey !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 min-h-[40px] disabled:opacity-60"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{savingKey === "__reset__" ? "Restaurando..." : "Restaurar política recomendada"}</span>
          </button>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Toda auto-ejecución delegada queda auditada en el historial de acciones con origen{" "}
          <code className="font-mono">delegated_auto</code>. Solo el propietario o administrador puede cambiar esta política.
        </span>
      </div>

      {feedback && (
        <p
          role="status"
          className={`text-sm rounded-lg px-3 py-2 ${
            feedback.type === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {feedback.text}
        </p>
      )}

      {loading && <p className="text-sm text-slate-500">Cargando política de delegación...</p>}
      {error && !loading && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && data && (
        <>
          {!data.canEdit && (
            <p className="text-xs text-slate-500">
              Tu rol puede consultar la política, pero solo el propietario o administrador puede modificarla.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {data.tools.map((tool) => (
              <li key={tool.name} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    {toolLabel(tool.name)}
                    <code className="text-[10px] font-mono text-slate-400">{tool.name}</code>
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-2">{tool.description}</p>
                </div>
                {tool.hardFloor ? (
                  <Badge color="yellow">
                    <span className="inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      Confirmación humana obligatoria
                    </span>
                  </Badge>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tool.effectiveMode === "auto"}
                    aria-label={`Delegar ${toolLabel(tool.name)}`}
                    disabled={!data.canEdit || savingKey !== null}
                    onClick={() => handleToggle(tool)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] disabled:opacity-60 ${
                      tool.effectiveMode === "auto"
                        ? "bg-violet-700 text-white hover:bg-violet-800"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {tool.effectiveMode === "auto" ? (
                      <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {savingKey === tool.name
                        ? "Guardando..."
                        : tool.effectiveMode === "auto"
                          ? "Auto (delegada)"
                          : "Confirmar"}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
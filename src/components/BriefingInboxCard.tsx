"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { buildBriefingPushPayload } from "@/lib/briefing-push";

/**
 * C2: tarjeta "Gina te informa" en /inicio.
 * - Briefing del día con máx. 3 viñetas visibles (expandible) y enlaces profundos.
 * - Botón "leído" idempotente y contador de no-leídos.
 * - Push local solo si el usuario ya otorgó permiso (nunca automático).
 * - Sin señal muestra la última copia guardada en cola local (localStorage).
 */

interface BriefingFinding {
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href?: string;
}

interface Briefing {
  id: string;
  briefingDate: string;
  kind: string;
  narrative: string;
  readAt: string | null;
  payload: { findings?: BriefingFinding[] };
}

const CACHE_KEY = "gina_briefings_cache_v1";
const PUSH_THROTTLE_KEY = "gina_briefing_push_last_v1";
const MAX_VISIBLE_FINDINGS = 3;

const SEVERITY_ICON: Record<string, string> = { critical: "🔴", warning: "🟠", info: "🔵" };

function readCache(): { briefings: Briefing[]; unreadCount: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function maybeNotifyViaServiceWorker(unreadCount: number) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;
  // Un aviso por día como máximo: el detalle vive dentro de la app.
  const today = new Date().toISOString().slice(0, 10);
  const throttleKey = `${today}:${unreadCount}`;
  try {
    if (localStorage.getItem(PUSH_THROTTLE_KEY) === throttleKey) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: "SHOW_BRIEFING_NOTIFICATION",
      payload: buildBriefingPushPayload(unreadCount),
    });
    localStorage.setItem(PUSH_THROTTLE_KEY, throttleKey);
  } catch {
    // Sin SW activo no hay push; el inbox sigue funcionando.
  }
}

export default function BriefingInboxCard() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setBriefings(cached.briefings || []);
      setUnreadCount(cached.unreadCount || 0);
    }
    let cancelled = false;
    apiFetch("/api/asistente/briefings?limit=5")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const next = { briefings: data.briefings || [], unreadCount: data.unreadCount || 0 };
        setBriefings(next.briefings);
        setUnreadCount(next.unreadCount);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // almacenamiento lleno: la cola local es best-effort
        }
        if (next.unreadCount > 0) void maybeNotifyViaServiceWorker(next.unreadCount);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMarkRead = useCallback(async (id: string) => {
    setMarking(true);
    try {
      const res = await apiFetch("/api/asistente/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      setBriefings((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, readAt: new Date().toISOString() } : b));
        const unread = next.filter((b) => !b.readAt).length;
        setUnreadCount(unread);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ briefings: next, unreadCount: unread }));
        } catch {
          // best-effort
        }
        return next;
      });
    } finally {
      setMarking(false);
    }
  }, []);

  const latest = briefings[0];
  if (!loaded && !latest) return null;
  if (!latest) return null;

  const findings = latest.payload?.findings || [];
  const visible = expanded ? findings : findings.slice(0, MAX_VISIBLE_FINDINGS);
  const isUnread = !latest.readAt;

  return (
    <Card className="mb-5 border-green-200 bg-green-50/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-700 text-white" aria-hidden="true">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-green-900">
              Gina te informa
              {latest.kind === "anomalia" && <span className="ml-1.5 text-red-700">· Anomalía detectada</span>}
            </h2>
            <p className="text-[11px] text-green-800/80">Parte del {latest.briefingDate}</p>
          </div>
          {unreadCount > 0 && <Badge color="orange">{unreadCount} sin leer</Badge>}
        </div>
        {isUnread && (
          <Button
            variant="secondary"
            onClick={() => void handleMarkRead(latest.id)}
            disabled={marking}
            className="!px-3 !py-1.5 text-xs"
          >
            <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {marking ? "Marcando..." : "Leído"}
          </Button>
        )}
      </div>

      {latest.narrative?.trim() && (
        <p className="mt-3 whitespace-pre-line text-sm text-slate-800">{latest.narrative.trim()}</p>
      )}

      {visible.length > 0 && (
        <ul className="mt-3 space-y-2">
          {visible.map((finding) => (
            <li key={finding.code} className="rounded-lg border border-green-100 bg-white px-3 py-2 text-sm">
              <span className="mr-1.5" aria-hidden="true">{SEVERITY_ICON[finding.severity] || "🔵"}</span>
              <span className="font-semibold text-slate-900">{finding.title}:</span>{" "}
              <span className="text-slate-700">{finding.detail}</span>
              {finding.href && (
                <Link
                  href={finding.href}
                  className="ml-2 inline-flex items-center font-semibold text-green-700 underline-offset-2 hover:underline"
                >
                  Abrir →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {findings.length > MAX_VISIBLE_FINDINGS && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-800 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> Ver {findings.length - MAX_VISIBLE_FINDINGS} más
            </>
          )}
        </button>
      )}
    </Card>
  );
}
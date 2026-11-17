"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Send, Unlink } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

/**
 * C3: sección "Canal Telegram" en /configuracion/modulos.
 * Genera códigos de pairing (10 min, un solo uso), lista los chats del usuario
 * y permite desvincularlos. El chat hereda el rol y permisos de este usuario.
 */

interface TelegramChatRow {
  id: string;
  chatId: number;
  status: string;
  linkedAt: string;
  lastSeenAt: string;
}

export default function TelegramChannelPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [chats, setChats] = useState<TelegramChatRow[]>([]);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/telegram/vincular");
      if (!res.ok) return;
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setChats(data.chats || []);
    } catch {
      setConfigured(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleGenerate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/telegram/vincular", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo generar el código.");
        return;
      }
      setPairing({ code: data.code, expiresAt: data.expiresAt });
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/telegram/vincular", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "No se pudo desvincular el chat.");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (configured === null) return null;

  return (
    <Card className="mt-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700" aria-hidden="true">
          <Send className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900">Canal Telegram · Gina en tu bolsillo</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-600">
            Habla con Gina por Telegram (texto o notas de voz), recibe el parte diario y confirma acciones desde el chat.
            Cada chat se vincula a tu usuario y hereda tu rol: lo que no puedes hacer en la app, tampoco por Telegram.
          </p>

          {!configured && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El servidor aún no tiene configurado el bot (TELEGRAM_BOT_TOKEN). El administrador debe configurarlo y
              ejecutar <code>node scripts/telegram-setup.mjs</code>. Mientras tanto, el parte diario sigue disponible
              para compartir desde Inicio.
            </p>
          )}

          {configured && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void handleGenerate()} disabled={busy} className="text-sm">
                  <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {busy ? "Generando..." : "Generar código de vinculación"}
                </Button>
                {pairing && (
                  <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 font-mono text-sm font-bold text-sky-900">
                    /start {pairing.code}
                  </span>
                )}
              </div>
              {pairing && (
                <p className="text-[11px] text-slate-500">
                  Envía <span className="font-mono font-semibold">/start {pairing.code}</span> al bot de la granja en
                  Telegram. El código dura 10 minutos y es de un solo uso (expira{" "}
                  {new Date(pairing.expiresAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}).
                </p>
              )}
              {error && <p className="text-xs font-semibold text-red-700">{error}</p>}

              {chats.length > 0 ? (
                <ul className="space-y-2">
                  {chats.map((chat) => (
                    <li
                      key={chat.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs text-slate-700">
                        <span className="font-semibold">Chat {chat.chatId}</span>
                        <span className="ml-2 text-slate-500">
                          vinculado {new Date(chat.linkedAt).toLocaleDateString("es-CO")}
                        </span>
                        <span className="ml-2">
                          {chat.status === "activo" ? <Badge color="green">activo</Badge> : <Badge color="red">revocado</Badge>}
                        </span>
                      </div>
                      {chat.status === "activo" && (
                        <Button
                          variant="danger"
                          onClick={() => void handleUnlink(chat.id)}
                          disabled={busy}
                          className="!px-3 !py-1.5 text-xs"
                        >
                          <Unlink className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Desvincular
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Aún no tienes chats vinculados. Genera un código y envíalo al bot.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
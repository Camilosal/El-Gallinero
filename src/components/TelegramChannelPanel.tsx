"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Link2, QrCode, Send, Unlink } from "lucide-react";
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

interface PairingState {
  code: string;
  expiresAt: string;
  deepLink: string | null;
  qrDataUrl: string | null;
  previousChats: Record<string, string>;
}

export default function TelegramChannelPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [chats, setChats] = useState<TelegramChatRow[]>([]);
  const [pairing, setPairing] = useState<PairingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");

  const loadStatus = useCallback(async () => {
    const res = await apiFetch("/api/telegram/vincular").catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => null) : null;
    if (!data) return null;
    setConfigured(Boolean(data?.configured));
    setBotUsername(data?.botUsername || null);
    setChats(data?.chats || []);
    return (data?.chats || []) as TelegramChatRow[];
  }, []);

  const refresh = useCallback(async () => {
    await loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    let cancelled = false;
    void loadStatus().then((data) => {
      if (!cancelled && !data) setConfigured(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!pairing) return;
    let cancelled = false;
    const checkPairing = async () => {
      const currentChats = await loadStatus();
      if (cancelled || !currentChats) return;
      const newlyLinked = currentChats.some((chat) => {
        const currentVersion = `${chat.status}:${chat.linkedAt}`;
        return chat.status === "activo" && pairing.previousChats[chat.id] !== currentVersion;
      });
      if (newlyLinked) {
        setPairing(null);
        setError("");
        setConnectionNotice("¡Telegram quedó vinculado a tu cuenta!");
      } else if (Date.now() >= new Date(pairing.expiresAt).getTime()) {
        setPairing(null);
        setError("El código expiró. Genera uno nuevo para volver a intentarlo.");
      }
    };
    void checkPairing();
    const timer = window.setInterval(() => void checkPairing(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pairing, loadStatus]);

  const handleGenerate = async () => {
    setBusy(true);
    setError("");
    setConnectionNotice("");
    try {
      const res = await apiFetch("/api/telegram/vincular", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo generar el código.");
        return;
      }
      const username = data.botUsername || botUsername;
      const deepLink = username ? `https://t.me/${username}?start=${encodeURIComponent(data.code)}` : null;
      let qrDataUrl: string | null = null;
      if (deepLink) {
        try {
          qrDataUrl = await QRCode.toDataURL(deepLink, { width: 320, margin: 2 });
        } catch {
          setError("No pude generar la imagen QR; puedes vincularlo usando el comando mostrado.");
        }
      }
      const previousChats = Object.fromEntries(
        chats.map((chat) => [chat.id, `${chat.status}:${chat.linkedAt}`]),
      );
      setPairing({ code: data.code, expiresAt: data.expiresAt, deepLink, qrDataUrl, previousChats });
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
              {!botUsername && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Para habilitar el QR, el administrador debe configurar <code>TELEGRAM_BOT_USERNAME</code> con el
                  usuario público del bot, sin @. Mientras tanto puedes usar el comando de vinculación manual.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void handleGenerate()} disabled={busy} className="text-sm">
                  {botUsername ? (
                    <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {busy ? "Preparando..." : botUsername ? "Generar QR de conexión" : "Generar código de vinculación"}
                </Button>
                {pairing && (
                  <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 font-mono text-sm font-bold text-sky-900">
                    /start {pairing.code}
                  </span>
                )}
              </div>
              {pairing && (
                <p className="text-[11px] text-slate-500">
                  {pairing.deepLink ? (
                    <>Escanea el QR con tu teléfono o <a className="font-semibold text-sky-700 underline" href={pairing.deepLink} target="_blank" rel="noreferrer">abre el bot en Telegram</a>; luego pulsa Iniciar. También puedes enviar </>
                  ) : (
                    <>Envía </>
                  )}
                  <span className="font-mono font-semibold">/start {pairing.code}</span> al bot. El código dura 10 minutos y es de un solo uso (expira{" "}
                  {new Date(pairing.expiresAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}).
                </p>
              )}
              {pairing?.qrDataUrl && (
                <div className="flex flex-col items-center rounded-xl border border-sky-100 bg-white p-4 sm:w-fit">
                  <Image src={pairing.qrDataUrl} alt="QR para vincular Telegram" width={240} height={240} unoptimized />
                  <p className="mt-2 text-center text-xs text-slate-600">Escanéalo con tu teléfono y pulsa Iniciar en Telegram.</p>
                </div>
              )}
              {connectionNotice && <p role="status" className="text-xs font-semibold text-emerald-700">{connectionNotice}</p>}
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

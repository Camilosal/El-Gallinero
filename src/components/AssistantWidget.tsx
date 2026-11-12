"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, History, MessageSquare, Plus, Sparkles, X } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import ChatMarkdown from "@/components/ChatMarkdown";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface PendingAction {
  id: string;
  toolName: string;
  summary: string;
  status: string;
  createdAt: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage: string;
  pendingCount: number;
}

const STORAGE_KEY = "gallinero-assistant-conversation";

const SUGGESTIONS = [
  "¿Cómo está la granja hoy?",
  "¿Cuántos animales y huevos tengo?",
  "¿Qué producción hubo en el galpón principal este mes?",
  "¿Cómo van las finanzas este mes?",
  "¿Qué vacunas están pendientes?",
  "¿Qué tareas de mantenimiento están pendientes por lugar?",
  "¿Qué equipos requieren atención y qué tareas vencen esta semana?",
];

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [jevRouting, setJevRouting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, pendingActions, open, scrollToBottom]);

  useEffect(() => {
    if (!open) return;
    if (configured !== null) return;

    apiFetch("/api/asistente/estado")
      .then((res) => res.json())
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setJevRouting(Boolean(data.jevRouting));
      })
      .catch(() => setConfigured(false));
  }, [open, configured]);

  const loadConversation = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/asistente/conversaciones/${id}`);
    if (!res.ok) {
      localStorage.removeItem(STORAGE_KEY);
      setConversationId(null);
      setMessages([]);
      setPendingActions([]);
      return;
    }
    const data = await res.json();
    setConversationId(id);
    setMessages(
      (data.messages || [])
        .filter((row: any) => (row.role === "user" || row.role === "assistant") && row.content)
        .map((row: any) => ({
          id: row.id,
          role: row.role,
          content: row.content,
        })),
    );
    setPendingActions(data.pendingActions || []);
  }, []);

  useEffect(() => {
    if (!open) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) void Promise.resolve().then(() => loadConversation(stored)).catch(() => undefined);
  }, [open, loadConversation]);

  const refreshConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch("/api/asistente/conversaciones");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) refreshConversations().catch(() => undefined);
  };

  const selectConversation = async (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setHistoryOpen(false);
    setError("");
    await loadConversation(id);
  };

  const newConversation = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConversationId(null);
    setMessages([]);
    setPendingActions([]);
    setError("");
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    setError("");
    setSending(true);
    const optimistic: ChatMessage = { id: uid("user"), role: "user", content };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await apiFetch("/api/asistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: content }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "No se pudo obtener respuesta del asistente");
        return;
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(STORAGE_KEY, data.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: uid("assistant"),
          role: "assistant",
          content: data.reply || "No recibí una respuesta del asistente.",
        },
      ]);
      setPendingActions(data.pendingActions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión con el asistente");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const confirmAction = async (action: PendingAction) => {
    setBusyAction(action.id);
    setError("");
    try {
      const res = await apiFetch(`/api/asistente/acciones/${action.id}/confirmar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo confirmar la acción");
        setPendingActions((prev) => prev.filter((item) => item.id !== action.id));
        return;
      }
      setPendingActions((prev) => prev.filter((item) => item.id !== action.id));
      setMessages((prev) => [
        ...prev,
        { id: uid("assistant"), role: "assistant", content: data.message || "Acción ejecutada." },
      ]);
    } finally {
      setBusyAction(null);
    }
  };

  const cancelAction = async (action: PendingAction) => {
    setBusyAction(action.id);
    setError("");
    try {
      const res = await apiFetch(`/api/asistente/acciones/${action.id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelada por el usuario" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cancelar la acción");
        return;
      }
      setPendingActions((prev) => prev.filter((item) => item.id !== action.id));
      setMessages((prev) => [
        ...prev,
        { id: uid("assistant"), role: "assistant", content: data.message || "Acción cancelada." },
      ]);
    } finally {
      setBusyAction(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
      >
        {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        <span className="hidden sm:inline">{open ? "Cerrar" : "Asistente"}</span>
      </button>

      {open && (
        <section
          className="fixed bottom-20 right-3 z-40 flex h-[min(680px,78vh)] w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:right-5"
          aria-label="Asistente de la granja"
        >
          <header className="flex items-center justify-between gap-2 bg-green-800 px-4 py-3 text-white">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-green-200 shrink-0" />
                <h2 className="truncate text-sm font-semibold">Asistente de la granja</h2>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-green-100">
                <span
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${configured === null
                    ? "bg-slate-300"
                    : configured
                      ? "bg-blue-300"
                      : "bg-amber-300"
                    }`}
                />
                {configured === null
                  ? "Conectando..."
                  : configured
                    ? jevRouting ? "Asistente activo · Jev conectado" : "Asistente activo"
                    : "Sin configuración"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleHistory}
                className="rounded-lg p-1.5 hover:bg-green-700 transition-colors"
                aria-label="Historial de conversaciones"
                title="Historial"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={newConversation}
                className="rounded-lg p-1.5 hover:bg-green-700 transition-colors"
                aria-label="Nueva conversación"
                title="Nueva conversación"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 hover:bg-green-700 transition-colors"
                aria-label="Cerrar asistente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {historyOpen && (
            <div className="max-h-56 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3">
              {historyLoading ? (
                <p className="py-3 text-center text-xs text-slate-500">Cargando historial...</p>
              ) : conversations.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-500">Aún no hay conversaciones.</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${conversation.id === conversationId
                        ? "border-green-300 bg-green-50"
                        : "border-slate-200 bg-white hover:bg-slate-100"
                        }`}
                    >
                      <span className="block truncate font-medium text-slate-700">{conversation.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {conversation.lastMessage || "Sin mensajes"}
                      </span>
                      {conversation.pendingCount > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          {conversation.pendingCount} pendiente(s)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {configured === false && (
            <div className="border-b border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <p className="font-semibold">Asistente no configurado</p>
              <p className="mt-1">
                Falta <code className="rounded bg-amber-100 px-1">ASSISTANT_AI_API_KEY</code> en el servidor.
                Mientras tanto puedes usar todas las pantallas de la aplicación con normalidad.
              </p>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Sparkles className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Hola</span>
                </p>
                <p className="mt-1">
                  Puedo consultar animales, lugares, linaje, producción, mantenimiento, inventarios, sanidad y
                  finanzas; también registrar huevos, mortalidad, pesajes y consumo con su lugar cuando corresponda.
                  Las ventas, gastos e ingresos quedan pendientes para que los confirmes.
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Prueba con</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => sendMessage(suggestion)}
                      className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-800 hover:bg-green-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === "user"
                    ? "whitespace-pre-wrap rounded-br-md bg-green-700 text-white"
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                    }`}
                >
                  {message.role === "user" ? message.content : <ChatMarkdown content={message.content} />}
                </div>
              </div>
            ))}

            {pendingActions.length > 0 && (
              <div className="space-y-2">
                {pendingActions.map((action) => (
                  <div key={action.id} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      Acción pendiente de confirmación
                    </p>
                    <p className="mt-1 text-sm text-amber-900">{action.summary}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmAction(action)}
                        disabled={busyAction === action.id}
                        className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        {busyAction === action.id ? "Ejecutando..." : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelAction(action)}
                        disabled={busyAction === action.id}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500">
                  Pensando...
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={configured === false ? "Asistente no configurado" : "Escribe tu mensaje..."}
                disabled={configured === false || sending}
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={configured === false || sending || !input.trim()}
                className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Enter envía · Shift+Enter nueva línea · Verifica los datos antes de confirmar una acción.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

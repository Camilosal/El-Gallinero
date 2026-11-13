"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Brain,
  Camera,
  CheckCircle2,
  CloudOff,
  FileText,
  History,
  Loader2,
  Mic,
  Plus,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { compressImageToDataUrl, type OcrExtractionMode } from "@/lib/attachments-shared";
import { apiFetch } from "@/lib/fetch";
import ChatMarkdown from "@/components/ChatMarkdown";
import type { VoiceNoteEntry } from "@/lib/offline/db";
import {
  OPEN_ASSISTANT_VOICE_EVENT,
  VOICE_NOTES_CHANGED_EVENT,
  deleteOfflineVoiceNote,
  getAllVoiceNotes,
  getPendingVoiceNotes,
  isMediaRecorderSupported,
  isSpeechRecognitionSupported,
  pickSupportedAudioMimeType,
  saveOfflineVoiceNote,
  transcribeVoiceNoteOnServer,
} from "@/lib/offline/voiceNotes";

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
  "¿Qué tareas tengo en la rutina diaria hoy?",
  "¿Cómo va la rentabilidad por especie y lugar este mes?",
  "¿Cuántos días de alimento quedan y cuál es el FCR?",
  "¿Cómo van la reproducción de cuyes/conejos y la incubación?",
  "¿Hay alertas de sensores ITH/NH3, bioseguridad o compostaje?",
  "¿Qué vacunas, mantenimientos o vencimientos están pendientes?",
];

function GinaAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "sm"
      ? "h-6 w-6"
      : size === "lg"
      ? "h-12 w-12"
      : "h-9 w-9";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-amber-50 ring-2 ring-amber-200/80 shadow-xs overflow-hidden ${dims}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="32" fill="#FEF3C7" />
        {/* Cresta */}
        <path
          d="M23 18C21.5 13 26.5 10 29 14C30.5 9.5 36.5 10 36.5 15C40 12 44.5 15.5 41.5 20"
          fill="#DC2626"
        />
        {/* Cabeza y cuello */}
        <path
          d="M16 40C16 25 22.5 17 32 17C41.5 17 48 25 48 40C48 49 41.5 55 32 55C22.5 55 16 49 16 40Z"
          fill="#FFFFFF"
          stroke="#E2E8F0"
          strokeWidth="1.5"
        />
        {/* Mejillas suaves */}
        <ellipse cx="20.5" cy="37" rx="3.2" ry="2" fill="#FDA4AF" fillOpacity="0.6" />
        <ellipse cx="43.5" cy="37" rx="3.2" ry="2" fill="#FDA4AF" fillOpacity="0.6" />
        {/* Gafas redondas */}
        <circle cx="24" cy="31.5" r="7" fill="#E0F2FE" fillOpacity="0.45" stroke="#1E293B" strokeWidth="2.4" />
        <circle cx="40" cy="31.5" r="7" fill="#E0F2FE" fillOpacity="0.45" stroke="#1E293B" strokeWidth="2.4" />
        <path d="M31 31.2H33" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M14.5 29.5L17.2 30.8" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
        <path d="M49.5 29.5L46.8 30.8" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
        {/* Brillo en lentes */}
        <path d="M20.5 28.5L22.5 27" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M36.5 28.5L38.5 27" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        {/* Ojos tras las gafas */}
        <circle cx="24.5" cy="31.8" r="2.2" fill="#0F172A" />
        <circle cx="39.5" cy="31.8" r="2.2" fill="#0F172A" />
        <circle cx="25.2" cy="31" r="0.7" fill="#FFFFFF" />
        <circle cx="40.2" cy="31" r="0.7" fill="#FFFFFF" />
        {/* Barbilla */}
        <path d="M29 43.5C29 47.2 35 47.2 35 43.5Z" fill="#EF4444" />
        {/* Pico */}
        <path
          d="M27.2 38.5L32 35.2L36.8 38.5L32 43.8L27.2 38.5Z"
          fill="#F59E0B"
          stroke="#D97706"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readNowMs(): number {
  return Date.now();
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sttConfigured, setSttConfigured] = useState(false);
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
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memories, setMemories] = useState<Array<{ id: string; category: string; content: string; importance: number }>>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [ocrPickerOpen, setOcrPickerOpen] = useState(false);
  const [ocrMode, setOcrMode] = useState<OcrExtractionMode>("factura_compra");
  const [ocrScanning, setOcrScanning] = useState(false);
  const [pendingOcr, setPendingOcr] = useState<{
    mode: OcrExtractionMode;
    fileName: string;
    summary: string;
    extracted: Record<string, unknown>;
    provider: string;
  } | null>(null);

  const [voiceNotes, setVoiceNotes] = useState<VoiceNoteEntry[]>([]);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"dictation" | "audio" | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [processingNoteId, setProcessingNoteId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);
  const speechRecRef = useRef<any>(null);
  const startVoiceRef = useRef<(() => void) | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
  }, []);

  const refreshVoiceNotes = useCallback(async () => {
    try {
      const notes = await getAllVoiceNotes();
      setVoiceNotes(notes);
    } catch {
      // ignore IndexedDB errors
    }
  }, []);

  useEffect(() => {
    const nextUrls: Record<string, string> = {};
    for (const note of voiceNotes) {
      if (note.audioBlob instanceof Blob) {
        nextUrls[note.id] = URL.createObjectURL(note.audioBlob);
      }
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setAudioUrls(nextUrls);
    });
    return () => {
      active = false;
      Object.values(nextUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [voiceNotes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setIsOnline(navigator.onLine !== false);
      void refreshVoiceNotes();
    });

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onVoiceChange = () => {
      void refreshVoiceNotes();
    };
    const onOpenVoice = () => {
      setOpen(true);
      startVoiceRef.current?.();
      setTimeout(() => inputRef.current?.focus(), 60);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(VOICE_NOTES_CHANGED_EVENT, onVoiceChange);
    window.addEventListener(OPEN_ASSISTANT_VOICE_EVENT, onOpenVoice);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(VOICE_NOTES_CHANGED_EVENT, onVoiceChange);
      window.removeEventListener(OPEN_ASSISTANT_VOICE_EVENT, onOpenVoice);
    };
  }, [refreshVoiceNotes]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, pendingActions, voiceNotes.length, open, scrollToBottom]);

  useEffect(() => {
    if (!open && configured !== null) return;
    if (!isOnline && configured === null) return;
    if (configured !== null) return;

    apiFetch("/api/asistente/estado")
      .then((res) => res.json())
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setSttConfigured(Boolean(data.sttConfigured));
      })
      .catch(() => setConfigured(false));
  }, [open, configured, isOnline]);

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
    if (!open || !isOnline) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) void Promise.resolve().then(() => loadConversation(stored)).catch(() => undefined);
  }, [open, isOnline, loadConversation]);

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
    if (next) {
      setMemoryOpen(false);
      refreshConversations().catch(() => undefined);
    }
  };

  const refreshMemories = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const res = await apiFetch("/api/asistente/memoria");
      if (!res.ok) return;
      const data = await res.json();
      setMemories(Array.isArray(data.memories) ? data.memories : []);
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  const toggleMemory = () => {
    const next = !memoryOpen;
    setMemoryOpen(next);
    if (next) {
      setHistoryOpen(false);
      refreshMemories().catch(() => undefined);
    }
  };

  const addQuickMemory = async () => {
    const content = newMemoryText.trim();
    if (!content) return;
    const res = await apiFetch("/api/asistente/memoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, importance: 4 }),
    });
    if (res.ok) {
      setNewMemoryText("");
      await refreshMemories();
    }
  };

  const removeMemory = async (id: string) => {
    const res = await apiFetch(`/api/asistente/memoria?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setOcrScanning(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      const res = await apiFetch("/api/asistente/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: ocrMode,
          dataUrl: compressed.dataUrl,
          fileName: file.name,
          textHint: input.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo leer la imagen con OCR.");
        return;
      }
      const extracted = (data.extracted || {}) as Record<string, unknown>;
      const summary = String(extracted.summary || data.extractedText || file.name);
      setPendingOcr({
        mode: ocrMode,
        fileName: file.name,
        summary,
        extracted,
        provider: String(data.provider || "deterministic"),
      });
      setOcrPickerOpen(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la imagen");
    } finally {
      setOcrScanning(false);
    }
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

  const sendMessage = useCallback(
    async (text?: string): Promise<boolean> => {
      const typed = (text ?? input).trim();
      const ocrAttached = text === undefined ? pendingOcr : null;
      const content = ocrAttached
        ? [
            typed || "Analiza este documento escaneado y prepara el registro correspondiente si hace falta.",
            `[Documento OCR (${ocrAttached.mode}) · ${ocrAttached.fileName}]: ${ocrAttached.summary}`,
            `Datos extraídos: ${JSON.stringify(ocrAttached.extracted)}`,
          ].join("\n")
        : typed;

      if (!content || sending) return false;
      if (!isOnline) {
        setError("Sin conexión. Graba una nota de voz o usa + Crear para guardar en el teléfono.");
        return false;
      }

      setError("");
      setSending(true);
      const displayContent = ocrAttached
        ? `${typed ? `${typed}\n` : ""}📎 ${ocrAttached.fileName}: ${ocrAttached.summary}`
        : typed;
      const optimistic: ChatMessage = { id: uid("user"), role: "user", content: displayContent };
      setMessages((prev) => [...prev, optimistic]);
      if (text === undefined) {
        setInput("");
        setPendingOcr(null);
      }

      try {
        const res = await apiFetch("/api/asistente/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message: content }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error || "No se pudo obtener respuesta del asistente");
          return false;
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
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de conexión con el asistente");
        return false;
      } finally {
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [conversationId, input, isOnline, pendingOcr, sending],
  );

  useEffect(() => {
    if (!isOnline || !configured || !sttConfigured) return;
    let cancelled = false;
    void getPendingVoiceNotes().then(async (pending) => {
      for (const note of pending) {
        if (cancelled) break;
        const result = await transcribeVoiceNoteOnServer(note);
        if (result.text) {
          const sent = await sendMessage(result.text);
          if (sent) {
            await deleteOfflineVoiceNote(note.id);
          }
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOnline, configured, sttConfigured, sendMessage]);

  const stopAllRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
    setRecordingMode(null);
    setRecordingSeconds(0);
  }, []);

  useEffect(() => {
    return () => {
      stopAllRecording();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopAllRecording]);

  const startVoiceCapture = async (forceOfflineAudio = false) => {
    setError("");
    if (isRecording) {
      stopAllRecording();
      return;
    }

    if (isOnline && !forceOfflineAudio && isSpeechRecognitionSupported()) {
      try {
        const w = window as unknown as Record<string, any>;
        const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
        const recognition = new Recognition();
        recognition.lang = "es-CO";
        recognition.continuous = true;
        recognition.interimResults = true;
        const baseText = input.trim();

        recognition.onresult = (event: any) => {
          let finalText = "";
          let interimText = "";
          for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript || "";
            if (event.results[i].isFinal) finalText += transcript + " ";
            else interimText += transcript;
          }
          const combined = [baseText, (finalText + interimText).trim()].filter(Boolean).join(" ");
          setInput(combined);
        };
        recognition.onerror = (event: any) => {
          if (event?.error === "network" || !navigator.onLine) {
            stopAllRecording();
            void startVoiceCapture(true);
            return;
          }
          setError("No se pudo dictar por voz. Puedes grabar una nota de audio.");
          stopAllRecording();
        };
        recognition.onend = () => {
          setIsRecording(false);
          setRecordingMode(null);
        };

        speechRecRef.current = recognition;
        recognition.start();
        setIsRecording(true);
        setRecordingMode("dictation");
        return;
      } catch {
        // fallback to MediaRecorder
      }
    }

    if (!isMediaRecorderSupported()) {
      setError("Este navegador no permite grabar audio. Escribe tu mensaje cuando tengas red.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordStartRef.current = readNowMs();

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        const durationSec = Math.max(1, (readNowMs() - recordStartRef.current) / 1000);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        if (blob.size > 0) {
          await saveOfflineVoiceNote({
            audioBlob: blob,
            mimeType: blob.type,
            durationSec,
            conversationId,
          });
          await refreshVoiceNotes();
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingMode("audio");
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
    }
  };

  useEffect(() => {
    startVoiceRef.current = () => {
      if (!isRecording) {
        void startVoiceCapture(false);
      }
    };
  });

  const handleTranscribeAndSendNote = async (note: VoiceNoteEntry) => {
    if (!isOnline) {
      setError("Conéctate a Internet para procesar esta nota de voz.");
      return;
    }
    setError("");
    setProcessingNoteId(note.id);
    try {
      const result = await transcribeVoiceNoteOnServer(note);
      if (result.text) {
        const ok = await sendMessage(result.text);
        if (ok) {
          await deleteOfflineVoiceNote(note.id);
        }
      } else {
        setError(result.error || "No se pudo transcribir la nota");
      }
    } finally {
      setProcessingNoteId(null);
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
      void sendMessage();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-green-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xl transition hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
        aria-label={open ? "Cerrar a Gina" : "Hablar con Gina, tu asistente de granja"}
      >
        {open ? <X className="w-5 h-5" /> : <GinaAvatar size="sm" />}
        <span className="hidden sm:inline">{open ? "Cerrar" : "Gina"}</span>
        {voiceNotes.length > 0 && !open && (
          <span className="ml-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
            {voiceNotes.length}
          </span>
        )}
      </button>

      {open && (
        <section
          className="fixed bottom-20 right-3 z-40 flex h-[min(680px,78vh)] w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:right-5"
          aria-label="Gina, asistente de la granja"
        >
          <header className="flex items-center justify-between gap-2 bg-green-800 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <GinaAvatar size="md" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">Gina · Asistente de tu granja</h2>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-green-100">
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      !isOnline
                        ? "bg-amber-300"
                        : configured === null
                        ? "bg-slate-300"
                        : configured
                        ? "bg-emerald-300"
                        : "bg-amber-300"
                    }`}
                  />
                  {!isOnline
                    ? "Sin señal · Notas de voz listas para luego"
                    : configured === null
                    ? "Preparando a Gina..."
                    : configured
                    ? "Lista para ayudarte en tu granja"
                    : "Pendiente de activación"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleMemory}
                className={`rounded-lg p-1.5 transition-colors ${memoryOpen ? "bg-green-700" : "hover:bg-green-700"}`}
                aria-label="Memoria persistente"
                title="Memoria de la granja"
              >
                <Brain className="w-4 h-4" />
              </button>
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
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                        conversation.id === conversationId
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

          {memoryOpen && (
            <div className="max-h-64 overflow-y-auto border-b border-slate-200 bg-emerald-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-emerald-900">
                  Memoria persistente de la granja ({memories.length})
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addQuickMemory();
                  }}
                  placeholder="Ej: Proveedor principal Concentrados del Valle..."
                  className="flex-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => void addQuickMemory()}
                  disabled={!newMemoryText.trim()}
                  className="rounded-lg bg-green-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-800 disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
              {memoryLoading ? (
                <p className="py-2 text-center text-xs text-slate-500">Cargando memoria...</p>
              ) : memories.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-slate-500">
                  Aún no hay recuerdos guardados. Dile al asistente &quot;recuerda que...&quot;.
                </p>
              ) : (
                <div className="space-y-1">
                  {memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="min-w-0">
                        <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 mr-1.5">
                          {mem.category}
                        </span>
                        <span className="text-slate-700">{mem.content}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeMemory(mem.id)}
                        className="text-slate-400 hover:text-rose-600 shrink-0"
                        aria-label="Eliminar memoria"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isOnline && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-start gap-2">
              <CloudOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Estás sin señal. Pulsa el <strong>micrófono</strong> para grabar notas de voz locales o usa{" "}
                <strong>Crear</strong> para registrar datos offline.
              </p>
            </div>
          )}

          {isOnline && configured === false && (
            <div className="border-b border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <p className="font-semibold">Gina aún no está activada</p>
              <p className="mt-1">
                Falta <code className="rounded bg-amber-100 px-1">ASSISTANT_AI_API_KEY</code> en el servidor.
                Mientras tanto puedes usar todas las pantallas de la aplicación con normalidad.
              </p>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {voiceNotes.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-amber-700" />
                    <span>Notas de voz guardadas ({voiceNotes.length})</span>
                  </p>
                </div>
                <div className="space-y-2">
                  {voiceNotes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-amber-200 bg-white p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {note.durationSec}s
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteOfflineVoiceNote(note.id)}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Eliminar nota de voz"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {audioUrls[note.id] && (
                        <audio controls src={audioUrls[note.id]} className="w-full h-8" />
                      )}
                      {note.error && <p className="text-[11px] text-rose-600">{note.error}</p>}
                      {isOnline && (
                        <div className="flex flex-wrap gap-1.5">
                          {sttConfigured && (
                            <button
                              type="button"
                              onClick={() => handleTranscribeAndSendNote(note)}
                              disabled={processingNoteId === note.id}
                              className="rounded-lg bg-green-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                            >
                              {processingNoteId === note.id ? "Transcribiendo..." : "Transcribir y enviar"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => inputRef.current?.focus()}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Escuchar y escribir abajo
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 space-y-3">
                <div className="flex items-center gap-3">
                  <GinaAvatar size="lg" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">¡Hola! Soy Gina</p>
                    <p className="text-xs text-slate-500">
                      Tu compañera para llevar al día los animales, cultivos, cuentas y tareas.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3 space-y-1.5 text-xs text-slate-700">
                  <p className="font-semibold text-emerald-900">¿En qué puedo ayudarte?</p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span><strong>Anotar movimientos:</strong> huevos, alimento, gastos, ventas o traslados (siempre te pido confirmar antes de guardar).</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span><strong>Leer facturas y etiquetas:</strong> tómale foto con la cámara para cargar los datos rápido.</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span><strong>Revisar tu granja al instante:</strong> tareas de hoy, días de alimento, alertas sanitarias o balance del mes.</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span><strong>Recordar tus reglas:</strong> guarda indicaciones de tu finca en memoria (ícono del cerebro arriba).</span>
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pregúntame algo rápido</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void sendMessage(suggestion)}
                        disabled={!isOnline}
                        className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-left text-xs text-green-800 hover:bg-green-100 disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
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

          {isRecording && (
            <div className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                {recordingMode === "dictation"
                  ? "Escuchando dictado en español..."
                  : `Grabando nota de voz (${recordingSeconds}s)...`}
              </span>
              <button
                type="button"
                onClick={stopAllRecording}
                className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
              >
                <Square className="w-3 h-3" />
                Detener
              </button>
            </div>
          )}

          <div className="border-t border-slate-200 bg-white p-3 space-y-2">
            {ocrPickerOpen && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      ["factura_compra", "Factura"],
                      ["etiqueta_ica", "Etiqueta ICA"],
                      ["comprobante_pago", "Comprobante"],
                      ["rut_contacto", "RUT"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOcrMode(val)}
                      className={`rounded-md px-2 py-0.5 font-medium transition ${
                        ocrMode === val
                          ? "bg-green-700 text-white"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={ocrScanning || !isOnline}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {ocrScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  {ocrScanning ? "Leyendo..." : "Subir foto"}
                </button>
              </div>
            )}

            {pendingOcr && (
              <div className="flex items-start justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-900">
                <div className="flex items-start gap-1.5 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                  <p className="truncate">
                    <strong>{pendingOcr.fileName}:</strong> {pendingOcr.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingOcr(null)}
                  className="text-emerald-700 hover:text-rose-600 shrink-0"
                  aria-label="Quitar documento OCR"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void handleImageSelected(e)}
              className="hidden"
            />

            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => void startVoiceCapture(false)}
                className={`rounded-xl p-2.5 transition-colors shrink-0 ${
                  isRecording
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
                aria-label={isRecording ? "Detener voz" : isOnline ? "Dictar o grabar nota de voz" : "Grabar nota de voz offline"}
                title={isOnline ? "Dictar por voz" : "Grabar nota de voz offline"}
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOcrPickerOpen((prev) => !prev)}
                disabled={!isOnline || ocrScanning}
                className={`rounded-xl p-2.5 transition-colors shrink-0 ${
                  ocrPickerOpen || pendingOcr
                    ? "border border-green-500 bg-green-50 text-green-700"
                    : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                } disabled:opacity-40`}
                aria-label="Escanear factura o etiqueta con cámara"
                title="Escanear documento (Factura, Etiqueta ICA, Comprobante, RUT)"
              >
                {ocrScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={
                  !isOnline
                    ? "Graba una nota de voz..."
                    : configured === false
                    ? "Gina no está activada"
                    : "Ej: Recogí 140 huevos hoy..."
                }
                disabled={(!isOnline && !input.trim()) || (isOnline && configured === false) || sending}
                className="min-w-0 max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!isOnline || configured === false || sending || (!input.trim() && !pendingOcr)}
                className="rounded-xl bg-green-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40 inline-flex items-center gap-1"
                aria-label="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Escribe, dicta con el micrófono o envía foto de una factura.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

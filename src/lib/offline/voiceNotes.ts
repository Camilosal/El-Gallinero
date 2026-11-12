"use client";

import { v4 as uuidv4 } from "uuid";
import {
  VoiceNoteEntry,
  addVoiceNote,
  getAllVoiceNotes,
  getPendingVoiceNotes,
  removeVoiceNote,
  updateVoiceNote,
} from "./db";

export const VOICE_NOTES_CHANGED_EVENT = "gallinero-voice-notes-changed";
export const OPEN_ASSISTANT_VOICE_EVENT = "gallinero-open-assistant-voice";

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm";
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export async function saveOfflineVoiceNote(params: {
  audioBlob: Blob;
  mimeType: string;
  durationSec: number;
  transcriptHint?: string;
  conversationId?: string | null;
}): Promise<VoiceNoteEntry> {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uuidv4();
  const entry = await addVoiceNote({
    id,
    audioBlob: params.audioBlob,
    mimeType: params.mimeType || params.audioBlob.type || "audio/webm",
    durationSec: Math.max(1, Math.round(params.durationSec)),
    transcriptHint: params.transcriptHint?.trim() || undefined,
    conversationId: params.conversationId || null,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VOICE_NOTES_CHANGED_EVENT));
  }
  return entry;
}

export async function deleteOfflineVoiceNote(id: string): Promise<void> {
  await removeVoiceNote(id);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VOICE_NOTES_CHANGED_EVENT));
  }
}

export async function transcribeVoiceNoteOnServer(
  note: VoiceNoteEntry,
): Promise<{ configured: boolean; text?: string; error?: string }> {
  const form = new FormData();
  form.append("audio", note.audioBlob, `nota-${note.id}.webm`);

  try {
    const res = await fetch("/api/asistente/transcribir", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || `Error HTTP ${res.status}`;
      await updateVoiceNote(note.id, { status: data.configured === false ? "pending" : "error", error: msg });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(VOICE_NOTES_CHANGED_EVENT));
      }
      return { configured: Boolean(data.configured), error: msg };
    }
    const text = typeof data.text === "string" ? data.text.trim() : "";
    await updateVoiceNote(note.id, { status: "transcribed", transcriptHint: text, error: undefined });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(VOICE_NOTES_CHANGED_EVENT));
    }
    return { configured: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo conectar para transcribir";
    await updateVoiceNote(note.id, { status: "error", error: msg });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(VOICE_NOTES_CHANGED_EVENT));
    }
    return { configured: true, error: msg };
  }
}

export { getAllVoiceNotes, getPendingVoiceNotes, updateVoiceNote };

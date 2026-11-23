"use client";

import { useEffect, useState } from "react";
import { getPendingVoiceNotesCount } from "@/lib/offline/db";
import { VOICE_NOTES_CHANGED_EVENT } from "@/lib/offline/voiceNotes";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { PortalDialog } from "@/components/ui";
import { Cloud, CloudOff, Download, Mic, RefreshCw, AlertCircle, CheckCircle2, Smartphone, Trash2, X } from "lucide-react";

export default function OfflineSyncStatus() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncError,
    mirrorState,
    outboxItems,
    syncNow,
    saveOfflineCopy,
    discardItem,
  } = useOfflineSync();

  const [isOpen, setIsOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [voiceCount, setVoiceCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      void getPendingVoiceNotesCount().then(setVoiceCount).catch(() => {});
    };
    refresh();
    window.addEventListener(VOICE_NOTES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(VOICE_NOTES_CHANGED_EVENT, refresh);
  }, []);

  const handleSyncClick = async () => {
    setSyncFeedback(null);
    const result = await syncNow();
    if (result.success) {
      setSyncFeedback(result.synced > 0 ? `¡${result.synced} registro(s) sincronizado(s) con éxito!` : "Todo está al día.");
    } else {
      setSyncFeedback(`Error: ${result.failed} registro(s) no pudieron enviarse.`);
    }
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  const handleSaveOfflineCopy = async () => {
    setSyncFeedback(null);
    const result = await saveOfflineCopy();
    if (result.lastError) {
      setSyncFeedback(result.lastError);
    } else {
      setSyncFeedback(`Copia offline guardada (${result.routesCached} pantallas y ${result.endpointsCached} módulos).`);
    }
    setTimeout(() => setSyncFeedback(null), 6000);
  };

  const mirrorProgressPct =
    mirrorState.total > 0 ? Math.min(100, Math.round((mirrorState.completed / mirrorState.total) * 100)) : 0;

  // Determinar apariencia del botón principal
  let badgeColor =
    "bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)] border-[var(--iw-semantic-border-default)]";
  let Icon = Cloud;
  let text = "En línea";

  if (isSyncing) {
    badgeColor =
      "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-status-info)] border-[var(--iw-semantic-status-info)]/40 animate-pulse";
    Icon = RefreshCw;
    text = "Sincronizando...";
  } else if (mirrorState.isMirroring && isOnline) {
    badgeColor =
      "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-status-info)] border-[var(--iw-semantic-status-info)]/40";
    Icon = Download;
    text = `Copiando (${mirrorProgressPct}%)`;
  } else if (!isOnline) {
    badgeColor =
      "bg-[var(--iw-color-paper)] text-[var(--iw-semantic-status-warning)] border-[var(--iw-semantic-status-warning)]/40";
    Icon = CloudOff;
    text = pendingCount > 0 ? `Offline (${pendingCount})` : "Sin conexión";
  } else if (pendingCount > 0) {
    badgeColor =
      "bg-[var(--iw-color-paper)] text-[var(--iw-semantic-status-warning)] border-[var(--iw-semantic-status-warning)]/40";
    Icon = RefreshCw;
    text = `${pendingCount} pendiente(s)`;
  } else if (syncError) {
    badgeColor =
      "bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-status-danger)] border-[var(--iw-semantic-status-danger)]/40";
    Icon = AlertCircle;
    text = "Revisar sync";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`relative inline-flex h-9 min-h-[36px] w-9 justify-center items-center gap-1.5 px-0 sm:h-10 sm:min-h-[40px] sm:w-auto sm:px-3 py-0 rounded-[var(--iw-radius-control)] text-xs sm:text-sm font-semibold border shadow-xs transition-colors hover:brightness-95 shrink-0 ${badgeColor}`}
        title={`${text} — Ver estado de conexión, copia offline y sincronización`}
        aria-label={text}
      >
        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline whitespace-nowrap">{text}</span>
      </button>

      {/* Modal / Dialog de estado de sincronización */}
      <PortalDialog open={isOpen} onClose={() => setIsOpen(false)} ariaLabel="Estado de conexión y sincronización" size="md">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <CheckCircle2 className="w-5 h-5 text-[var(--iw-semantic-status-success)]" />
            ) : (
              <CloudOff className="w-5 h-5 text-[var(--iw-semantic-status-warning)]" />
            )}
            <div>
              <h2 className="font-display text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                {isOnline ? "Conectado a Internet" : "Modo Sin Conexión (Offline)"}
              </h2>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)]">
                {isOnline
                  ? "Los cambios se guardan y sincronizan con la nube"
                  : "Tus registros se guardan en el teléfono de forma segura"}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-page)] rounded-[var(--iw-radius-control)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
              {/* Notificación de feedback */}
              {syncFeedback && (
                <div className="p-3 bg-[var(--iw-semantic-bg-feature)] border border-[var(--iw-semantic-status-success)]/35 text-[var(--iw-semantic-status-success)] rounded-[var(--iw-radius-control)] text-xs font-medium">
                  {syncFeedback}
                </div>
              )}

              {syncError && (
                <div className="p-3 bg-[var(--iw-semantic-bg-subtle)] border border-[var(--iw-semantic-status-danger)]/40 text-[var(--iw-semantic-status-danger)] rounded-[var(--iw-radius-control)] text-xs">
                  <p className="font-semibold">Problema al sincronizar:</p>
                  <p>{syncError}</p>
                </div>
              )}

              {/* Copia local de la app en este dispositivo */}
              <div className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Smartphone className="w-4 h-4 text-[var(--iw-semantic-action-primary)] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">Copia completa en el dispositivo</p>
                      <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                        {mirrorState.lastSyncedAt
                          ? `Guardada: ${mirrorState.routesCached} pantallas · ${mirrorState.endpointsCached} módulos de datos`
                          : "Guarda toda la app y datos para navegar cualquier módulo sin internet"}
                      </p>
                      {mirrorState.lastSyncedAt && (
                        <p className="text-[10px] text-[var(--iw-semantic-text-secondary)] mt-0.5">
                          Última copia:{" "}
                          {new Date(mirrorState.lastSyncedAt).toLocaleString([], {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveOfflineCopy}
                    disabled={!isOnline || mirrorState.isMirroring}
                    className="inline-flex min-h-[36px] items-center gap-1 px-2.5 py-1.5 rounded-[var(--iw-radius-control)] text-[11px] font-semibold bg-[var(--iw-semantic-bg-surface)] border border-[var(--iw-semantic-border-default)] text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-page)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-2xs"
                  >
                    <Download className={`w-3.5 h-3.5 ${mirrorState.isMirroring ? "animate-bounce text-[var(--iw-semantic-status-info)]" : ""}`} />
                    {mirrorState.isMirroring
                      ? `${mirrorProgressPct}%`
                      : mirrorState.lastSyncedAt
                      ? "Actualizar copia"
                      : "Guardar copia"}
                  </button>
                </div>

                {mirrorState.isMirroring && (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-[var(--iw-semantic-border-default)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--iw-semantic-status-info)] transition-all duration-200"
                        style={{ width: `${mirrorProgressPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--iw-semantic-text-secondary)] truncate">{mirrorState.currentLabel}</p>
                  </div>
                )}

                {mirrorState.lastError && !mirrorState.isMirroring && (
                  <p className="text-[10px] text-[var(--iw-semantic-status-danger)] font-medium">{mirrorState.lastError}</p>
                )}
              </div>

              {voiceCount > 0 && (
                <div className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-warning)]/35 bg-[var(--iw-color-paper)] p-3 flex items-center justify-between gap-2 text-xs text-[var(--iw-semantic-status-warning)]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mic className="w-4 h-4 shrink-0" />
                    {voiceCount} nota(s) de voz pendiente(s) en el Asistente
                  </span>
                </div>
              )}

              {/* Estado de la cola */}
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--iw-semantic-text-secondary)] mb-2">
                  <span className="font-semibold text-[var(--iw-semantic-text-primary)]">Registros pendientes en este dispositivo</span>
                  <span className="bg-[var(--iw-semantic-bg-subtle)] border border-[var(--iw-semantic-border-default)] px-2 py-0.5 rounded-full font-mono text-[var(--iw-semantic-text-primary)] tabular-nums">
                    {pendingCount}
                  </span>
                </div>

                {outboxItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-[var(--iw-semantic-border-default)] rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-subtle)]">
                    <CheckCircle2 className="w-8 h-8 text-[var(--iw-semantic-status-success)] mx-auto mb-1 opacity-85" />
                    <p className="text-xs text-[var(--iw-semantic-text-primary)] font-medium">No hay registros pendientes</p>
                    <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">Todos los datos de tu granja están sincronizados</p>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {outboxItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-2.5 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-2xs text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[var(--iw-semantic-text-primary)] capitalize">
                              {item.entity}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                item.status === "synced"
                                  ? "bg-[var(--iw-semantic-status-success)] text-white"
                                  : item.status === "failed"
                                  ? "bg-[var(--iw-semantic-status-danger)] text-white"
                                  : item.status === "syncing"
                                  ? "bg-[var(--iw-semantic-status-info)] text-white"
                                  : "bg-[var(--iw-semantic-status-warning)] text-white"
                              }`}
                            >
                              {item.status === "synced"
                                ? "Sincronizado"
                                : item.status === "failed"
                                ? "Reintentar"
                                : item.status === "syncing"
                                ? "Enviando..."
                                : "Pendiente"}
                            </span>
                          </div>
                          <p className="text-[var(--iw-semantic-text-secondary)] text-[11px]">{item.description}</p>
                          <p className="text-[10px] text-[var(--iw-semantic-text-secondary)] tabular-nums">
                            {new Date(item.clientTimestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {new Date(item.clientTimestamp).toLocaleDateString()}
                          </p>
                          {item.error && (
                            <p className="text-[10px] text-[var(--iw-semantic-status-danger)] font-medium">{item.error}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => discardItem(item.id)}
                          aria-label="Descartar este registro local"
                          className="text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-status-danger)] p-1.5 rounded-[var(--iw-radius-control)] transition-colors"
                          title="Descartar este registro local"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lastSyncTime && (
                <p className="text-[11px] text-[var(--iw-semantic-text-secondary)] text-center tabular-nums">
                  Última sincronización: {new Date(lastSyncTime).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="shrink-0 px-5 py-3 bg-[var(--iw-semantic-bg-subtle)] border-t border-[var(--iw-semantic-border-default)] flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                {isOnline ? "Conexión activa" : "Sin conexión celular/Wi-Fi"}
              </span>

              <button
                type="button"
                onClick={handleSyncClick}
                disabled={!isOnline || isSyncing || pendingCount === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 rounded-[var(--iw-radius-control)] text-xs font-semibold text-[var(--iw-semantic-action-primary-text)] bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
            </div>
      </PortalDialog>
    </>
  );
}

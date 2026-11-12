"use client";

import { useEffect, useState } from "react";
import { getPendingVoiceNotesCount } from "@/lib/offline/db";
import { VOICE_NOTES_CHANGED_EVENT } from "@/lib/offline/voiceNotes";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
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
  let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let Icon = Cloud;
  let text = "En línea";

  if (isSyncing) {
    badgeColor = "bg-blue-50 text-blue-700 border-blue-200 animate-pulse";
    Icon = RefreshCw;
    text = "Sincronizando...";
  } else if (mirrorState.isMirroring && isOnline) {
    badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
    Icon = Download;
    text = `Copiando (${mirrorProgressPct}%)`;
  } else if (!isOnline) {
    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    Icon = CloudOff;
    text = pendingCount > 0 ? `Offline (${pendingCount})` : "Sin conexión";
  } else if (pendingCount > 0) {
    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    Icon = RefreshCw;
    text = `${pendingCount} pendiente(s)`;
  } else if (syncError) {
    badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
    Icon = AlertCircle;
    text = "Revisar sync";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border shadow-xs transition-colors hover:brightness-95 shrink-0 ${badgeColor}`}
        title="Ver estado de conexión, copia offline y sincronización"
      >
        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
        <span className="whitespace-nowrap">{text}</span>
      </button>

      {/* Modal / Dialog de estado de sincronización */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Cabecera */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <CloudOff className="w-5 h-5 text-amber-600" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {isOnline ? "Conectado a Internet" : "Modo Sin Conexión (Offline)"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isOnline
                      ? "Los cambios se guardan y sincronizan con la nube"
                      : "Tus registros se guardan en el teléfono de forma segura"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 space-y-4">
              {/* Notificación de feedback */}
              {syncFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
                  {syncFeedback}
                </div>
              )}

              {syncError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                  <p className="font-semibold">Problema al sincronizar:</p>
                  <p>{syncError}</p>
                </div>
              )}

              {/* Copia local de la app en este dispositivo */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Copia completa en el dispositivo</p>
                      <p className="text-[11px] text-slate-500">
                        {mirrorState.lastSyncedAt
                          ? `Guardada: ${mirrorState.routesCached} pantallas · ${mirrorState.endpointsCached} módulos de datos`
                          : "Guarda toda la app y datos para navegar cualquier módulo sin internet"}
                      </p>
                      {mirrorState.lastSyncedAt && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-2xs"
                  >
                    <Download className={`w-3.5 h-3.5 ${mirrorState.isMirroring ? "animate-bounce text-blue-600" : ""}`} />
                    {mirrorState.isMirroring
                      ? `${mirrorProgressPct}%`
                      : mirrorState.lastSyncedAt
                      ? "Actualizar copia"
                      : "Guardar copia"}
                  </button>
                </div>

                {mirrorState.isMirroring && (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-200"
                        style={{ width: `${mirrorProgressPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{mirrorState.currentLabel}</p>
                  </div>
                )}

                {mirrorState.lastError && !mirrorState.isMirroring && (
                  <p className="text-[10px] text-rose-600 font-medium">{mirrorState.lastError}</p>
                )}
              </div>

              {voiceCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-2 text-xs text-amber-900">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mic className="w-4 h-4 text-amber-700 shrink-0" />
                    {voiceCount} nota(s) de voz pendiente(s) en el Asistente
                  </span>
                </div>
              )}

              {/* Estado de la cola */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                  <span className="font-semibold text-slate-700">Registros pendientes en este dispositivo</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full font-mono text-slate-600">
                    {pendingCount}
                  </span>
                </div>

                {outboxItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-80" />
                    <p className="text-xs text-slate-600 font-medium">No hay registros pendientes</p>
                    <p className="text-[11px] text-slate-400">Todos los datos del gallinero están sincronizados</p>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {outboxItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800 capitalize">
                              {item.entity}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                                item.status === "synced"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.status === "failed"
                                  ? "bg-rose-100 text-rose-800"
                                  : item.status === "syncing"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
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
                          <p className="text-slate-600 text-[11px]">{item.description}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(item.clientTimestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {new Date(item.clientTimestamp).toLocaleDateString()}
                          </p>
                          {item.error && (
                            <p className="text-[10px] text-rose-600 font-medium">{item.error}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => discardItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
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
                <p className="text-[11px] text-slate-400 text-center">
                  Última sincronización: {new Date(lastSyncTime).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Pie con acciones */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                {isOnline ? "Conexión activa" : "Sin conexión celular/Wi-Fi"}
              </span>

              <button
                type="button"
                onClick={handleSyncClick}
                disabled={!isOnline || isSyncing || pendingCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

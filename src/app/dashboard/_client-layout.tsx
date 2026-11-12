"use client";

import { useState, useEffect } from "react";
import { Mic, Plus } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import AssistantWidget from "@/components/AssistantWidget";
import QuickCreateMenu from "@/components/QuickCreateMenu";
import QuickCaptureModal from "@/components/QuickCaptureModal";
import OfflineSyncStatus from "@/components/OfflineSyncStatus";
import GlobalSearch from "@/components/GlobalSearch";
import { initOfflineMirrorAutoSync } from "@/lib/offline/offlineMirror";
import { openQuickCapture } from "@/lib/quick-capture-events";
import { OPEN_ASSISTANT_VOICE_EVENT } from "@/lib/offline/voiceNotes";

const COLLAPSED_KEY = "sidebar-collapsed";

export default function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
    });

    const cleanupMirror = initOfflineMirrorAutoSync();

    // Listen for sidebar toggle events
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setCollapsed(detail.collapsed);
    };
    window.addEventListener("sidebar-toggle", handler);
    return () => {
      active = false;
      cleanupMirror();
      window.removeEventListener("sidebar-toggle", handler);
    };
  }, []);

  const marginClass = collapsed ? "md:ml-16" : "md:ml-64";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={`flex-1 ${marginClass} p-4 pb-24 md:p-6 md:pb-6 overflow-auto transition-all duration-300`}>
        <div className="mb-4 flex items-center md:justify-end gap-2 sm:gap-3 border-b border-slate-200 pb-3 pl-11 md:pl-0">
          <OfflineSyncStatus />
          <div className="flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-xs lg:max-w-sm">
            <GlobalSearch variant="topbar" className="w-full" />
          </div>
          <QuickCreateMenu />
        </div>
        {children}
      </main>

      {/* Mobile 1-hand quick dock (bottom-left so AssistantWidget stays clear bottom-right) */}
      <div className="fixed bottom-5 left-4 z-40 flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => openQuickCapture({ mode: "huevos" })}
          className="inline-flex items-center gap-1.5 rounded-full bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-900/25 transition-transform active:scale-95"
          aria-label="Abrir registro rápido"
        >
          <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
          <span>Registrar</span>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_VOICE_EVENT))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-green-700 shadow-lg transition-transform active:scale-95"
          aria-label="Dictar nota de voz"
          title="Dictar nota de voz"
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <QuickCaptureModal />
      <AssistantWidget />
    </div>
  );
}

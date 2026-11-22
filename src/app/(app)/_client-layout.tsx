"use client";

import { useState, useEffect } from "react";
import { Bug, Mic, Plus } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import AssistantWidget from "@/components/AssistantWidget";
import QuickCreateMenu from "@/components/QuickCreateMenu";
import QuickCaptureModal from "@/components/QuickCaptureModal";
import DashboardBreadcrumb from "@/components/DashboardBreadcrumb";
import BugReportModal from "@/components/BugReportModal";
import OfflineSyncStatus from "@/components/OfflineSyncStatus";
import GlobalSearch from "@/components/GlobalSearch";
import { ScaleModeControl } from "@/components/ScaleModeControl";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { initOfflineMirrorAutoSync } from "@/lib/offline/offlineMirror";
import { openQuickCapture } from "@/lib/quick-capture-events";
import { OPEN_ASSISTANT_VOICE_EVENT } from "@/lib/offline/voiceNotes";
import {
  BUG_REPORT_UPDATED_EVENT,
  getOfflineBugReports,
  openBugReportModal,
} from "@/lib/bug-report";

const COLLAPSED_KEY = "sidebar-collapsed";

export default function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [queuedBugCount, setQueuedBugCount] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
        setQueuedBugCount(getOfflineBugReports().length);
      }
    });

    const cleanupMirror = initOfflineMirrorAutoSync();

    // Listen for sidebar toggle events
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setCollapsed(detail.collapsed);
    };
    const bugQueueHandler = () => {
      setQueuedBugCount(getOfflineBugReports().length);
    };
    window.addEventListener("sidebar-toggle", handler);
    window.addEventListener(BUG_REPORT_UPDATED_EVENT, bugQueueHandler);
    return () => {
      active = false;
      cleanupMirror();
      window.removeEventListener("sidebar-toggle", handler);
      window.removeEventListener(BUG_REPORT_UPDATED_EVENT, bugQueueHandler);
    };
  }, []);

  const marginClass = collapsed ? "md:ml-16" : "md:ml-64";

  return (
    <div className="flex min-h-screen bg-[var(--iw-semantic-bg-page)] text-[var(--iw-semantic-text-primary)]">
      <Sidebar />
      <main className={`flex-1 ${marginClass} p-4 pb-24 md:p-6 md:pb-6 overflow-auto transition-all duration-300`}>
        <div className="mb-4 flex items-center md:justify-end gap-2 sm:gap-3 border-b border-[var(--iw-semantic-border-default)] pb-3 pl-12 md:pl-0">
          <OfflineSyncStatus />
          <div className="flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-xs lg:max-w-sm">
            <GlobalSearch variant="topbar" className="w-full" />
          </div>
          <ScaleModeControl variant="topbar" />
          <button
            type="button"
            onClick={() => openBugReportModal({ triggerSource: "topbar" })}
            title="Reportar una falla o inconsistencia desde esta pantalla"
            aria-label="Reportar falla"
            className="relative inline-flex h-10 min-h-[40px] items-center gap-1.5 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-semantic-bg-surface)] hover:bg-[var(--iw-semantic-bg-subtle)] px-3 py-0 text-xs sm:text-sm font-semibold text-[var(--iw-semantic-status-danger)] shadow-xs transition-colors shrink-0"
          >
            <Bug className="h-3.5 w-3.5 text-[var(--iw-semantic-status-danger)]" aria-hidden="true" />
            <span className="hidden lg:inline">Reportar falla</span>
            {queuedBugCount > 0 && (
              <span
                title={`${queuedBugCount} reporte(s) pendientes por enviar`}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--iw-semantic-status-danger)] px-1 text-[10px] font-bold text-white tabular-nums"
              >
                {queuedBugCount}
              </span>
            )}
          </button>
          <QuickCreateMenu />
        </div>
        <DashboardBreadcrumb />
        {children}
        <footer className="mt-10 border-t border-[var(--iw-semantic-border-default)] pt-4 flex flex-wrap items-center justify-between gap-3">
          <DeveloperCredit variant="inline" showAppName />
          <button
            type="button"
            onClick={() => openBugReportModal({ triggerSource: "footer" })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--iw-semantic-text-secondary)] hover:text-[var(--iw-semantic-status-danger)] hover:underline"
          >
            <Bug className="h-3.5 w-3.5" aria-hidden="true" />
            <span>¿Notaste alguna falla en esta vista? Repórtala aquí</span>
          </button>
        </footer>
      </main>

      {/* Mobile 1-hand quick dock (bottom-left so AssistantWidget stays clear bottom-right) */}
      <div className="fixed bottom-5 left-4 z-40 flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => openQuickCapture({ mode: "huevos" })}
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] px-5 py-3 text-sm font-semibold text-[var(--iw-semantic-action-primary-text)] shadow-[var(--iw-shadow-popover)] transition-transform active:scale-95"
          aria-label="Abrir registro rápido"
        >
          <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
          <span>Registrar</span>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_VOICE_EVENT))}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-action-primary)] shadow-[var(--iw-shadow-popover)] transition-transform active:scale-95"
          aria-label="Dictar nota de voz"
          title="Dictar nota de voz"
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <QuickCaptureModal />
      <BugReportModal />
      <AssistantWidget />
    </div>
  );
}

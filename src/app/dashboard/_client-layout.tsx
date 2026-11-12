"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import AssistantWidget from "@/components/AssistantWidget";
import QuickCreateMenu from "@/components/QuickCreateMenu";
import OfflineSyncStatus from "@/components/OfflineSyncStatus";
import GlobalSearch from "@/components/GlobalSearch";
import { initOfflineMirrorAutoSync } from "@/lib/offline/offlineMirror";

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
      <main className={`flex-1 ${marginClass} p-4 md:p-6 overflow-auto transition-all duration-300`}>
        <div className="mb-4 flex items-center md:justify-end gap-2 sm:gap-3 border-b border-slate-200 pb-3 pl-11 md:pl-0">
          <OfflineSyncStatus />
          <div className="flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-xs lg:max-w-sm">
            <GlobalSearch variant="topbar" className="w-full" />
          </div>
          <QuickCreateMenu />
        </div>
        {children}
      </main>
      <AssistantWidget />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import AssistantWidget from "@/components/AssistantWidget";

const COLLAPSED_KEY = "sidebar-collapsed";

export default function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Read initial state
    const stored = localStorage.getItem(COLLAPSED_KEY);
    setCollapsed(stored === "true");

    // Listen for sidebar toggle events
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setCollapsed(detail.collapsed);
    };
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  const marginClass = collapsed ? "md:ml-16" : "md:ml-64";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={`flex-1 ${marginClass} p-4 md:p-6 overflow-auto transition-all duration-300`}>
        {children}
      </main>
      <AssistantWidget />
    </div>
  );
}

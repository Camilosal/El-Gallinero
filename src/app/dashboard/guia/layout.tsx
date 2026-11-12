"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, ExternalLink } from "lucide-react";

export default function DashboardGuiaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const slug = pathname.startsWith("/dashboard/guia/")
    ? pathname.slice("/dashboard/guia/".length).split("/")[0] || ""
    : "";
  const standaloneHref = slug ? `/guia/${slug}` : "/guia";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50/80 px-4 py-3 text-xs text-green-900">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />
          <span>
            ¿Prefieres leer el manual a pantalla completa sin ocultar tu trabajo?
          </span>
        </div>
        <a
          href={standaloneHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-green-800 px-3 py-1.5 font-semibold text-white shadow-2xs transition-colors hover:bg-green-900"
        >
          <span>Abrir en hoja aparte</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      </div>

      {children}
    </div>
  );
}

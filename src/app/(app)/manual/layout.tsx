"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, ExternalLink } from "lucide-react";

export default function DashboardGuiaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const slug = pathname.startsWith("/manual/")
    ? pathname.slice("/manual/".length).split("/")[0] || ""
    : "";
  const standaloneHref = slug ? `/guia/${slug}` : "/guia";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] px-4 py-3 text-xs text-[var(--iw-semantic-text-primary)]">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-[var(--iw-semantic-action-primary)]" aria-hidden="true" />
          <span>
            ¿Prefieres leer el manual a pantalla completa sin ocultar tu trabajo?
          </span>
        </div>
        <a
          href={standaloneHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-action-primary)] px-3.5 py-1.5 font-semibold text-[var(--iw-semantic-action-primary-text)] shadow-2xs transition-colors hover:bg-[var(--iw-semantic-action-primary-hover)]"
        >
          <span>Abrir en hoja aparte</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      </div>

      {children}
    </div>
  );
}

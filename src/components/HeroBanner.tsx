"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, Lightbulb } from "lucide-react";
import { HeroFrame } from "@/components/HeroFrame";
import { resolveHeroThemeByPath, type HeroThemeKey } from "@/lib/hero-themes";

function renderHelpBody(text: string) {
  const normalized = text.replace(/\\n/g, "\n");
  const parts = normalized.split(/\n/).filter((p) => p.trim());
  if (parts.length <= 1) return <>{text}</>;
  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        const trimmed = part.replace(/^[•\-]\s*/, "").trim();
        const isBullet = part.trim().startsWith("•") || part.trim().startsWith("-");
        return (
          <div key={i} className="flex gap-2">
            {isBullet && <span className="text-blue-500 flex-shrink-0">•</span>}
            <span>{trimmed}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface HeroBannerProps {
  theme?: HeroThemeKey;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  icon?: string | ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  help?: string;
  helpTitle?: string;
  priority?: "high" | "auto";
  compact?: boolean;
  className?: string;
}

/**
 * Encabezado temático interactivo para páginas del dashboard.
 * Resuelve automáticamente el tema visual según la ruta actual si no se pasa `theme`,
 * evitando `useSearchParams()` para no romper el prerenderizado estático de Next.js.
 */
export function HeroBanner({
  theme,
  title,
  description,
  eyebrow,
  icon,
  actions,
  badge,
  help,
  helpTitle = "Cómo usar esta sección",
  priority = "high",
  compact = false,
  className = "mb-6",
}: HeroBannerProps) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  const resolvedTheme = theme ?? resolveHeroThemeByPath(pathname);

  const combinedActions =
    help || actions ? (
      <>
        {help && (
          <button
            type="button"
            onClick={() => setHelpOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-white/15 backdrop-blur-sm border-white/25 text-white hover:bg-white/25 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{helpOpen ? "Ocultar ayuda" : "Ayuda"}</span>
          </button>
        )}
        {actions && <div className="flex flex-wrap items-end gap-2">{actions}</div>}
      </>
    ) : undefined;

  return (
    <div className={className}>
      <HeroFrame
        theme={resolvedTheme}
        title={title}
        description={description}
        eyebrow={eyebrow}
        icon={icon}
        badge={badge}
        actions={combinedActions}
        priority={priority}
        compact={compact}
      />

      {help && helpOpen && (
        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900 mb-1">{helpTitle}</p>
              <div>{renderHelpBody(help)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


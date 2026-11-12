import type { ReactNode } from "react";
import { AppIcon } from "@/components/AppIcon";
import { HERO_THEMES, type HeroThemeKey } from "@/lib/hero-themes";

export interface HeroFrameProps {
  theme: HeroThemeKey;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  icon?: string | ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  priority?: "high" | "auto";
  compact?: boolean;
  className?: string;
  imagePositionClass?: string;
}

/**
 * Contenedor visual reutilizable (compatible con Server y Client Components)
 * para encabezados temáticos con ilustración en acuarela + velo de contraste.
 */
export function HeroFrame({
  theme,
  title,
  description,
  eyebrow,
  icon,
  actions,
  badge,
  priority = "high",
  compact = false,
  className = "",
  imagePositionClass = "",
}: HeroFrameProps) {
  const config = HERO_THEMES[theme] ?? HERO_THEMES.inicio;
  const resolvedEyebrow = eyebrow ?? config.eyebrow;

  const renderedIcon = (() => {
    if (!icon) return null;
    if (typeof icon === "string") {
      return <AppIcon icon={icon} className="w-4 h-4 text-amber-200 shrink-0" />;
    }
    return icon;
  })();

  return (
    <div
      className={`gallinero-hero rounded-2xl border border-emerald-950/20 shadow-sm ring-1 ring-inset ring-white/10 ${
        compact ? "px-5 py-4 sm:px-6 sm:py-5" : "px-5 py-5 sm:px-7 sm:py-6"
      } ${className}`}
    >
      <picture className="gallinero-hero-picture">
        <source
          type="image/webp"
          srcSet={`${config.src1xWebp} 1x, ${config.src2xWebp} 2x`}
        />
        <img
          src={config.fallbackJpg}
          alt=""
          aria-hidden="true"
          width={1600}
          height={560}
          decoding="async"
          fetchPriority={priority === "high" ? "high" : undefined}
          className={`gallinero-hero-img ${imagePositionClass}`}
        />
      </picture>
      <div className="gallinero-hero-scrim" aria-hidden="true" />

      <div
        className={`relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
          compact ? "min-h-[84px]" : "min-h-[104px] sm:min-h-[116px]"
        }`}
      >
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 backdrop-blur-[2px] border border-white/15 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-amber-100">
              {renderedIcon ?? (
                <span className={`w-1.5 h-1.5 rounded-full ${config.accentDotClass}`} aria-hidden="true" />
              )}
              <span>{resolvedEyebrow}</span>
            </span>
            {badge}
          </div>

          <h1
            className={`${
              compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-[1.7rem]"
            } font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] leading-tight`}
          >
            {title}
          </h1>

          {description && (
            <p className="mt-1.5 text-sm sm:text-[15px] text-emerald-50/90 leading-relaxed max-w-xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="relative z-10 flex flex-wrap items-end gap-2 shrink-0 [&_label]:!text-emerald-50 [&_select]:!bg-white/95 [&_select]:!text-slate-800 [&_select]:!border-white/30 [&_input]:!bg-white/95 [&_input]:!text-slate-800 [&_input]:!border-white/30">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}


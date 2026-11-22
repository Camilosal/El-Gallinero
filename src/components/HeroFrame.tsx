import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { HERO_THEMES, type HeroThemeKey } from "@/lib/hero-themes";

export type HeroActionTone = "glass" | "solid" | "accent";

const BASE_HERO_ACTION_CLS =
  "inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs sm:text-[13px] font-semibold rounded-[var(--iw-radius-control)] border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iw-semantic-focus-ring)]";

const HERO_ACTION_TONE_CLS: Record<HeroActionTone, string> = {
  glass: "bg-white/15 backdrop-blur-sm border-white/25 text-white hover:bg-white/25",
  solid:
    "bg-[var(--iw-color-paper)] border-[var(--iw-color-paper)] text-[var(--iw-color-ink-strong)] shadow-sm hover:bg-[var(--iw-color-white)]",
  accent:
    "bg-[var(--iw-color-ochre)] border-[var(--iw-color-paper)]/40 text-[var(--iw-color-ink-strong)] shadow-sm hover:brightness-110",
};

/**
 * Devuelve las clases estandarizadas para botones y enlaces de acceso/acción dentro de HeroFrame / HeroBanner.
 */
export function heroActionClassName(tone: HeroActionTone = "glass", className = ""): string {
  return `${BASE_HERO_ACTION_CLS} ${HERO_ACTION_TONE_CLS[tone]} ${className}`.trim();
}

export function HeroActionButton({
  tone = "glass",
  type = "button",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: HeroActionTone }) {
  return (
    <button type={type} className={heroActionClassName(tone, className)} {...props}>
      {children}
    </button>
  );
}

export function HeroActionLink({
  tone = "glass",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { tone?: HeroActionTone }) {
  return (
    <Link className={heroActionClassName(tone, className)} {...props}>
      {children}
    </Link>
  );
}

export function HeroActionAnchor({
  tone = "glass",
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { tone?: HeroActionTone }) {
  return (
    <a className={heroActionClassName(tone, className)} {...props}>
      {children}
    </a>
  );
}

export interface HeroFrameProps {
  theme: HeroThemeKey;
  title: ReactNode;
  metadata?: ReactNode;
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
  metadata,
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
  const resolvedImageAlt =
    typeof title === "string" && title.trim()
      ? `Ilustración de encabezado para ${title}`
      : `Ilustración de encabezado para ${config.eyebrow}`;

  const renderedIcon = (() => {
    if (!icon) return null;
    if (typeof icon === "string") {
      return <AppIcon icon={icon} className="w-4 h-4 text-amber-200 shrink-0" />;
    }
    return icon;
  })();

  return (
    <div
      className={`gallinero-hero rounded-2xl border border-[var(--iw-color-forest-dark)]/25 shadow-[var(--iw-shadow-card)] ring-1 ring-inset ring-white/10 ${
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
          alt={resolvedImageAlt}
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 backdrop-blur-[2px] border border-white/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-[var(--iw-color-paper)]">
              {renderedIcon ?? (
                <span className={`w-1.5 h-1.5 rounded-full ${config.accentDotClass}`} aria-hidden="true" />
              )}
              <span>{resolvedEyebrow}</span>
            </span>
            {badge}
          </div>

          <h1
            className={`font-display ${
              compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-[1.7rem]"
            } font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] leading-tight`}
          >
            {title}
          </h1>

          {metadata && (
            <div className="mt-1 text-[10px] leading-tight text-white/75">
              {metadata}
            </div>
          )}

          {description && (
            <p className="mt-1.5 text-sm sm:text-[15px] text-[var(--iw-color-paper)]/90 leading-relaxed max-w-xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="relative z-10 flex flex-wrap items-end justify-start md:justify-end gap-2 shrink-0 [&_label]:!text-[var(--iw-color-paper)] [&_select]:!min-h-[42px] [&_select]:!bg-[var(--iw-semantic-bg-surface)] [&_select]:!text-[var(--iw-semantic-text-primary)] [&_select]:!border-white/30 [&_input]:!min-h-[42px] [&_input]:!bg-[var(--iw-semantic-bg-surface)] [&_input]:!text-[var(--iw-semantic-text-primary)] [&_input]:!border-white/30">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}


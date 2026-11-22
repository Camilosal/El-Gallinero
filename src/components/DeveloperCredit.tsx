import { Globe } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_BRAND, APP_DEVELOPER } from "@/lib/branding";

interface DeveloperCreditProps {
  variant?: "inline" | "sidebar" | "card";
  showAppName?: boolean;
  collapsed?: boolean;
  className?: string;
}

export function DeveloperCredit({
  variant = "inline",
  showAppName = false,
  collapsed = false,
  className = "",
}: DeveloperCreditProps) {
  if (variant === "sidebar") {
    if (collapsed) {
      return (
        <a
          href={APP_DEVELOPER.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-full items-center justify-center rounded-[var(--iw-radius-control)] py-1.5 text-[var(--iw-color-paper)]/85 hover:bg-white/10 hover:text-[var(--iw-color-white)] transition-colors ${className}`}
          title={`Desarrollado por ${APP_DEVELOPER.name}`}
          aria-label={`Desarrollado por ${APP_DEVELOPER.name}`}
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      );
    }

    return (
      <div className={`pt-2 border-t border-white/15 text-[11px] leading-relaxed text-[var(--iw-color-paper)]/85 ${className}`}>
        <p className="truncate">
          Desarrollado por{" "}
          <a
            href={APP_DEVELOPER.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--iw-color-white)] hover:underline"
          >
            {APP_DEVELOPER.name}
          </a>
        </p>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <section
        aria-label="Acerca del desarrollo y soporte"
        className={`rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-[var(--iw-shadow-card)] ${className}`}
      >
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--iw-semantic-action-primary)]">
            Desarrollo y soporte
          </p>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 font-display text-base font-semibold text-[var(--iw-semantic-text-primary)]">
            <BrandLogo
              variant="square"
              size={32}
              decorative
              className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] p-0.5 bg-[var(--iw-semantic-bg-surface)]"
            />
            <span>
              {APP_BRAND.name} · por Iwagé · Desarrollado por{" "}
              <a
                href={APP_DEVELOPER.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--iw-semantic-action-primary)] hover:text-[var(--iw-semantic-action-primary-hover)] hover:underline"
              >
                {APP_DEVELOPER.name}
              </a>
            </span>
          </h2>
          <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)]">
            ¿Necesitas soporte técnico, nuevas integraciones o implementación personalizada para tu granja?
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--iw-semantic-text-secondary)] ${className}`}>
      {showAppName && (
        <>
          <BrandLogo
            variant="mark"
            size={20}
            decorative
            className="rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]"
          />
          <span className="font-semibold text-[var(--iw-semantic-text-primary)]">{APP_BRAND.name}</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--iw-semantic-action-primary)]">
            por Iwagé
          </span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span>
        Desarrollado por{" "}
        <a
          href={APP_DEVELOPER.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--iw-semantic-text-primary)] hover:text-[var(--iw-semantic-action-primary)] hover:underline"
        >
          {APP_DEVELOPER.name}
        </a>
      </span>
    </div>
  );
}

import { Globe } from "lucide-react";
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
          className={`flex w-full items-center justify-center rounded-lg py-1.5 text-green-300/80 hover:bg-green-800 hover:text-white transition-colors ${className}`}
          title={`Desarrollado por ${APP_DEVELOPER.name} (${APP_DEVELOPER.domain})`}
          aria-label={`Desarrollado por ${APP_DEVELOPER.name}`}
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      );
    }

    return (
      <div className={`pt-2 border-t border-green-800/80 text-[11px] leading-relaxed text-green-200/80 space-y-0.5 ${className}`}>
        <p className="truncate">
          Desarrollado por{" "}
          <a
            href={APP_DEVELOPER.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white hover:underline"
          >
            {APP_DEVELOPER.name}
          </a>
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-green-300/90">
          <a
            href={APP_DEVELOPER.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white hover:underline"
          >
            {APP_DEVELOPER.domain}
          </a>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <section
        aria-label="Acerca del desarrollo y soporte"
        className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Desarrollo y soporte
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">
              {APP_BRAND.name} · Desarrollado por{" "}
              <a
                href={APP_DEVELOPER.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-800 hover:underline"
              >
                {APP_DEVELOPER.name}
              </a>
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              ¿Necesitas soporte técnico, nuevas integraciones o implementación personalizada para tu granja?
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={APP_DEVELOPER.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {APP_DEVELOPER.domain}
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 ${className}`}>
      {showAppName && (
        <>
          <span className="font-semibold text-slate-700">{APP_BRAND.name}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span>
        Desarrollado por{" "}
        <a
          href={APP_DEVELOPER.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-700 hover:text-emerald-800 hover:underline"
        >
          {APP_DEVELOPER.name}
        </a>
      </span>
      <span aria-hidden="true">·</span>
      <a
        href={APP_DEVELOPER.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-emerald-800 hover:underline"
      >
        {APP_DEVELOPER.domain}
      </a>
    </div>
  );
}

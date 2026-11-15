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
          className={`flex w-full items-center justify-center rounded-lg py-1.5 text-green-300/80 hover:bg-green-800 hover:text-white transition-colors ${className}`}
          title={`Desarrollado por ${APP_DEVELOPER.name}`}
          aria-label={`Desarrollado por ${APP_DEVELOPER.name}`}
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      );
    }

    return (
      <div className={`pt-2 border-t border-green-800/80 text-[11px] leading-relaxed text-green-200/80 ${className}`}>
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
      </div>
    );
  }

  if (variant === "card") {
    return (
      <section
        aria-label="Acerca del desarrollo y soporte"
        className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Desarrollo y soporte
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-900">
            <BrandLogo variant="mark" size={24} decorative className="rounded-md border border-slate-200" />
            <span>
              {APP_BRAND.name} · Desarrollado por{" "}
              <a
                href={APP_DEVELOPER.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-800 hover:underline"
              >
                {APP_DEVELOPER.name}
              </a>
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            ¿Necesitas soporte técnico, nuevas integraciones o implementación personalizada para tu granja?
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 ${className}`}>
      {showAppName && (
        <>
          <BrandLogo variant="mark" size={20} decorative className="rounded-md border border-slate-200" />
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
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { resolveDashboardBreadcrumb } from "@/lib/breadcrumbs";

export default function DashboardBreadcrumb({ className = "mb-3" }: { className?: string }) {
  const pathname = usePathname() || "/dashboard";
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const items = resolveDashboardBreadcrumb(pathname, query);

  return (
    <nav
      aria-label="Ubicación actual en la aplicación"
      className={`flex flex-wrap items-center gap-1.5 text-xs text-slate-500 ${className}`}
    >
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5 min-w-0">
            {idx > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-emerald-800 hover:underline transition-colors truncate max-w-[200px]"
              >
                {isFirst && <Home className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                aria-current="page"
                className="inline-flex items-center gap-1 font-semibold text-slate-900 truncate max-w-[260px]"
              >
                {isFirst && <Home className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />}
                <span>{item.label}</span>
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

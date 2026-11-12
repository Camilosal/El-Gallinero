"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, ChevronRight, Home } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { guideModules, guides } from "@/lib/guide-data";

export default function GuiaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => {
    // Auto-expand the module of the current page
    const slug = pathname.split("/dashboard/guia/")[1];
    if (slug) {
      const guide = guides.find((g) => g.slug === slug);
      if (guide) return new Set([guide.module]);
    }
    return new Set<string>();
  });

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (slug: string) => pathname === `/dashboard/guia/${slug}`;
  const isIndexActive = pathname === "/dashboard/guia";

  return (
    <div className="flex gap-6 max-w-7xl mx-auto">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileNav(!mobileNav)}
        className="fixed bottom-4 right-4 z-40 lg:hidden bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
        aria-label="Navegación de guía"
      >
        <BookOpen className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Backdrop */}
      {mobileNav && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}

      {/* Guide sidebar */}
      <aside
        className={`fixed lg:static top-0 right-0 h-screen w-72 lg:w-64 xl:w-72 flex-shrink-0 bg-white border-l lg:border-l lg:border-r border-slate-200 overflow-y-auto z-50 lg:z-auto transition-transform duration-300 ${
          mobileNav ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-slate-200">
          <Link
            href="/dashboard"
            className="text-xs text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-1"
          >
            ← Volver al Dashboard
          </Link>
          <h2 className="text-lg font-bold text-slate-800 mt-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-700 shrink-0" aria-hidden="true" /> Guía de Usuario
          </h2>
        </div>

        <nav className="py-3">
          {/* Index link */}
          <Link
            href="/dashboard/guia"
            onClick={() => setMobileNav(false)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
              isIndexActive
                ? "bg-green-50 text-green-700 font-semibold border-r-3 border-green-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Inicio de la Guía</span>
          </Link>

          {/* Modules */}
          {guideModules.map((mod) => {
            const modGuides = guides.filter((g) => g.module === mod.id);
            if (modGuides.length === 0) return null;
            const isExpanded = expandedModules.has(mod.id);
            const hasActive = modGuides.some((g) => isActive(g.slug));

            return (
              <div key={mod.id}>
                <div className={`flex items-center ${hasActive ? "bg-slate-50" : ""}`}>
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="flex-1 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left"
                  >
                    <AppIcon icon={mod.icon} className="w-4 h-4 shrink-0 text-slate-600" />
                    <span>{mod.label}</span>
                  </button>
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="px-3 py-2.5 hover:bg-slate-100 transition-colors"
                    aria-label={isExpanded ? "Colapsar" : "Expandir"}
                  >
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden="true" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="bg-slate-50/50">
                    {modGuides.map((guide) => (
                      <Link
                        key={guide.slug}
                        href={`/dashboard/guia/${guide.slug}`}
                        onClick={() => setMobileNav(false)}
                        className={`flex items-center gap-2 pl-10 pr-4 py-2 text-sm transition-colors ${
                          isActive(guide.slug)
                            ? "bg-green-50 text-green-700 font-semibold border-r-3 border-green-600"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                      >
                        <AppIcon icon={guide.icon} className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{guide.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 py-6">
        {children}
      </main>
    </div>
  );
}

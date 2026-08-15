"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getGuide, getAdjacentGuides, guideModules } from "@/lib/guide-data";

export default function GuiaPage() {
  const params = useParams();
  const slug = params.slug as string;
  const guide = getGuide(slug);

  if (!guide) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-3">📖</span>
        <p className="text-slate-500">Guía no encontrada</p>
        <Link href="/dashboard/guia" className="text-green-600 hover:underline text-sm mt-2 inline-block">
          Volver al índice
        </Link>
      </div>
    );
  }

  const { prev, next } = getAdjacentGuides(slug);
  const currentModule = guideModules.find((m) => m.id === guide.module);

  return (
    <article className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/dashboard/guia" className="hover:text-green-600 transition-colors">
          Guía
        </Link>
        <span>/</span>
        {currentModule && (
          <>
            <span className="text-slate-400">{currentModule.icon} {currentModule.label}</span>
            <span>/</span>
          </>
        )}
        <span className="text-slate-700 font-medium">{guide.title}</span>
      </nav>

      {/* Title */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">{guide.icon}</span>
          <h1 className="text-3xl font-bold text-slate-800">{guide.title}</h1>
        </div>
        {currentModule && (
          <p className="text-sm text-slate-500 ml-14">
            Módulo: {currentModule.label}
          </p>
        )}
      </header>

      {/* Sections */}
      <div className="space-y-6">
        {guide.sections.map((section, idx) => {
          switch (section.type) {
            case "intro":
              return (
                <div key={idx} className="text-lg text-slate-700 leading-relaxed">
                  {section.text}
                </div>
              );

            case "steps":
              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5">
                  {section.title && (
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                        ✓
                      </span>
                      {section.title}
                    </h3>
                  )}
                  <ol className="space-y-3">
                    {section.items?.map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-700 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );

            case "tip":
              return (
                <div key={idx} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <span className="text-xl flex-shrink-0">💡</span>
                    <div>
                      {section.title && (
                        <h4 className="font-semibold text-blue-800 text-sm mb-1">{section.title}</h4>
                      )}
                      <p className="text-sm text-blue-700 leading-relaxed">{section.text}</p>
                    </div>
                  </div>
                </div>
              );

            case "warning":
              return (
                <div key={idx} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <span className="text-xl flex-shrink-0">⚠️</span>
                    <div>
                      {section.title && (
                        <h4 className="font-semibold text-amber-800 text-sm mb-1">{section.title}</h4>
                      )}
                      <p className="text-sm text-amber-700 leading-relaxed">{section.text}</p>
                    </div>
                  </div>
                </div>
              );

            case "note":
              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <span className="text-xl flex-shrink-0">📝</span>
                    <p className="text-sm text-slate-600 leading-relaxed">{section.text}</p>
                  </div>
                </div>
              );

            default:
              return null;
          }
        })}
      </div>

      {/* Related links */}
      {guide.relatedHrefs.length > 0 && (
        <div className="mt-8 p-5 bg-green-50 border border-green-200 rounded-xl">
          <h3 className="font-semibold text-green-800 text-sm mb-3 flex items-center gap-2">
            <span>🔗</span> Ir a la aplicación
          </h3>
          <div className="flex flex-wrap gap-2">
            {guide.relatedHrefs.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 rounded-lg text-sm text-green-700 hover:bg-green-100 hover:border-green-300 transition-colors"
              >
                <span>→</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Prev / Next navigation */}
      <nav className="mt-8 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
        {prev ? (
          <Link
            href={`/dashboard/guia/${prev.slug}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors group max-w-[45%]"
          >
            <span className="text-slate-400 group-hover:text-green-500 transition-colors">←</span>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Anterior</p>
              <p className="text-sm font-medium text-slate-700 group-hover:text-green-700 truncate">
                {prev.title}
              </p>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            href={`/dashboard/guia/${next.slug}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors group max-w-[45%] text-right"
          >
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Siguiente</p>
              <p className="text-sm font-medium text-slate-700 group-hover:text-green-700 truncate">
                {next.title}
              </p>
            </div>
            <span className="text-slate-400 group-hover:text-green-500 transition-colors">→</span>
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </article>
  );
}

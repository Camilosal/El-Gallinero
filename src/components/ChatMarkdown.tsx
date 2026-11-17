"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useOnboardingState } from "@/lib/useOnboardingState";
import { FEATURE_FLAG_CATALOG, getGateFlagForHref, isHrefEnabledByFlags } from "@/lib/onboarding";

/**
 * Renderiza las respuestas del asistente con formato legible.
 * No permite HTML crudo: react-markdown lo escapa por defecto.
 * Los enlaces internos (/ruta) navegan dentro de la app (SPA) y cierran el
 * widget en móvil vía `onNavigate`; las rutas bloqueadas por escala muestran
 * el candado y el hito que las desbloquea en lugar de navegar.
 */
export default function ChatMarkdown({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate?: () => void;
}) {
  const { state } = useOnboardingState();
  const flags = state?.flags ?? null;

  return (
    <div className="chat-markdown text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="mb-1.5 mt-2 text-base font-bold text-slate-900 first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-1.5 mt-2 text-[15px] font-bold text-slate-900 first:mt-0">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1 mt-2 text-sm font-bold text-slate-900 first:mt-0">{children}</h4>
          ),
          h4: ({ children }) => (
            <h5 className="mb-1 mt-2 text-sm font-semibold text-slate-800 first:mt-0">{children}</h5>
          ),
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="text-slate-400 line-through">{children}</del>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-slate-400">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5 marker:text-slate-400">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
          ),
          hr: () => <hr className="my-2 border-slate-200" />,
          a: ({ href, children }) => {
            const target = String(href || "");
            if (target.startsWith("/")) {
              const gate = getGateFlagForHref(target);
              if (gate && !isHrefEnabledByFlags(target, flags)) {
                const milestone =
                  FEATURE_FLAG_CATALOG.find((flag) => flag.key === gate)?.autoTriggerDescription ??
                  "Se desbloquea al crecer la operación de la granja.";
                return (
                  <span
                    className="inline-flex items-start gap-1 font-medium text-amber-700"
                    title={milestone}
                  >
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {children}
                      <span className="block text-[11px] font-normal text-amber-600">{milestone}</span>
                    </span>
                  </span>
                );
              }
              return (
                <Link
                  href={target}
                  onClick={() => onNavigate?.()}
                  className="font-medium text-green-700 underline decoration-green-300 underline-offset-2 hover:text-green-800"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-green-700 underline decoration-green-300 underline-offset-2 hover:text-green-800"
              >
                {children}
              </a>
            );
          },
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            return (
              <code
                className={
                  isBlock
                    ? "font-mono text-xs text-slate-800"
                    : "rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800"
                }
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700">{children}</th>
          ),
          td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
          input: ({ node: _node, ...props }) => <input {...props} className="mr-1 accent-green-600" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

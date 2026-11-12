"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, BarChart3, BookOpen, Check, ChevronDown, FileText, Lightbulb, Link2 } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { getGuide, getAdjacentGuides, guideModules, DiagramNode, DiagramConnection } from "@/lib/guide-data";

export default function GuiaPage() {
  const params = useParams();
  const slug = params.slug as string;
  const guide = getGuide(slug);

  if (!guide) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" aria-hidden="true" />
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
            <span className="text-slate-400 inline-flex items-center gap-1.5">
              <AppIcon icon={currentModule.icon} className="w-3.5 h-3.5 shrink-0" />
              {currentModule.label}
            </span>
            <span>/</span>
          </>
        )}
        <span className="text-slate-700 font-medium">{guide.title}</span>
      </nav>

      {/* Title */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
            <AppIcon icon={guide.icon} className="w-6 h-6 text-green-700" />
          </div>
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
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
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
                    <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
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
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      {section.title && (
                        <h4 className="font-semibold text-amber-800 text-sm mb-1">{section.title}</h4>
                      )}
                      <p className="text-sm text-amber-700 leading-relaxed">{section.text}</p>
                    </div>
                  </div>
                </div>
              );

            case "diagram":
              return (
                <DiagramSection key={idx} title={section.title} nodes={section.nodes || []} connections={section.connections || []} layout={section.layout} />
              );

            case "note":
              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <FileText className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
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
            <Link2 className="w-4 h-4 shrink-0" aria-hidden="true" /> Ir a la aplicación
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

// ─── Diagram Section Component ───
const COLOR_MAP: Record<string, string> = {
  green: "bg-green-100 border-green-300 text-green-800",
  blue: "bg-blue-100 border-blue-300 text-blue-800",
  yellow: "bg-yellow-100 border-yellow-300 text-yellow-800",
  red: "bg-red-100 border-red-300 text-red-800",
  purple: "bg-purple-100 border-purple-300 text-purple-800",
  amber: "bg-amber-100 border-amber-300 text-amber-800",
  slate: "bg-slate-100 border-slate-300 text-slate-800",
  indigo: "bg-indigo-100 border-indigo-300 text-indigo-800",
};

function DiagramSection({
  title,
  nodes,
  connections,
  layout,
}: {
  title?: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  layout?: "horizontal" | "vertical";
}) {
  const isHorizontal = layout !== "vertical";

  // Build adjacency for topological ordering
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDeg.set(n.id, 0);
  }
  for (const c of connections) {
    adj.get(c.from)?.push(c.to);
    inDeg.set(c.to, (inDeg.get(c.to) || 0) + 1);
  }

  // Topological sort into layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  let queue = nodes.filter((n) => (inDeg.get(n.id) || 0) === 0).map((n) => n.id);
  while (queue.length > 0) {
    layers.push([...queue]);
    queue.forEach((id) => visited.add(id));
    const next: string[] = [];
    for (const id of queue) {
      for (const neighbor of adj.get(id) || []) {
        if (!visited.has(neighbor)) {
          const remainingDeps = connections.filter((c) => c.to === neighbor && !visited.has(c.from)).length;
          if (remainingDeps === 0 && !next.includes(neighbor)) {
            next.push(neighbor);
          }
        }
      }
    }
    queue = next;
  }
  // Add any unvisited nodes
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      layers.push([n.id]);
      visited.add(n.id);
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
      {title && (
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /></span>
          {title}
        </h3>
      )}
      <div className={`flex ${isHorizontal ? "flex-col" : "flex-col"} items-center gap-1`}>
        {layers.map((layer, li) => (
          <div key={li} className="flex flex-col items-center">
            <div className={`flex ${isHorizontal ? "flex-row" : "flex-col"} items-center gap-4`}>
              {layer.map((nodeId) => {
                const node = nodeMap.get(nodeId);
                if (!node) return null;
                const colorClass = COLOR_MAP[node.color || "slate"] || COLOR_MAP.slate;
                return (
                  <div
                    key={nodeId}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 ${colorClass} min-w-[120px] justify-center shadow-sm`}
                  >
                    {node.icon && <AppIcon icon={node.icon} className="w-4 h-4 flex-shrink-0" />}
                    <span className="text-sm font-medium text-center">{node.label}</span>
                  </div>
                );
              })}
            </div>
            {/* Arrow between layers */}
            {li < layers.length - 1 && (
              <div className="flex flex-col items-center py-1">
                <div className="w-0.5 h-4 bg-slate-300" />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 -mt-1" aria-hidden="true" />
                {/* Show connection label if exists */}
                {(() => {
                  const connLabel = connections.find(
                    (c) => layer.includes(c.from) && layers[li + 1]?.includes(c.to) && c.label
                  )?.label;
                  return connLabel ? (
                    <span className="text-[10px] text-slate-500 mt-0.5">{connLabel}</span>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

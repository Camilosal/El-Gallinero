import { BarChart3, ChevronDown } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import type { DiagramConnection, DiagramNode } from "@/lib/guide-data";

const COLOR_MAP: Record<string, string> = {
  green: "bg-green-100 border-green-400 text-green-900",
  amber: "bg-amber-100 border-amber-400 text-amber-900",
  blue: "bg-blue-100 border-blue-400 text-blue-900",
  red: "bg-red-100 border-red-400 text-red-900",
  purple: "bg-purple-100 border-purple-400 text-purple-900",
  emerald: "bg-emerald-100 border-emerald-400 text-emerald-900",
  orange: "bg-orange-100 border-orange-400 text-orange-900",
  slate: "bg-slate-100 border-slate-400 text-slate-900",
};

interface GuideDiagramProps {
  title?: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export function GuideDiagram({ title, nodes, connections }: GuideDiagramProps) {
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

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      layers.push([n.id]);
      visited.add(n.id);
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs overflow-x-auto">
      {title && (
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 sm:text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span>{title}</span>
        </h3>
      )}

      <div className="flex flex-col items-center gap-1">
        {layers.map((layer, li) => (
          <div key={li} className="flex flex-col items-center">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {layer.map((nodeId) => {
                const node = nodeMap.get(nodeId);
                if (!node) return null;
                const colorClass = COLOR_MAP[node.color || "slate"] || COLOR_MAP.slate;
                return (
                  <div
                    key={nodeId}
                    className={`flex min-w-[130px] items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 shadow-2xs ${colorClass}`}
                  >
                    {node.icon && <AppIcon icon={node.icon} className="h-4 w-4 shrink-0" />}
                    <span className="text-center text-xs font-semibold sm:text-sm">{node.label}</span>
                  </div>
                );
              })}
            </div>

            {li < layers.length - 1 && (
              <div className="flex flex-col items-center py-1">
                <div className="h-4 w-0.5 bg-slate-300" />
                <ChevronDown className="-mt-1 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {(() => {
                  const connLabel = connections.find(
                    (c) => layer.includes(c.from) && layers[li + 1]?.includes(c.to) && c.label,
                  )?.label;
                  return connLabel ? (
                    <span className="mt-0.5 text-[10px] font-medium text-slate-500">{connLabel}</span>
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


import { BarChart3, ChevronDown } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import type { DiagramConnection, DiagramNode } from "@/lib/guide-data";

const COLOR_MAP: Record<string, string> = {
  green: "bg-[var(--iw-semantic-bg-feature)] border-[var(--iw-color-forest)] text-[var(--iw-semantic-text-primary)]",
  emerald: "bg-[var(--iw-semantic-bg-feature)] border-[var(--iw-semantic-status-success)] text-[var(--iw-semantic-text-primary)]",
  amber: "bg-[var(--iw-semantic-bg-page)] border-[var(--iw-color-ochre)] text-[var(--iw-semantic-text-primary)]",
  orange: "bg-[var(--iw-semantic-bg-page)] border-[var(--iw-color-terracotta)] text-[var(--iw-semantic-text-primary)]",
  red: "bg-[var(--iw-semantic-bg-subtle)] border-[var(--iw-semantic-status-danger)] text-[var(--iw-semantic-text-primary)]",
  blue: "bg-[var(--iw-semantic-bg-subtle)] border-[var(--iw-semantic-status-info)] text-[var(--iw-semantic-text-primary)]",
  purple: "bg-[var(--iw-semantic-bg-subtle)] border-[var(--iw-semantic-border-strong)] text-[var(--iw-semantic-text-primary)]",
  slate: "bg-[var(--iw-semantic-bg-surface)] border-[var(--iw-semantic-border-default)] text-[var(--iw-semantic-text-primary)]",
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
    <div className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-[var(--iw-shadow-card)] overflow-x-auto">
      {title && (
        <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-[var(--iw-semantic-text-primary)] sm:text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)]">
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
                const colors = COLOR_MAP[node.color || "slate"] || COLOR_MAP.slate;
                return (
                  <div
                    key={node.id}
                    className={`flex items-center gap-2 rounded-[var(--iw-radius-control)] border-2 px-3.5 py-2 text-xs font-medium shadow-xs ${colors}`}
                  >
                    {node.icon && <AppIcon icon={node.icon} className="h-3.5 w-3.5 shrink-0" />}
                    <span>{node.label}</span>
                  </div>
                );
              })}
            </div>

            {li < layers.length - 1 && (
              <div className="my-1.5 flex flex-col items-center">
                {(() => {
                  const labels = connections
                    .filter((c) => layer.includes(c.from) && layers[li + 1].includes(c.to) && c.label)
                    .map((c) => c.label);
                  return (
                    <>
                      <div className="h-3 w-0.5 bg-[var(--iw-semantic-border-default)]" />
                      {labels.length > 0 && (
                        <span className="rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 font-mono text-[10px] text-[var(--iw-semantic-text-secondary)] my-0.5">
                          {labels[0]}
                        </span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--iw-semantic-text-secondary)] -mt-1" aria-hidden="true" />
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

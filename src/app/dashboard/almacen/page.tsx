"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PackageOpen, Wheat, Wrench } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { PageHeader, Card, StatCard, Badge, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { isHrefEnabledByFlags } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";

interface Feed {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  supplier: string | null;
}

interface Supply {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  supplier: string | null;
}

interface MaintenanceSummary {
  totalTareas: number;
  tareasPendientes: number;
  tareasCompletadas: number;
  costoTotal: number;
}

const quickLinks = [
  {
    href: "/dashboard/produccion?tab=alimentacion",
    label: "Gestión de alimentación",
    icon: "wheat",
    desc: "Alimentos, dieta combinada (%MS/%PC/Vit. C), programas y predicción",
  },
  {
    href: "/dashboard/inventarios/alimentacion",
    label: "Inventario de alimentos",
    icon: "bar-chart",
    desc: "Stock en kg y bultos, cobertura y valor",
  },
  {
    href: "/dashboard/inventarios/insumos",
    label: "Insumos",
    icon: "package-open",
    desc: "Medicamentos, empaques, bioseguridad y materiales",
  },
  {
    href: "/dashboard/operaciones/activos",
    label: "Activos y equipos",
    icon: "equipment",
    desc: "Equipos, jaulas, bebederos, herramientas e infraestructura",
  },
  {
    href: "/dashboard/operaciones/mantenimiento",
    label: "Mantenimiento",
    icon: "wrench",
    desc: "Mantenimientos preventivos, correctivos y garantías",
  },
  {
    href: "/dashboard/operaciones/compostaje",
    label: "Compostaje",
    icon: "sprout",
    desc: "Pilas 3:1:1 y 7:2:2, temperatura térmica y cosecha de abono",
  },
  {
    href: "/dashboard/operaciones/cierre",
    label: "Cierre Diario y Sensores",
    icon: "clipboard",
    desc: "Cierre auditable antifraude y telemetría IoT (ITH, NH3, báscula)",
  },
];

const categoryLabels: Record<string, string> = {
  granja_fresco: "Granja fresco",
  granja_procesado: "Granja procesado",
  suplementario: "Suplementario",
  Concentrado: "Concentrado",
  "En Fresco": "En Fresco",
  Preparados: "Preparados",
};

const fmtMoney = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`;
const fmtNumber = (value: number) => value.toLocaleString("es-CO", { maximumFractionDigits: 2 });

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export default function AlmacenPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { flags, isFlagEnabled } = useOnboardingState();
  const showEnterpriseMaintenance = isFlagEnabled("reportes_dian_roi_credito");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/produccion/alimentacion").then((r) => (r.ok ? r.json() : [])),
      apiFetch("/api/inventarios/insumos").then((r) => (r.ok ? r.json() : [])),
      apiFetch("/api/operaciones/resumen").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([feedData, supplyData, maintenanceData]) => {
        if (cancelled) return;
        setFeeds(normalizeList<Feed>(feedData));
        setSupplies(normalizeList<Supply>(supplyData));
        setMaintenance(maintenanceData);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const feedValue = useMemo(
    () => feeds.reduce((sum, feed) => sum + Number(feed.currentStock) * Number(feed.costPerUnit), 0),
    [feeds],
  );
  const supplyValue = useMemo(
    () => supplies.reduce((sum, supply) => sum + Number(supply.currentStock) * Number(supply.costPerUnit), 0),
    [supplies],
  );
  const lowFeeds = useMemo(
    () => feeds.filter((feed) => Number(feed.currentStock) <= Number(feed.minStock)),
    [feeds],
  );
  const lowSupplies = useMemo(
    () => supplies.filter((supply) => Number(supply.currentStock) <= Number(supply.minStock)),
    [supplies],
  );
  const totalAlerts = lowFeeds.length + lowSupplies.length;

  const enabledQuickLinks = useMemo(
    () => quickLinks.filter((l) => isHrefEnabledByFlags(l.href, flags)),
    [flags],
  );
  const filteredQuickLinks = useMemo(
    () => (search.trim() ? enabledQuickLinks.filter((l) => matchesTextQuery(search, [l.label, l.desc])) : enabledQuickLinks),
    [enabledQuickLinks, search],
  );
  const filteredLowFeeds = useMemo(
    () => (search.trim() ? lowFeeds.filter((f) => matchesTextQuery(search, [f.name, f.category, categoryLabels[f.category], f.supplier])) : lowFeeds),
    [lowFeeds, search],
  );
  const filteredLowSupplies = useMemo(
    () => (search.trim() ? lowSupplies.filter((s) => matchesTextQuery(search, [s.name, s.category, s.supplier])) : lowSupplies),
    [lowSupplies, search],
  );
  const filteredFeeds = useMemo(
    () => (search.trim() ? feeds.filter((f) => matchesTextQuery(search, [f.name, f.category, categoryLabels[f.category], f.supplier])) : feeds),
    [feeds, search],
  );
  const filteredSupplies = useMemo(
    () => (search.trim() ? supplies.filter((s) => matchesTextQuery(search, [s.name, s.category, s.supplier])) : supplies),
    [supplies, search],
  );
  const filteredTotalAlerts = filteredLowFeeds.length + filteredLowSupplies.length;

  return (
    <div>
      <PageHeader
        title="Almacén e insumos"
        description="Alimentos, insumos, activos, mantenimiento, compostaje térmico y cierre diario de la granja."
        help="Este espacio reúne los recursos operativos, instalaciones y procesos de soporte diarios de la granja:\n\n• Gestión de alimentación e Inventario de alimentos: stock en bultos de 40 kg, dieta combinada (%MS/%PC/Vit. C), programas y predicción.\n• Insumos: medicamentos, vacunas, empaques y materiales.\n• Activos y equipos / Mantenimiento: hojas de vida, garantías y tareas periódicas.\n• Compostaje: pilas 3:1:1 y 7:2:2 con monitoreo de temperatura y volteos.\n• Cierre Diario y Sensores: conciliación auditable al cierre de jornada y lecturas IoT (ITH, NH3, T°/HR, báscula)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/produccion?tab=alimentacion"
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Gestionar alimentación
            </Link>
            <Link
              href="/dashboard/inventarios/insumos"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Gestionar insumos
            </Link>
          </div>
        }
      />

      {loading ? (
        <Card>
          <p className="py-8 text-center text-slate-400">Cargando almacén...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar en almacén: módulos, alimentos, insumos o proveedores..."
            resultCount={
              filteredQuickLinks.length + filteredFeeds.length + filteredSupplies.length
            }
            totalCount={quickLinks.length + feeds.length + supplies.length}
          />

          <div className={`grid grid-cols-2 gap-2.5 sm:gap-4 ${showEnterpriseMaintenance ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <StatCard icon="wheat" label="Valor en alimentos" value={fmtMoney(feedValue)} color="blue" />
            <StatCard icon="package-open" label="Valor en insumos" value={fmtMoney(supplyValue)} color="purple" />
            <StatCard
              icon="warning"
              label="Alimentos con stock bajo"
              value={lowFeeds.length}
              color={lowFeeds.length > 0 ? "red" : "green"}
            />
            <StatCard
              icon="warning"
              label="Insumos con stock bajo"
              value={lowSupplies.length}
              color={lowSupplies.length > 0 ? "red" : "green"}
            />
            {showEnterpriseMaintenance && (
              <StatCard
                icon="wrench"
                label="Mantenimientos pendientes"
                value={maintenance?.tareasPendientes ?? 0}
                color={(maintenance?.tareasPendientes ?? 0) > 0 ? "yellow" : "green"}
              />
            )}
          </div>

          {filteredQuickLinks.length === 0 ? (
            <EmptyState icon="warehouse" message="No hay accesos del almacén que coincidan con la búsqueda" />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
              {filteredQuickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5 min-w-0 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <AppIcon icon={link.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <p className="mt-2 sm:mt-3 text-sm sm:text-base font-semibold text-slate-800 leading-snug">{link.label}</p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 line-clamp-2">{link.desc}</p>
                </Link>
              ))}
            </div>
          )}

          {filteredTotalAlerts > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-orange-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-700 shrink-0" aria-hidden="true" />
                  <span>Alertas de stock bajo</span>
                </h2>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-700">
                  {filteredTotalAlerts} recursos
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                    <Wheat className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Alimentos</span>
                  </p>
                  {filteredLowFeeds.length === 0 ? (
                    <p className="text-sm text-orange-700/70">Sin alertas de alimentos.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredLowFeeds.slice(0, 6).map((feed) => (
                        <div key={feed.id} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm">
                          <span className="font-medium text-slate-800">{feed.name}</span>
                          <span className="text-slate-600">
                            <strong className="text-red-600">{fmtNumber(Number(feed.currentStock))}</strong>
                            {" / "}
                            {fmtNumber(Number(feed.minStock))} {feed.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                    <PackageOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Insumos</span>
                  </p>
                  {filteredLowSupplies.length === 0 ? (
                    <p className="text-sm text-orange-700/70">Sin alertas de insumos.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredLowSupplies.slice(0, 6).map((supply) => (
                        <div key={supply.id} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm">
                          <span className="font-medium text-slate-800">{supply.name}</span>
                          <span className="text-slate-600">
                            <strong className="text-red-600">{fmtNumber(Number(supply.currentStock))}</strong>
                            {" / "}
                            {fmtNumber(Number(supply.minStock))} {supply.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Wheat className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Alimentos registrados</span>
                </h2>
                <Badge color="blue">{filteredFeeds.length} tipos</Badge>
              </div>
              {filteredFeeds.length === 0 ? (
                <EmptyState icon="wheat" message={search.trim() ? "No hay alimentos que coincidan con la búsqueda" : "No hay alimentos registrados"} />
              ) : (
                <div className="space-y-2">
                  {filteredFeeds.slice(0, 8).map((feed) => {
                    const isLow = Number(feed.currentStock) <= Number(feed.minStock);
                    return (
                      <div
                        key={feed.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 ${isLow ? "bg-red-50" : "bg-slate-50"}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{feed.name}</p>
                          <p className="text-xs text-slate-500">
                            {categoryLabels[feed.category] || feed.category}
                            {feed.supplier ? ` · ${feed.supplier}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${isLow ? "text-red-600" : "text-green-700"}`}>
                            {fmtNumber(Number(feed.currentStock))} {feed.unit}
                          </p>
                          <p className="text-xs text-slate-500">{fmtMoney(Number(feed.currentStock) * Number(feed.costPerUnit))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/dashboard/inventarios/alimentacion" className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:underline">
                Ver inventario completo de alimentos →
              </Link>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <PackageOpen className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
                  <span>Insumos registrados</span>
                </h2>
                <Badge color="purple">{filteredSupplies.length} tipos</Badge>
              </div>
              {filteredSupplies.length === 0 ? (
                <EmptyState icon="package-open" message={search.trim() ? "No hay insumos que coincidan con la búsqueda" : "No hay insumos registrados"} />
              ) : (
                <div className="space-y-2">
                  {filteredSupplies.slice(0, 8).map((supply) => {
                    const isLow = Number(supply.currentStock) <= Number(supply.minStock);
                    return (
                      <div
                        key={supply.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 ${isLow ? "bg-red-50" : "bg-slate-50"}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{supply.name}</p>
                          <p className="text-xs text-slate-500">
                            {supply.category}
                            {supply.supplier ? ` · ${supply.supplier}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${isLow ? "text-red-600" : "text-green-700"}`}>
                            {fmtNumber(Number(supply.currentStock))} {supply.unit}
                          </p>
                          <p className="text-xs text-slate-500">{fmtMoney(Number(supply.currentStock) * Number(supply.costPerUnit))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/dashboard/inventarios/insumos" className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:underline">
                Gestionar insumos →
              </Link>
            </Card>
          </div>

          {maintenance && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
                  <span>Mantenimiento</span>
                </h2>
                <Link href="/dashboard/operaciones/mantenimiento" className="text-xs font-semibold text-blue-700 hover:underline">
                  Ver tareas →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-500">Total tareas</p>
                  <p className="text-xl font-bold text-slate-800">{maintenance.totalTareas}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3 text-center">
                  <p className="text-xs text-slate-500">Pendientes</p>
                  <p className="text-xl font-bold text-yellow-700">{maintenance.tareasPendientes}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <p className="text-xs text-slate-500">Completadas</p>
                  <p className="text-xl font-bold text-green-700">{maintenance.tareasCompletadas}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-xs text-slate-500">Costo total</p>
                  <p className="text-xl font-bold text-blue-700">{fmtMoney(maintenance.costoTotal)}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

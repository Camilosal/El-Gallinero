"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { AppIcon } from "@/components/AppIcon";
import {
  CONFIGURACION_MENU_GROUP,
  filterNavigationGroups,
  navigationGroups,
  type MenuGroup,
} from "@/lib/navigation";
import { useOnboardingState } from "@/lib/useOnboardingState";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { clearOfflineCryptoKey } from "@/lib/offline/crypto";
import {
  BarChart3,
  Bird,
  BookOpen,
  Bug,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  LogOut,
  Menu,
  QrCode,
  X,
} from "lucide-react";
import { openBugReportModal } from "@/lib/bug-report";

const STORAGE_KEY = "sidebar-expanded-groups";
const COLLAPSED_KEY = "sidebar-collapsed";

const ACTIVE_FARM_META_STORAGE_KEY = "galli-active-farm-meta";

interface ActiveFarmMeta {
  farmId: string;
  farmName?: string | null;
  farmSlug?: string | null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [farmMeta, setFarmMeta] = useState<ActiveFarmMeta | null>(null);
  const [copiedFarmId, setCopiedFarmId] = useState(false);
  const query = searchParams.toString();
  const locationKey = query ? `${pathname}?${query}` : pathname;
  const mobileOpen = mobileOpenAt === locationKey;
  const setMobileOpen = (open: boolean) => setMobileOpenAt(open ? locationKey : null);
  const { flags } = useOnboardingState();
  const visibleGroups = flags ? filterNavigationGroups(flags) : navigationGroups;

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;

      let groups = ["animales"];
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.every((value): value is string => typeof value === "string")) {
            groups = parsed;
          }
        }
      } catch {
        // Keep the default group if persisted state is invalid or unavailable.
      }

      let isCollapsed = false;
      try {
        isCollapsed = localStorage.getItem(COLLAPSED_KEY) === "true";
      } catch {
        // The sidebar remains expanded if storage is unavailable.
      }

      setExpandedGroups(new Set(groups));
      setCollapsed(isCollapsed);
      setSettingsLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    const allGroups = [...visibleGroups, CONFIGURACION_MENU_GROUP];
    const activeIds = allGroups
      .filter(
        (group) =>
          pathname === group.indexHref ||
          pathname.startsWith(`${group.indexHref}/`) ||
          group.items.some((item) => {
            const [itemPath] = item.href.split("?");
            return pathname === itemPath || (itemPath !== "/" && pathname.startsWith(`${itemPath}/`));
          }),
      )
      .map((g) => g.id);
    if (activeIds.length === 0) return;
    queueMicrotask(() => {
      setExpandedGroups((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of activeIds) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
  }, [locationKey, pathname, settingsLoaded, visibleGroups]);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedGroups)));
    } catch {
      // Navigation remains usable when browser storage is disabled.
    }
  }, [expandedGroups, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Navigation remains usable when browser storage is disabled.
    }
    // Dispatch custom event so layout can react
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed } }));
  }, [collapsed, settingsLoaded]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    try {
      const cached = localStorage.getItem(ACTIVE_FARM_META_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ActiveFarmMeta;
        if (parsed?.farmId) {
          queueMicrotask(() => {
            if (active) setFarmMeta(parsed);
          });
        }
      }
    } catch {
      // Ignore storage read errors
    }

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.farmId) return;
        const nextMeta: ActiveFarmMeta = {
          farmId: String(data.farmId),
          farmName: data.farmName ?? null,
          farmSlug: data.farmSlug ?? null,
        };
        setFarmMeta(nextMeta);
        try {
          localStorage.setItem(ACTIVE_FARM_META_STORAGE_KEY, JSON.stringify(nextMeta));
        } catch {
          // Ignore storage write errors
        }
      })
      .catch(() => {
        // Offline / unauthenticated fallback keeps cached FarmID if available
      });

    return () => {
      active = false;
    };
  }, []);

  const copyFarmId = async () => {
    if (!farmMeta?.farmId) return;
    try {
      await navigator.clipboard.writeText(farmMeta.farmId);
      setCopiedFarmId(true);
      window.setTimeout(() => setCopiedFarmId(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const logout = async () => {
    clearOfflineCryptoKey(true);
    try {
      localStorage.removeItem(ACTIVE_FARM_META_STORAGE_KEY);
    } catch {
      // Ignore storage clear errors
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isItemActive = (href: string) => {
    const [path, query = ""] = href.split("?");
    const pathMatches = pathname === path || (path !== "/" && pathname.startsWith(path + "/"));
    if (!pathMatches) return false;

    if (query) {
      const expected = new URLSearchParams(query);
      for (const [key, value] of expected.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }

    // Las páginas con pestañas activan su índice solo cuando no hay pestaña.
    if (path === "/produccion" && searchParams.get("tab")) return false;
    return true;
  };

  const isGroupActive = (group: MenuGroup) => {
    return isItemActive(group.indexHref) || group.items.some((item) => isItemActive(item.href));
  };

  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <>
      {/* Hamburger button - mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 md:hidden bg-green-900 text-white p-2 rounded-lg shadow-lg hover:bg-green-800 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop - mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen ${sidebarWidth} bg-green-900 text-white flex flex-col z-50 shadow-xl transition-all duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
      >
        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 md:hidden text-green-300 hover:text-white p-1"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className={`border-b border-green-700 ${collapsed ? "px-2 py-4" : "p-5"}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-800 text-farm-300 border border-green-700"
                title={farmMeta?.farmId ? `${farmMeta.farmName || "El Gallinero"} · FarmID: ${farmMeta.farmId}` : "El Gallinero"}
              >
                <Bird className="w-5 h-5" />
              </div>
              {farmMeta?.farmId && (
                <button
                  type="button"
                  onClick={copyFarmId}
                  className="px-1.5 py-0.5 rounded bg-green-950/70 border border-green-700/80 text-[9px] font-mono text-green-200 hover:text-white hover:bg-green-800 transition-colors"
                  title={copiedFarmId ? "FarmID copiado" : `FarmID: ${farmMeta.farmId} (clic para copiar)`}
                  aria-label={`Copiar FarmID ${farmMeta.farmId}`}
                >
                  {copiedFarmId ? "OK" : "ID"}
                </button>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-800 text-farm-300 border border-green-700 shrink-0">
                  <Bird className="w-5 h-5" />
                </span>
                <span>El Gallinero</span>
              </h1>
              <p className="text-green-300 text-xs mt-1.5">Granja Autosustentable</p>
              {farmMeta?.farmId && (
                <div className="mt-2.5 flex items-start justify-between gap-2 rounded-lg bg-green-950/60 border border-green-700/70 px-2.5 py-1.5">
                  <div className="min-w-0">
                    {farmMeta.farmName && (
                      <p className="text-[11px] font-medium text-green-100 truncate">
                        {farmMeta.farmName}
                      </p>
                    )}
                    <p
                      className="text-[10px] leading-tight font-mono text-green-200 break-all"
                      title={farmMeta.farmId}
                      data-testid="sidebar-farm-id"
                    >
                      FarmID: {farmMeta.farmId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyFarmId}
                    className="p-1 rounded text-green-300 hover:text-white hover:bg-green-800/70 transition-colors shrink-0"
                    title={copiedFarmId ? "FarmID copiado" : "Copiar FarmID"}
                    aria-label="Copiar FarmID"
                  >
                    {copiedFarmId ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center absolute -right-4 top-7 w-8 h-8 bg-green-600 hover:bg-green-500 border-2 border-green-900 rounded-full text-white text-sm font-bold shadow-lg transition-all z-10 hover:scale-110"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          {/* Dashboard link */}
          <Link
            href="/inicio"
            className={`flex items-center gap-3 py-3 text-sm transition-all hover:bg-green-800 ${collapsed ? "justify-center px-2" : "px-5"
              } ${pathname === "/inicio" ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""}`}
            title={collapsed ? "Inicio" : undefined}
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0 text-green-200" />
            {!collapsed && <span>Inicio</span>}
          </Link>

          {/* QR Scanner */}
          <Link
            href="/escanear"
            className={`flex items-center gap-3 py-3 text-sm transition-all hover:bg-green-800 ${collapsed ? "justify-center px-2" : "px-5"
              } ${pathname === "/escanear" || pathname.startsWith("/escanear")
                ? "bg-green-700 border-r-4 border-farm-400 font-semibold"
                : ""
              }`}
            title={collapsed ? "Escanear" : undefined}
          >
            <QrCode className="w-4 h-4 flex-shrink-0 text-green-200" />
            {!collapsed && <span>Escanear</span>}
          </Link>

          {/* Progressive navigation groups (single-codebase feature flags) */}
          {visibleGroups.map((group) => (
            <GroupItem
              key={group.id}
              group={group}
              pathname={pathname}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              isItemActive={isItemActive}
              isGroupActive={isGroupActive}
              collapsed={collapsed}
            />
          ))}

          {/* Configuración unificada dentro del mismo árbol de navegación */}
          <div className="mt-2 pt-2 border-t border-green-800/80">
            <GroupItem
              group={CONFIGURACION_MENU_GROUP}
              pathname={pathname}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              isItemActive={isItemActive}
              isGroupActive={isGroupActive}
              collapsed={collapsed}
            />
          </div>
        </nav>

        {/* Footer: guide/logout + bug report in clean block */}
        <div className={`border-t border-green-700 space-y-2 ${collapsed ? "p-2" : "p-3.5"}`}>

          <div className={collapsed ? "flex flex-col gap-1.5" : "grid grid-cols-2 gap-1.5"}>
            <a
              href="/guia"
              target="_blank"
              rel="noopener noreferrer"
              className={`py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${collapsed ? "w-full px-1" : "px-2"
                } ${pathname.startsWith("/manual") || pathname.startsWith("/guia")
                  ? "bg-green-600 text-white"
                  : "bg-green-800 hover:bg-green-700 text-green-100"
                }`}
              title={collapsed ? "Guía de Usuario (abre en hoja aparte)" : "Abrir manual de usuario"}
              aria-label="Guía de Usuario"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {!collapsed && (
                <>
                  <span className="truncate text-[11px]">Guía de uso</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-80 shrink-0" aria-hidden="true" />
                </>
              )}
            </a>
            <button
              onClick={logout}
              className={`py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-green-100 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${collapsed ? "w-full px-1" : "px-2"
                }`}
              title="Cerrar Sesión"
              aria-label="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">Cerrar sesión</span>}
            </button>
          </div>
          <button
            type="button"
            onClick={() => openBugReportModal({ triggerSource: "sidebar" })}
            className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-100 border border-rose-800/50 ${collapsed ? "px-1" : "px-3"
              }`}
            title={collapsed ? "Reportar falla" : "Reportar falla con origen etiquetado"}
            aria-label="Reportar falla"
          >
            <Bug className="w-3.5 h-3.5 shrink-0 text-rose-200" aria-hidden="true" />
            {!collapsed && <span className="flex-1 text-left text-[11px]">Reportar falla</span>}
          </button>
          <DeveloperCredit variant="sidebar" collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

// ─── Reusable group renderer ───
function GroupItem({
  group,
  pathname,
  expandedGroups,
  toggleGroup,
  isItemActive,
  isGroupActive,
  collapsed,
}: {
  group: MenuGroup;
  pathname: string;
  expandedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  isItemActive: (href: string) => boolean;
  isGroupActive: (g: MenuGroup) => boolean;
  collapsed: boolean;
}) {
  const isExpanded = expandedGroups.has(group.id);
  const groupActive = isGroupActive(group);
  const isIndexActive = pathname === group.indexHref;
  const hasItems = group.items.length > 0;

  if (collapsed) {
    // Collapsed: show only icon, tooltip with group name
    return (
      <Link
        href={group.indexHref}
        className={`flex items-center justify-center py-3 text-sm transition-all hover:bg-green-800 ${isIndexActive || groupActive
          ? "bg-green-700 border-r-4 border-farm-400"
          : ""
          }`}
        title={group.label}
      >
        <AppIcon icon={group.icon} className="w-4 h-4 text-green-200" />
      </Link>
    );
  }

  return (
    <div key={group.id}>
      <div className={`flex items-center ${groupActive ? "bg-green-800" : ""}`}>
        <Link
          href={group.indexHref}
          className={`flex-1 flex items-center gap-3 px-5 py-3 text-sm transition-all hover:bg-green-800 ${isIndexActive ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""
            }`}
        >
          <AppIcon icon={group.icon} className="w-4 h-4 text-green-200 shrink-0" />
          <span className="font-semibold text-green-100">{group.label}</span>
        </Link>
        {hasItems && (
          <button
            onClick={() => toggleGroup(group.id)}
            className="px-3 py-3 hover:bg-green-700 transition-colors text-green-300 inline-flex items-center gap-1.5"
            aria-label={`${isExpanded ? "Colapsar" : "Expandir"} ${group.label}`}
          >
            <span className="rounded bg-green-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-green-200/90 tabular-nums">
              {group.items.length}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>

      {isExpanded && hasItems && (
        <div className="bg-green-950">
          {group.items.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 pl-10 pr-5 py-2.5 text-sm transition-all hover:bg-green-800 ${active ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""
                  }`}
              >
                <AppIcon icon={item.icon} className="w-3.5 h-3.5 text-green-300 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

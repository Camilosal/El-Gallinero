"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import GlobalSearch from "@/components/GlobalSearch";
import { navigationGroups, type MenuGroup } from "@/lib/navigation";

const STORAGE_KEY = "sidebar-expanded-groups";
const COLLAPSED_KEY = "sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setExpandedGroups(new Set(JSON.parse(stored)));
      } catch {
        setExpandedGroups(new Set(["produccion"]));
      }
    } else {
      setExpandedGroups(new Set(["produccion"]));
    }
  }, []);

  useEffect(() => {
    const col = localStorage.getItem(COLLAPSED_KEY);
    setCollapsed(col === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedGroups)));
  }, [expandedGroups]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    // Dispatch custom event so layout can react
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed } }));
  }, [collapsed]);

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

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isItemActive = (href: string) => {
    return pathname === href || (href !== "/" && pathname.startsWith(href.split("?")[0]));
  };

  const isGroupActive = (group: MenuGroup) => {
    if (pathname === group.indexHref) return true;
    return group.items.some((item) => isItemActive(item.href));
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
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
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
        className={`fixed left-0 top-0 h-screen ${sidebarWidth} bg-green-900 text-white flex flex-col z-50 shadow-xl transition-all duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 md:hidden text-green-300 hover:text-white p-1"
          aria-label="Cerrar menú"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className={`border-b border-green-700 ${collapsed ? "px-2 py-4" : "p-5"}`}>
          {collapsed ? (
            <div className="flex flex-col items-center">
              <span className="text-2xl">🐓</span>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="text-3xl">🐓</span>
                <span>El Gallinero</span>
              </h1>
              <p className="text-green-300 text-xs mt-1">Granja Autosustentable</p>
            </>
          )}
        </div>

        {/* Global search */}
        <div className={collapsed ? "px-2 py-3" : "px-3 py-3"}>
          <GlobalSearch collapsed={collapsed} />
        </div>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center absolute -right-4 top-7 w-8 h-8 bg-green-600 hover:bg-green-500 border-2 border-green-900 rounded-full text-white text-sm font-bold shadow-lg transition-all z-10 hover:scale-110"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? "›" : "‹"}
        </button>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          {/* Dashboard link */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 py-3 text-sm transition-all hover:bg-green-800 ${
              collapsed ? "justify-center px-2" : "px-5"
            } ${pathname === "/dashboard" ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""}`}
            title={collapsed ? "Inicio" : undefined}
          >
            <span className="text-lg flex-shrink-0">📊</span>
            {!collapsed && <span>Inicio</span>}
          </Link>

          {/* QR Scanner */}
          <Link
            href="/dashboard/escanear"
            className={`flex items-center gap-3 py-3 text-sm transition-all hover:bg-green-800 ${
              collapsed ? "justify-center px-2" : "px-5"
            } ${
              pathname === "/dashboard/escanear" || pathname.startsWith("/dashboard/escanear")
                ? "bg-green-700 border-r-4 border-farm-400 font-semibold"
                : ""
            }`}
            title={collapsed ? "Escanear Ave" : undefined}
          >
            <span className="text-lg flex-shrink-0">📷</span>
            {!collapsed && <span>Escanear Ave</span>}
          </Link>

          {/* Unified groups */}
          {navigationGroups.map((group) => (
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
        </nav>

        {/* Footer: guide + logout */}
        <div className={`border-t border-green-700 space-y-2 ${collapsed ? "p-2" : "p-4"}`}>
          <Link
            href="/dashboard/guia"
            className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
              collapsed ? "px-1" : ""
            } ${
              pathname.startsWith("/dashboard/guia")
                ? "bg-green-600 text-white"
                : "bg-green-800 hover:bg-green-700 text-green-200"
            }`}
            title={collapsed ? "Guía de Usuario" : undefined}
          >
            <span>📖</span>
            {!collapsed && <span>Guía de Usuario</span>}
          </Link>
          <button
            onClick={logout}
            className={`w-full py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-green-100 text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
              collapsed ? "px-1" : ""
            }`}
            title={collapsed ? "Cerrar Sesión" : undefined}
          >
            <span>⏻</span>
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
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
        className={`flex items-center justify-center py-3 text-sm transition-all hover:bg-green-800 ${
          isIndexActive || groupActive
            ? "bg-green-700 border-r-4 border-farm-400"
            : ""
        }`}
        title={group.label}
      >
        <span className="text-lg">{group.icon}</span>
      </Link>
    );
  }

  return (
    <div key={group.id}>
      <div className={`flex items-center ${groupActive ? "bg-green-800" : ""}`}>
        <Link
          href={group.indexHref}
          className={`flex-1 flex items-center gap-3 px-5 py-3 text-sm transition-all hover:bg-green-800 ${
            isIndexActive ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""
          }`}
        >
          <span className="text-lg">{group.icon}</span>
          <span className="font-semibold text-green-100">{group.label}</span>
        </Link>
        {hasItems && (
          <button
            onClick={() => toggleGroup(group.id)}
            className="px-3 py-3 hover:bg-green-700 transition-colors"
            aria-label={`${isExpanded ? "Colapsar" : "Expandir"} ${group.label}`}
          >
            <span className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}>
              ▶
            </span>
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
                className={`flex items-center gap-3 pl-10 pr-5 py-2.5 text-sm transition-all hover:bg-green-800 ${
                  active ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
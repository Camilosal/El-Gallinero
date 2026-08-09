"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface MenuItem {
  href: string;
  label: string;
  icon: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  indexHref: string;
  items: MenuItem[];
}

// ─── Simple mode: 3 main groups (always visible) ───
const simpleGroups: MenuGroup[] = [
  {
    id: "granja",
    label: "Granja",
    icon: "🐔",
    indexHref: "/produccion",
    items: [
      { href: "/produccion?tab=huevos", label: "Huevos", icon: "🥚" },
      { href: "/produccion?tab=gallinas", label: "Gallinas", icon: "🐔" },
      { href: "/produccion?tab=pollos", label: "Pollos", icon: "🐓" },
      { href: "/produccion?tab=alimentacion", label: "Alimentación", icon: "🌾" },
      { href: "/produccion?tab=incubacion", label: "Incubación", icon: "🐣" },
      { href: "/produccion?tab=carne", label: "Carne", icon: "🍗" },
      { href: "/produccion?tab=gallinaza", label: "Gallinaza", icon: "🌱" },
      { href: "/produccion?tab=inventario", label: "Inventario", icon: "📦" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: "💰",
    indexHref: "/finanzas/ventas",
    items: [],
  },
  {
    id: "sanidad",
    label: "Sanidad",
    icon: "💊",
    indexHref: "/sanidad",
    items: [
      { href: "/sanidad/control", label: "Control", icon: "💊" },
      { href: "/sanidad/calendario", label: "Calendario", icon: "📅" },
      { href: "/sanidad/alertas", label: "Alertas", icon: "🔔" },
    ],
  },
];

// ─── Advanced mode: additional groups ───
const advancedGroups: MenuGroup[] = [
  {
    id: "analisis",
    label: "Análisis",
    icon: "📊",
    indexHref: "/analisis",
    items: [
      { href: "/analisis/kpis", label: "KPIs", icon: "🎯" },
      { href: "/analisis/reportes", label: "Reportes", icon: "📋" },
      { href: "/analisis/razas", label: "Estándares de Raza", icon: "🧬" },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: "💰",
    indexHref: "/finanzas",
    items: [
      { href: "/finanzas/ventas", label: "Ventas", icon: "💰" },
      { href: "/finanzas/egresos", label: "Egresos", icon: "📤" },
      { href: "/finanzas/finanzas", label: "Balance", icon: "📈" },
      { href: "/finanzas/presupuestos", label: "Presupuestos", icon: "💵" },
      { href: "/finanzas/cuentas", label: "Cuentas", icon: "💳" },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    icon: "🔧",
    indexHref: "/operaciones",
    items: [
      { href: "/operaciones/mantenimiento", label: "Mantenimiento", icon: "🔧" },
      { href: "/operaciones/gallinaza", label: "Gallinaza", icon: "🌱" },
    ],
  },
  {
    id: "inventarios",
    label: "Inventarios",
    icon: "📦",
    indexHref: "/inventarios",
    items: [
      { href: "/inventarios/huevos", label: "Huevos", icon: "📦" },
      { href: "/inventarios/carne", label: "Carne", icon: "🍗" },
      { href: "/inventarios/gallinaza", label: "Gallinaza", icon: "🌱" },
      { href: "/inventarios/balance", label: "Balance", icon: "⚖️" },
      { href: "/inventarios/insumos", label: "Insumos", icon: "🧰" },
    ],
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: "🗂️",
    indexHref: "/configuracion",
    items: [{ href: "/configuracion/catalogos", label: "Catálogos", icon: "🗂️" }],
  },
];

const STORAGE_KEY = "sidebar-expanded-groups";
const ADVANCED_KEY = "sidebar-advanced-mode";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

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
        setExpandedGroups(new Set(["granja"]));
      }
    } else {
      setExpandedGroups(new Set(["granja"]));
    }
  }, []);

  useEffect(() => {
    const adv = localStorage.getItem(ADVANCED_KEY);
    setAdvancedMode(adv === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedGroups)));
  }, [expandedGroups]);

  useEffect(() => {
    localStorage.setItem(ADVANCED_KEY, String(advancedMode));
  }, [advancedMode]);

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

  const allGroups = advancedMode ? [...simpleGroups, ...advancedGroups] : simpleGroups;

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
        className={`fixed left-0 top-0 h-screen w-64 bg-green-900 text-white flex flex-col z-50 shadow-xl transition-transform duration-300 ${
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

        <div className="p-5 border-b border-green-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-3xl">🐓</span>
            <span>El Gallinero</span>
          </h1>
          <p className="text-green-300 text-xs mt-1">Granja Autosustentable</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Dashboard link */}
          <Link
            href="/"
            className={`flex items-center gap-3 px-5 py-3 text-sm transition-all hover:bg-green-800 ${
              pathname === "/" ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""
            }`}
          >
            <span className="text-lg">📊</span>
            <span>Inicio</span>
          </Link>

          {/* QR Scanner */}
          <Link
            href="/escanear"
            className={`flex items-center gap-3 px-5 py-3 text-sm transition-all hover:bg-green-800 ${
              pathname === "/escanear" || pathname.startsWith("/escanear") ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""
            }`}
          >
            <span className="text-lg">📷</span>
            <span>Escanear Ave</span>
          </Link>

          {/* Simple groups */}
          {simpleGroups.map((group) => (
            <GroupItem
              key={group.id}
              group={group}
              pathname={pathname}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              isItemActive={isItemActive}
              isGroupActive={isGroupActive}
            />
          ))}

          {/* Advanced mode divider + groups */}
          {advancedMode && (
            <>
              <div className="my-3 mx-5 border-t border-green-700" />
              <p className="px-5 py-1 text-[10px] uppercase tracking-wider text-green-500 font-semibold">
                Avanzado
              </p>
              {advancedGroups.map((group) => (
                <GroupItem
                  key={group.id}
                  group={group}
                  pathname={pathname}
                  expandedGroups={expandedGroups}
                  toggleGroup={toggleGroup}
                  isItemActive={isItemActive}
                  isGroupActive={isGroupActive}
                />
              ))}
            </>
          )}
        </nav>

        {/* Footer: mode toggle + logout */}
        <div className="p-4 border-t border-green-700 space-y-2">
          <button
            onClick={() => setAdvancedMode(!advancedMode)}
            className="w-full py-1.5 rounded-lg bg-green-800 hover:bg-green-700 text-green-200 text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>{advancedMode ? "▲" : "▼"}</span>
            <span>{advancedMode ? "Modo Simple" : "Modo Avanzado"}</span>
          </button>
          <button
            onClick={logout}
            className="w-full py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-green-100 text-xs font-medium transition-colors"
          >
            ⏻ Cerrar Sesión
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
}: {
  group: MenuGroup;
  pathname: string;
  expandedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  isItemActive: (href: string) => boolean;
  isGroupActive: (g: MenuGroup) => boolean;
}) {
  const isExpanded = expandedGroups.has(group.id);
  const groupActive = isGroupActive(group);
  const isIndexActive = pathname === group.indexHref;
  const hasItems = group.items.length > 0;

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

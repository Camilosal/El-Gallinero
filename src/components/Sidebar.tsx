"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/gallinas", label: "Gallinas", icon: "🐔" },
  { href: "/pollos", label: "Pollos y Gallos", icon: "🐓" },
  { href: "/alimentacion", label: "Alimentación", icon: "🌾" },
  { href: "/huevos", label: "Producción Huevos", icon: "🥚" },
  { href: "/inventario", label: "Inventario Huevos", icon: "📦" },
  { href: "/incubacion", label: "Incubación", icon: "🐣" },
  { href: "/gallinaza", label: "Gallinaza", icon: "🌱" },
  { href: "/ventas", label: "Ventas", icon: "💰" },
  { href: "/sacrificio", label: "Carne", icon: "🍗" },
  { href: "/egresos", label: "Egresos", icon: "📤" },
  { href: "/mantenimiento", label: "Mantenimiento", icon: "🔧" },
  { href: "/sanidad", label: "Control Sanitario", icon: "💊" },
  { href: "/finanzas", label: "Finanzas", icon: "📈" },
  { href: "/catalogos", label: "Catálogos", icon: "🗂️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-green-900 text-white flex flex-col z-50 shadow-xl">
      <div className="p-5 border-b border-green-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-3xl">🐓</span>
          <span>GalliGranja</span>
        </h1>
        <p className="text-green-300 text-xs mt-1">Granja Autosustentable</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-3 text-sm transition-all hover:bg-green-800 ${
                isActive ? "bg-green-700 border-r-4 border-farm-400 font-semibold" : ""
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-green-700 text-xs text-green-300">
        <p>Sistema de Gestión Avícola</p>
        <p>v1.0 — Granja Autosustentable</p>
        <button onClick={logout} className="mt-3 w-full py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-green-100 text-xs font-medium transition-colors">
          ⏻ Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

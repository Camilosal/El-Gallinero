"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

interface MenuLink {
  href: string;
  label: string;
  description?: string;
}

interface MenuColumn {
  title: string;
  links: MenuLink[];
}

const MENUS: { id: string; label: string; columns: MenuColumn[]; width: string }[] = [
  {
    id: "app",
    label: "La app",
    width: "w-[min(42rem,calc(100vw-2rem))]",
    columns: [
      {
        title: "Conoce la aplicación",
        links: [
          { href: "/#como-funciona", label: "Cómo funciona", description: "Mira los flujos de captura y automatización." },
          { href: "/#modulos", label: "Módulos y normas", description: "Explora los módulos y referencias técnicas." },
          { href: "/funcionalidades", label: "Todas las funcionalidades", description: "Consulta el alcance por área y proceso." },
        ],
      },
      {
        title: "En contexto",
        links: [
          { href: "/realidad-campo", label: "Realidad del campo", description: "Problemas operativos y cómo se abordan." },
        ],
      },
    ],
  },
  {
    id: "recursos",
    label: "Recursos",
    width: "w-[min(38rem,calc(100vw-2rem))]",
    columns: [
      {
        title: "Aprender y consultar",
        links: [
          { href: "/bitacora", label: "Artículos y bitácoras", description: "Notas técnicas, guías y documentación." },
          { href: "/recursos/herramientas", label: "Herramientas y calculadoras", description: "Plantillas y recursos operativos." },
        ],
      },
      {
        title: "Seguir el proyecto",
        links: [
          { href: "/recursos/novedades", label: "Noticias y novedades", description: "Actualizaciones, alianzas y aprendizajes publicados." },
          { href: "/recursos", label: "Centro de recursos", description: "Ver los tres grupos en una sola página." },
        ],
      },
    ],
  },
  {
    id: "mas",
    label: "Más",
    width: "w-[min(42rem,calc(100vw-2rem))]",
    columns: [
      {
        title: "Sobre IwaGranja",
        links: [
          { href: "/nosotros", label: "Quiénes somos" },
          { href: "/open-source", label: "Código abierto y participación" },
          { href: "/contacto", label: "Contacto y acompañamiento" },
        ],
      },
      {
        title: "Ayuda y legal",
        links: [
          { href: "/ayuda", label: "Ayuda y preguntas frecuentes" },
          { href: "/terminos", label: "Términos y condiciones" },
          { href: "/privacidad", label: "Privacidad y datos personales" },
          { href: "/retracto", label: "Retracto y reembolsos" },
        ],
      },
    ],
  },
];

const MENU_LINK_CLASS =
  "block rounded-[var(--iw-radius-control)] px-3 py-2.5 hover:bg-[var(--iw-semantic-bg-feature)] focus-visible:outline-2 focus-visible:outline-[var(--iw-semantic-focus-ring)]";

export default function LandingDesktopNav() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const close = () => setOpenMenu(null);

  return (
    <nav ref={navRef} aria-label="Navegación principal" className="flex items-center gap-1 text-sm font-medium text-[var(--iw-semantic-text-secondary)]">
      {MENUS.slice(0, 1).map((menu) => (
        <div key={menu.id} className="relative">
          <button
            type="button"
            aria-expanded={openMenu === menu.id}
            aria-controls={`landing-menu-${menu.id}`}
            onClick={() => setOpenMenu((current) => current === menu.id ? null : menu.id)}
            className="inline-flex items-center gap-1 rounded-[var(--iw-radius-control)] px-3 py-2 hover:bg-[var(--iw-semantic-bg-surface)] hover:text-[var(--iw-semantic-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--iw-semantic-focus-ring)]"
          >
            {menu.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === menu.id ? "rotate-180" : ""}`} />
          </button>
          {openMenu === menu.id && (
            <div id={`landing-menu-${menu.id}`} className={`absolute left-0 top-full z-50 mt-2 grid ${menu.width} grid-cols-2 gap-5 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 text-left shadow-[var(--iw-shadow-popover)]`}>
              {menu.columns.map((column) => (
                <section key={column.title}>
                  <h2 className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">{column.title}</h2>
                  <ul className="space-y-1">
                    {column.links.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} onClick={close} className={MENU_LINK_CLASS}>
                          <span className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)]">{item.label}</span>
                          {item.description && <span className="mt-0.5 block text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)]">{item.description}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ))}
      <Link href="/planes" className="rounded-[var(--iw-radius-control)] px-3 py-2 hover:bg-[var(--iw-semantic-bg-surface)] hover:text-[var(--iw-semantic-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--iw-semantic-focus-ring)]">Planes</Link>
      {MENUS.slice(1).map((menu) => (
        <div key={menu.id} className="relative">
          <button
            type="button"
            aria-expanded={openMenu === menu.id}
            aria-controls={`landing-menu-${menu.id}`}
            onClick={() => setOpenMenu((current) => current === menu.id ? null : menu.id)}
            className="inline-flex items-center gap-1 rounded-[var(--iw-radius-control)] px-3 py-2 hover:bg-[var(--iw-semantic-bg-surface)] hover:text-[var(--iw-semantic-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--iw-semantic-focus-ring)]"
          >
            {menu.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === menu.id ? "rotate-180" : ""}`} />
          </button>
          {openMenu === menu.id && (
            <div id={`landing-menu-${menu.id}`} className={`absolute right-0 top-full z-50 mt-2 grid ${menu.width} grid-cols-2 gap-5 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 text-left shadow-[var(--iw-shadow-popover)]`}>
              {menu.columns.map((column) => (
                <section key={column.title}>
                  <h2 className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">{column.title}</h2>
                  <ul className="space-y-1">
                    {column.links.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} onClick={close} className={MENU_LINK_CLASS}>
                          <span className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)]">{item.label}</span>
                          {item.description && <span className="mt-0.5 block text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)]">{item.description}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

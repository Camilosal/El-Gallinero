"use client";

import Link from "next/link";
import { useState, useCallback } from "react";

const LINKS = [
  { href: "#vitrina", label: "Cómo se ve" },
  { href: "#estandares", label: "Estándares" },
  { href: "#modulos", label: "Qué incluye" },
  { href: "#planes", label: "Planes" },
  { href: "#acceso", label: "Empezar" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* Hamburger button — visible only on mobile */}
      <button
        className="land-hamburger"
        onClick={toggle}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
      >
        <span className={`land-ham-line ${open ? "open" : ""}`} />
        <span className={`land-ham-line ${open ? "open" : ""}`} />
        <span className={`land-ham-line ${open ? "open" : ""}`} />
      </button>

      {/* Mobile overlay menu */}
      <div className={`land-mobile-menu ${open ? "open" : ""}`}>
        <nav className="land-mobile-nav">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={close}>
              {l.label}
            </a>
          ))}
          <div className="pt-3 mt-2 border-t border-[var(--line)] flex flex-col gap-2">
            <Link
              href="/registro"
              onClick={close}
              className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--forest-deep)] transition"
            >
              Crear granja gratis (3 min)
            </Link>
            <Link
              href="/login"
              onClick={close}
              className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-center text-sm font-medium text-[var(--ink)] hover:border-[var(--forest)] transition"
            >
              Entrar a mi cuenta
            </Link>
          </div>
        </nav>
      </div>

      {/* Backdrop */}
      {open && <div className="land-mobile-backdrop" onClick={close} />}
    </>
  );
}

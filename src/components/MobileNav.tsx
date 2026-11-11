"use client";

import { useState, useCallback } from "react";

const LINKS = [
  { href: "#alcance", label: "El sistema" },
  { href: "#funcionalidades", label: "Qué puedes gestionar" },
  { href: "#flujo", label: "Trazabilidad" },
  { href: "#acceso", label: "Acceso" },
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
        </nav>
      </div>

      {/* Backdrop */}
      {open && <div className="land-mobile-backdrop" onClick={close} />}
    </>
  );
}

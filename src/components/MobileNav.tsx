"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#modulos", label: "Módulos y Normas" },
  { href: "#planes", label: "Planes" },
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
        <div className="flex items-center gap-2.5 pb-3 mb-2 border-b border-[var(--line)]">
          <BrandLogo
            variant="mark"
            size={30}
            decorative
            className="rounded-lg border border-[var(--line)]"
          />
          <span className="font-display text-base font-bold text-[var(--ink)]">
            El Corral
          </span>
        </div>
        <nav className="land-mobile-nav">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={close}>
              {l.label}
            </a>
          ))}
          <Link href="/bitacora" onClick={close}>
            Bitácora
          </Link>
          <div className="pt-3 mt-2 border-t border-[var(--line)] flex flex-col gap-2">
            <Link
              href="/registro"
              onClick={close}
              className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--forest-deep)] transition"
            >
              Crear granja gratis
            </Link>
            <Link
              href="/login"
              onClick={close}
              className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-center text-sm font-medium text-[var(--ink)] hover:border-[var(--forest)] transition"
            >
              Entrar
            </Link>
          </div>
        </nav>
      </div>

      {/* Backdrop */}
      {open && <div className="land-mobile-backdrop" onClick={close} />}
    </>
  );
}

"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const GROUP_LINK_CLASS = "!block !border-0 !py-2 !font-sans !text-sm !font-medium text-slate-700 hover:text-emerald-900";
const SUMMARY_CLASS = "flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-display text-base font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        className="land-hamburger"
        onClick={toggle}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="landing-mobile-navigation"
      >
        <span className={`land-ham-line ${open ? "open" : ""}`} />
        <span className={`land-ham-line ${open ? "open" : ""}`} />
        <span className={`land-ham-line ${open ? "open" : ""}`} />
      </button>

      <div id="landing-mobile-navigation" className={`land-mobile-menu ${open ? "open" : ""}`}>
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-7 pb-3 pt-3">
          <BrandLogo variant="square" size={42} className="rounded-xl border border-[var(--line)] bg-white/90 p-1" />
          <span className="text-sm font-semibold text-[var(--ink)]">Explora IwaGranja</span>
        </div>
        <nav aria-label="Navegación principal móvil" className="land-mobile-nav">
          <details className="border-b border-[var(--line)]">
            <summary className={SUMMARY_CLASS}>La app <ChevronDown className="h-4 w-4" /></summary>
            <div className="space-y-0.5 pb-2 pl-3">
              <Link href="/#como-funciona" onClick={close} className={GROUP_LINK_CLASS}>Cómo funciona</Link>
              <Link href="/#modulos" onClick={close} className={GROUP_LINK_CLASS}>Módulos y normas</Link>
              <Link href="/funcionalidades" onClick={close} className={GROUP_LINK_CLASS}>Todas las funcionalidades</Link>
              <Link href="/realidad-campo" onClick={close} className={GROUP_LINK_CLASS}>Realidad del campo</Link>
            </div>
          </details>

          <Link href="/planes" onClick={close} className="!py-3">Planes</Link>

          <details className="border-b border-[var(--line)]">
            <summary className={SUMMARY_CLASS}>Recursos <ChevronDown className="h-4 w-4" /></summary>
            <div className="space-y-0.5 pb-2 pl-3">
              <Link href="/bitacora" onClick={close} className={GROUP_LINK_CLASS}>Artículos y bitácoras</Link>
              <Link href="/recursos/herramientas" onClick={close} className={GROUP_LINK_CLASS}>Herramientas y calculadoras</Link>
              <Link href="/recursos/novedades" onClick={close} className={GROUP_LINK_CLASS}>Noticias y novedades</Link>
              <Link href="/recursos" onClick={close} className={GROUP_LINK_CLASS}>Ver todos los recursos</Link>
            </div>
          </details>

          <details className="border-b border-[var(--line)]">
            <summary className={SUMMARY_CLASS}>Más <ChevronDown className="h-4 w-4" /></summary>
            <div className="pb-2 pl-3">
              <p className="pt-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--forest)]">Sobre IwaGranja</p>
              <div className="space-y-0.5">
                <Link href="/nosotros" onClick={close} className={GROUP_LINK_CLASS}>Quiénes somos</Link>
                <Link href="/open-source" onClick={close} className={GROUP_LINK_CLASS}>Código abierto y participación</Link>
                <Link href="/contacto" onClick={close} className={GROUP_LINK_CLASS}>Contacto y acompañamiento</Link>
              </div>
              <p className="pt-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--forest)]">Ayuda y legal</p>
              <div className="space-y-0.5">
                <Link href="/ayuda" onClick={close} className={GROUP_LINK_CLASS}>Ayuda y preguntas frecuentes</Link>
                <Link href="/terminos" onClick={close} className={GROUP_LINK_CLASS}>Términos y condiciones</Link>
                <Link href="/privacidad" onClick={close} className={GROUP_LINK_CLASS}>Privacidad y datos personales</Link>
                <Link href="/retracto" onClick={close} className={GROUP_LINK_CLASS}>Retracto y reembolsos</Link>
              </div>
            </div>
          </details>

          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
            <Link href="/registro" onClick={close} className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--forest-deep)] transition">Crear granja gratis</Link>
            <Link href="/login" onClick={close} className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-center text-sm font-medium text-[var(--ink)] hover:border-[var(--forest)] transition">Entrar</Link>
          </div>
        </nav>
      </div>

      {open && <div className="land-mobile-backdrop" onClick={close} />}
    </>
  );
}

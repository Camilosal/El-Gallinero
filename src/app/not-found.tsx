import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";

export default function NotFoundPage() {
  return (
    <PublicPageShell
      title="Página no encontrada (404)"
      intro="La dirección que buscaste no existe o cambió de ubicación en IwaGranja. Puedes retomar desde las secciones principales:"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/",
            title: "Inicio y vitrina",
            desc: "Conoce los 8 módulos reales, el modo sin señal y cómo empezar hoy en tu granja.",
          },
          {
            href: "/guia",
            title: "Manual de uso",
            desc: "Paso a paso ilustrado de huevos NTC 1240, alimento, sanidad ICA y finanzas.",
          },
          {
            href: "/planes",
            title: "Planes y precios",
            desc: "Plan Gratis para iniciar y cálculo de costos Productor o Agregador, sin cobros automáticos.",
          },
          {
            href: "/bitacora",
            title: "Bitácora de campo",
            desc: "Artículos prácticos con datos reales sobre costos, retiros y compostaje.",
          },
          {
            href: "/ayuda",
            title: "Ayuda y preguntas frecuentes",
            desc: "Respuestas claras sobre pagos por Nequi/PSE, exportación de datos y roles.",
          },
          {
            href: "/contacto",
            title: "Contacto y soporte",
            desc: "Escríbenos por WhatsApp, correo o formulario directo; respondemos en 1 día hábil.",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 hover:border-[var(--iw-semantic-action-primary)] transition shadow-[var(--iw-shadow-card)]"
          >
            <h2 className="font-display text-base font-bold text-[var(--iw-semantic-text-primary)]">{item.title}</h2>
            <p className="mt-1.5 text-sm text-[var(--iw-semantic-text-secondary)] leading-relaxed">{item.desc}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4">
              Ir a {item.title} →
            </span>
          </Link>
        ))}
      </div>
    </PublicPageShell>
  );
}

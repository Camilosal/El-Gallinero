import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Realidad del campo y soluciones en galpón · El Corral";
const DESCRIPTION =
  "Cómo resolvemos los 6 dolores reales del galpón y la granja mixta: operación sin señal, subsidio cruzado, retiro ICA, mermas NTC 1240 y bodega.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/realidad-campo",
  ogImage: "/images/guia/captura-rapida-modal.webp",
  ogImageAlt: "Captura rápida sin señal en el galpón con El Corral",
});

const FIELD_PAINS = [
  {
    code: "RETO 01 · CONECTIVIDAD Y TIEMPO",
    pain: "Sin señal en el galpón, manos ocupadas y libreta mojada",
    reality:
      "En el corral no hay tiempo para formularios de 20 campos ni siempre llega el internet. Muchos productores terminan anotando en papel y pasando datos tarde en la noche (o nunca).",
    solution:
      "Modo offline cifrado en IndexedDB (tras la primera carga con red), escáner QR en la puerta del galpón, botones grandes de alto contraste bajo el sol y dictado por voz con Gina para agilizar el registro en galpón.",
    moduleLink: "/guia#mod-primeros-pasos",
    moduleLabel: "Ver modo offline y Gina",
  },
  {
    code: "RETO 02 · DINERO Y MARGEN REAL",
    pain: "No saber si realmente se gana o qué especie está sosteniendo a la otra",
    reality:
      "Cuando se mezclan gastos de luz, mano de obra y concentrado entre ponedoras, engorde, conejos o cuyes, el subsidio cruzado oculta qué lote da pérdida y se termina vendiendo por debajo del costo.",
    solution:
      "Contabilidad analítica por especie y lote: separa costos directos, prorratea indirectos compartidos y muestra el punto de equilibrio unitario antes de facturar.",
    moduleLink: "/guia#mod-finanzas",
    moduleLabel: "Ver finanzas y punto de equilibrio",
  },
  {
    code: "RETO 03 · HUEVOS Y MERMAS",
    pain: "Huevos nuevos saliendo antes que los viejos y rotos que descuadran caja",
    reality:
      "Sin control por tamaño ni orden de salida (PEPS), las cubetas más antiguas pierden frescura en bodega y los descartes nunca se reflejan en el rendimiento real del lote.",
    solution:
      "Clasificación NTC 1240 de Jumbo a C en cubetas de 30 unidades, descuento de rotos antes de entrar a bodega y salida PEPS obligatoria al vender.",
    moduleLink: "/guia#mod-produccion",
    moduleLabel: "Ver postura NTC 1240",
  },
  {
    code: "RETO 04 · INOCUIDAD Y SANIDAD",
    pain: "Olvidar fechas de vacuna o despachar lotes en tiempo de retiro",
    reality:
      "Un descuido tras aplicar un antibiótico o antiparasitario pone en riesgo al consumidor, al comprador institucional y la certificación sanitaria de toda la granja.",
    solution:
      "Calendario sanitario ICA precargado y bloqueo preventivo automático: mientras un lote esté en tiempo de retiro, la app impide registrar ventas de huevo o carne de ese lote.",
    moduleLink: "/guia#mod-sanidad",
    moduleLabel: "Ver sanidad y bloqueos",
  },
  {
    code: "RETO 05 · ALIMENTO Y BODEGA",
    pain: "Quedarse sin bultos de concentrado a mitad de semana",
    reality:
      "Calcular al ojo cuántos bultos quedan para 400 aves o 60 conejos genera compras de urgencia más caras o cambios bruscos de dieta.",
    solution:
      "Inventario por bultos de 40 kg con descuento automático al alimentar, cálculo de días de cobertura restantes y alerta temprana de reposición.",
    moduleLink: "/guia#mod-almacen",
    moduleLabel: "Ver alimento y bodega",
  },
  {
    code: "RETO 06 · ADOPCIÓN DEL EQUIPO",
    pain: "Sistemas complejos que el operario abandona a la primera semana",
    reality:
      "La mayoría del software agropecuario muestra decenas de menús contables y configuraciones históricas el primer día, abrumando al equipo.",
    solution:
      "Arranque Día 1 sin deuda histórica: cargas solo tus animales vivos hoy y ves los frentes esenciales. El resto de los 8 módulos reales y herramientas avanzadas se activan gradualmente cuando tu escala lo pide.",
    moduleLink: "/guia#mod-configuracion",
    moduleLabel: "Ver activación progresiva",
  },
] as const;

export default function RealidadCampoPage() {
  return (
    <PublicPageShell
      title="La realidad del campo y cómo la atendemos"
      intro="No diseñamos El Corral desde un escritorio: cada módulo responde a un problema real que viven todos los días los productores pequeños y medianos."
      path="/realidad-campo"
      description={DESCRIPTION}
    >
      <div className="space-y-6">
        <div className="grid gap-5">
          {FIELD_PAINS.map((item) => (
            <article
              key={item.code}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
            >
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                  {item.code}
                </span>
                <Link
                  href={item.moduleLink}
                  className="text-xs font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-950"
                >
                  {item.moduleLabel} →
                </Link>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    El dolor real en el galpón
                  </p>
                  <h2 className="mt-1 text-base font-bold text-slate-900">{item.pain}</h2>
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed">{item.reality}</p>
                </div>
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                    Cómo lo resolvemos en El Corral
                  </p>
                  <p className="mt-2 text-sm text-slate-800 leading-relaxed">{item.solution}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="rounded-2xl bg-[#132a1e] p-6 text-[#f5efe2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              ¿Tienes otro reto puntual en tu granja?
            </h2>
            <p className="mt-1 text-sm text-[#d6dfd8]">
              Puedes probar gratis 30 días o contarnos tu caso para priorizarlo en el desarrollo abierto.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/registro"
              className="inline-flex items-center rounded-lg bg-[#e9c46a] px-4 py-2.5 text-sm font-bold text-[#132a1e] hover:bg-[#f2d385]"
            >
              Crear mi granja gratis →
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center rounded-lg border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Contar mi caso
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}

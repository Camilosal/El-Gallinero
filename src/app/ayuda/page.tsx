import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { FAQS } from "@/lib/legal-content";
import { buildFaqNode, buildPageMetadata, canonicalUrlFor } from "@/lib/seo";

const TITLE = "Centro de ayuda y preguntas frecuentes · El Corral";
const DESCRIPTION =
  "Respuestas directas sobre pagos por ciclo con Nequi o PSE, modo sin señal, exportación en Excel, cierre de ciclo y el rol de Gina.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/ayuda",
  ogImage: "/images/guia/configuracion-panel.webp",
  ogImageAlt: "Panel de configuración, planes y soporte en El Corral",
});

export default function AyudaPage() {
  return (
    <PublicPageShell
      title="Ayuda y preguntas frecuentes"
      intro="Respuestas cortas a lo que más nos preguntan. Para el paso a paso completo, lee el manual de uso."
      path="/ayuda"
      description={DESCRIPTION}
      pageType="WebPage"
      extraJsonLdNodes={[buildFaqNode(canonicalUrlFor("/ayuda"), FAQS)]}
    >
      <p className="mb-6 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/guia" className="font-semibold text-emerald-800 underline underline-offset-2">
          Ir al manual de uso →
        </Link>
        <Link href="/planes" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
          Comparar planes y precios →
        </Link>
        <Link href="/terminos" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
          Ver términos del servicio →
        </Link>
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        {FAQS.map((f) => (
          <article key={f.q} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">{f.q}</h2>
            <p className="mt-1.5 flex-1 text-slate-700 leading-relaxed">{f.a}</p>
            {f.image && (
              <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-xl border border-slate-200">
                <Image src={f.image.src} alt={f.image.alt} fill sizes="(max-width: 768px) 100vw, 520px" className="object-cover object-top" />
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-600">
        ¿No encontraste tu respuesta? <Link href="/contacto" className="font-semibold underline">Escríbenos desde la página de contacto</Link>.
      </p>
    </PublicPageShell>
  );
}

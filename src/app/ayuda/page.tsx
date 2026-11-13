import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { FAQS } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Ayuda y preguntas frecuentes · El Gallinero" };

export default function AyudaPage() {
  return (
    <PublicPageShell
      title="Ayuda y preguntas frecuentes"
      intro="Respuestas cortas a lo que más nos preguntan. Para el paso a paso completo, lee el manual de uso."
    >
      <p className="mb-6">
        <Link href="/guia" className="font-semibold text-emerald-800 underline underline-offset-2">
          Ir al manual de uso →
        </Link>
      </p>
      <div className="space-y-5">
        {FAQS.map((f) => (
          <article key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">{f.q}</h2>
            <p className="mt-1.5 text-slate-700 leading-relaxed">{f.a}</p>
            {f.image && (
              <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-slate-200">
                <Image src={f.image.src} alt={f.image.alt} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover object-top" />
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-600">
        ¿No encontraste tu respuesta? <Link href="/contacto" className="font-semibold underline">Escríbenos</Link>.
      </p>
    </PublicPageShell>
  );
}

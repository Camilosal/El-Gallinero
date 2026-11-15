import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { PublicPageShell } from "@/components/LegalPage";
import { LEGAL, PENDING, RESPONSE_TIME } from "@/lib/legal";
import { buildPageMetadata, ENTITY_IDS } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Contacto, soporte e implementación · El Corral";
const DESCRIPTION =
  "Escríbenos para soporte técnico, implementación Llave en Mano o consultas de datos personales y retracto. Respondemos en 1 día hábil.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/contacto",
  ogImage: "/images/guia/asistente-ia.webp",
  ogImageAlt: "Canales de contacto y soporte técnico de El Corral",
});

export default function ContactoPage() {
  const email = LEGAL.email === PENDING ? "" : LEGAL.email;
  const whatsapp = LEGAL.whatsapp === PENDING ? "" : LEGAL.whatsapp;
  const rawDigits = whatsapp.replace(/\D/g, "");
  const phone =
    rawDigits.length === 10 && rawDigits.startsWith("3")
      ? `+57${rawDigits}`
      : rawDigits
        ? `+${rawDigits}`
        : "+573026693366";

  const contactPointNode = {
    "@type": "ContactPoint",
    "@id": "https://gallinero.iwage.co/contacto#contactpoint",
    contactType: "customer support",
    email: email || "gallinero@iwage.co",
    telephone: phone,
    availableLanguage: "es",
    areaServed: "CO",
    parentOrganization: { "@id": ENTITY_IDS.organization },
  };

  return (
    <PublicPageShell
      title="Contacto"
      intro={`Escríbenos por soporte, para implementar El Corral en tu finca o por temas de datos personales. Respondemos en ${RESPONSE_TIME}.`}
      path="/contacto"
      description={DESCRIPTION}
      pageType="ContactPage"
      extraJsonLdNodes={[contactPointNode]}
    >
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Canales directos</h2>
          <ul className="space-y-2.5 text-sm text-slate-700">
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Correo electrónico</span>
              <strong>{email || "próximamente"}</strong>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">WhatsApp</span>
              <strong>{whatsapp || "próximamente"}</strong>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ciudad</span>
              <span>{LEGAL.ciudad}</span>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tiempo de respuesta</span>
              <span>{RESPONSE_TIME}</span>
            </li>
          </ul>
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 space-y-1">
            <p>
              <Link href="/ayuda" className="font-semibold text-emerald-800 underline underline-offset-2">
                Preguntas frecuentes y ayuda rápida →
              </Link>
            </p>
            <p>
              <Link href="/privacidad" className="font-semibold text-slate-700 underline underline-offset-2">
                Política de tratamiento de datos (Ley 1581) →
              </Link>
            </p>
          </div>
        </aside>
        <div className="lg:col-span-8">
          <ContactForm email={email} whatsapp={whatsapp} />
        </div>
      </div>
    </PublicPageShell>
  );
}

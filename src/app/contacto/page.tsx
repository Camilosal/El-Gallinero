import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { PublicPageShell } from "@/components/LegalPage";
import { LEGAL, PENDING, RESPONSE_TIME } from "@/lib/legal";
import { buildPageMetadata, ENTITY_IDS } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Contacto, soporte e implementación · IwaGranja";
const DESCRIPTION =
  "Escríbenos para soporte técnico, implementación Llave en Mano o consultas de datos personales y retracto. Respondemos en 1 día hábil.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/contacto",
  ogImage: "/images/guia/asistente-ia.webp",
  ogImageAlt: "Canales de contacto y soporte técnico de IwaGranja",
});

type ContactSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ContactoPage({
  searchParams,
}: {
  searchParams: Promise<ContactSearchParams>;
}) {
  const params = await searchParams;
  const farmId = firstParam(params.farmId).trim();
  const farmName = firstParam(params.farmName).trim().slice(0, 160);
  const beneficiaries = Number(firstParam(params.beneficiaries));
  const months = Number(firstParam(params.months));
  const amount = Number(firstParam(params.amount));
  const isOrganizationRenewal =
    firstParam(params.request) === "organization-renewal" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmId);
  const initialOrganizationRenewal = isOrganizationRenewal
    ? {
        farm: farmName,
        message: [
          "Solicito renovar el contrato de Organización.",
          `FarmID: ${farmId}`,
          Number.isSafeInteger(beneficiaries) && beneficiaries >= 25
            ? `Tamaño de cohorte solicitado: ${beneficiaries} beneficiarios.`
            : "",
          [3, 6, 12].includes(months) ? `Período solicitado: ${months} meses.` : "",
          Number.isSafeInteger(amount) && amount >= 0
            ? `Total estimado mostrado: $${new Intl.NumberFormat("es-CO").format(amount)} COP, sujeto a revisión del contrato.`
            : "",
        ].filter(Boolean).join("\n"),
      }
    : null;

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
    "@id": "https://app.iwage.co/contacto#contactpoint",
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
      intro={`Escríbenos por soporte, para implementar IwaGranja en tu finca o por temas de datos personales. Respondemos en ${RESPONSE_TIME}.`}
      path="/contacto"
      description={DESCRIPTION}
      pageType="ContactPage"
      extraJsonLdNodes={[contactPointNode]}
    >
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <aside className="lg:col-span-4 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 space-y-4">
          <h2 className="text-base font-bold text-[var(--iw-semantic-text-primary)]">Canales directos</h2>
          <ul className="space-y-2.5 text-sm text-[var(--iw-semantic-text-primary)]">
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">Correo electrónico</span>
              <strong>{email || "próximamente"}</strong>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">WhatsApp</span>
              <strong>{whatsapp || "próximamente"}</strong>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">Ciudad</span>
              <span>{LEGAL.ciudad}</span>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">Tiempo de respuesta</span>
              <span>{RESPONSE_TIME}</span>
            </li>
          </ul>
          <div className="border-t border-[var(--iw-semantic-border-default)] pt-3 text-xs text-[var(--iw-semantic-text-secondary)] space-y-1">
            <p>
              <Link href="/ayuda" className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-2">
                Preguntas frecuentes y ayuda rápida →
              </Link>
            </p>
            <p>
              <Link href="/privacidad" className="font-semibold text-[var(--iw-semantic-text-primary)] underline underline-offset-2">
                Política de tratamiento de datos (Ley 1581) →
              </Link>
            </p>
          </div>
        </aside>
        <div className="lg:col-span-8">
          <ContactForm email={email} whatsapp={whatsapp} initialOrganizationRenewal={initialOrganizationRenewal} />
        </div>
      </div>
    </PublicPageShell>
  );
}

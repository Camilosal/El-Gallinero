import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { PublicPageShell } from "@/components/LegalPage";
import { LEGAL, PENDING, RESPONSE_TIME } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contacto · El Gallinero" };

export default function ContactoPage() {
  const email = LEGAL.email === PENDING ? "" : LEGAL.email;
  const whatsapp = LEGAL.whatsapp === PENDING ? "" : LEGAL.whatsapp;
  return (
    <PublicPageShell
      title="Contacto"
      intro={`Escríbenos por soporte, para implementar El Gallinero en tu finca o por temas de datos personales. Respondemos en ${RESPONSE_TIME}.`}
    >
      <ul className="mb-6 space-y-1 text-slate-700">
        <li>Correo: <strong>{email || "próximamente"}</strong></li>
        <li>WhatsApp: <strong>{whatsapp || "próximamente"}</strong></li>
        <li>Ciudad: {LEGAL.ciudad}</li>
      </ul>
      <ContactForm email={email} whatsapp={whatsapp} />
    </PublicPageShell>
  );
}

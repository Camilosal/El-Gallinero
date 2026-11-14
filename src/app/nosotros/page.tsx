import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { NOSOTROS_TEXT } from "@/lib/legal-content";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Quiénes somos: historia en Ibagué · El Gallinero";
const DESCRIPTION =
  "Historia de El Gallinero en Ibagué, Tolima: herramienta abierta de Iwagé Granja probada en Ambalá para granjas avícolas y multiespecie.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/nosotros",
  ogImage: "/images/heroes/inicio-2x.webp",
  ogImageAlt: "Gallinero piloto de Iwagé Granja en Ambalá, Ibagué",
});

export default function NosotrosPage() {
  return (
    <PublicPageShell
      title="Nosotros"
      path="/nosotros"
      description={DESCRIPTION}
      pageType="AboutPage"
    >
      <div className="grid gap-8 lg:grid-cols-12 items-center">
        <figure className="lg:col-span-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative aspect-[16/10]">
            <Image
              src="/images/heroes/inicio-2x.webp"
              alt="Gallinero base en Ambalá, Ibagué"
              fill
              sizes="(max-width: 1024px) 100vw, 520px"
              className="object-cover"
              priority
            />
          </div>
          <figcaption className="border-t border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600">
            Gallinero base en Ambalá · Ibagué, Tolima · Operación mixta probada en campo
          </figcaption>
        </figure>

        <div className="lg:col-span-6 space-y-5">
          <p className="text-slate-700 leading-relaxed text-lg">{NOSOTROS_TEXT}</p>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">Ecosistema y origen en Tolima</p>
            <p>
              El proyecto hace parte de{" "}
              <a
                href="https://iwage.co"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-800 underline underline-offset-2"
              >
                Iwagé Granja (iwage.co)
              </a>{" "}
              y es desarrollado por{" "}
              <a
                href="https://camilosaldarriaga.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-800 underline underline-offset-2"
              >
                Camilo Saldarriaga
              </a>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link
              href="/planes"
              className="font-semibold text-emerald-800 underline underline-offset-2"
            >
              Ver planes por ciclo →
            </Link>
            <Link
              href="/bitacora"
              className="font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2"
            >
              Leer notas técnicas de campo en la Bitácora →
            </Link>
            <Link
              href="/contacto"
              className="font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2"
            >
              Escribirnos desde Contacto →
            </Link>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}

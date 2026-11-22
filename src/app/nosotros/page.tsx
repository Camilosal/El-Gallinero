import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { NOSOTROS_TEXT } from "@/lib/legal-content";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Quiénes somos: historia en Ibagué · IwaGranja";
const DESCRIPTION =
  "Historia de IwaGranja en Ibagué, Tolima: herramienta abierta probada en la granja piloto de Ambalá para producción avícola y multiespecie.";

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
        <figure className="lg:col-span-6 overflow-hidden rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-sm">
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
          <figcaption className="border-t border-[var(--iw-semantic-border-default)] px-4 py-2.5 text-xs font-medium text-[var(--iw-semantic-text-secondary)]">
            Gallinero base en Ambalá · Ibagué, Tolima · Operación mixta probada en campo
          </figcaption>
        </figure>

        <div className="lg:col-span-6 space-y-5">
          <p className="text-[var(--iw-semantic-text-primary)] leading-relaxed text-lg">{NOSOTROS_TEXT}</p>

          <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4 text-sm text-[var(--iw-semantic-text-primary)] space-y-2">
            <p className="font-semibold text-[var(--iw-semantic-text-primary)]">Ecosistema y origen en Tolima</p>
            <p>
              El proyecto hace parte de{" "}
              <a
                href="https://iwage.co"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-2"
              >
                Iwagé Granja (iwage.co)
              </a>{" "}
              y es desarrollado por{" "}
              <a
                href="https://camilosaldarriaga.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-2"
              >
                Camilo Saldarriaga
              </a>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link
              href="/planes"
              className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-2"
            >
              Calcular el costo del plan →
            </Link>
            <Link
              href="/bitacora"
              className="font-semibold text-[var(--iw-semantic-text-primary)] hover:text-[var(--iw-semantic-text-primary)] underline underline-offset-2"
            >
              Leer notas técnicas de campo en la Bitácora →
            </Link>
            <Link
              href="/contacto"
              className="font-semibold text-[var(--iw-semantic-text-primary)] hover:text-[var(--iw-semantic-text-primary)] underline underline-offset-2"
            >
              Escribirnos desde Contacto →
            </Link>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}

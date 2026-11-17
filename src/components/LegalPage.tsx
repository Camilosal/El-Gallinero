import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LegalFooter } from "@/components/LegalFooter";
import { JsonLd } from "@/components/JsonLd";
import type { LegalDocument } from "@/lib/legal-content";
import { legalIsDraft } from "@/lib/legal";
import { buildJsonLd, type BreadcrumbItem, type WebPageKind } from "@/lib/seo";

export function PublicPageShell({
  title,
  intro,
  path,
  description,
  pageType = "WebPage",
  breadcrumbs,
  extraJsonLdNodes,
  headerAction,
  children,
}: {
  title: string;
  intro?: string;
  path?: string;
  description?: string;
  pageType?: WebPageKind;
  breadcrumbs?: BreadcrumbItem[];
  extraJsonLdNodes?: Record<string, unknown>[];
  headerAction?: { href: string; label: string } | null;
  children: React.ReactNode;
}) {
  const resolvedHeaderAction = headerAction === undefined
    ? { href: "/registro", label: "Crear granja gratis" }
    : headerAction;
  const resolvedBreadcrumbs: BreadcrumbItem[] | undefined = breadcrumbs
    ? breadcrumbs
    : path
      ? [{ name: title, path }]
      : undefined;

  const jsonLd = path
    ? buildJsonLd({
      path,
      title,
      description: description ?? intro,
      pageType,
      breadcrumbs: resolvedBreadcrumbs,
      extraNodes: extraJsonLdNodes,
    })
    : null;

  return (
    <div className="min-h-screen bg-[var(--cream,#faf6ec)] flex flex-col">
      {jsonLd && <JsonLd data={jsonLd} />}
      <header className="border-b border-[var(--line,#e5dfcf)] bg-white">
        <div className="max-w-[1080px] mx-auto px-4 sm:px-7 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Volver al inicio de IwaGranja"
            className="inline-flex items-center gap-2.5 font-bold text-slate-900 min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <BrandLogo variant="horizontal" height={38} className="h-8 sm:h-[38px] w-auto" />
          </Link>
          {resolvedHeaderAction && (
            <Link
              href={resolvedHeaderAction.href}
              className={headerAction === undefined
                ? "rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                : "rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-700 hover:text-emerald-900"}
            >
              {resolvedHeaderAction.label}
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-[1080px] w-full mx-auto px-4 sm:px-7 py-8 sm:py-12">
        {resolvedBreadcrumbs && resolvedBreadcrumbs.length > 0 && (
          <nav aria-label="Migas de pan" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <Link href="/" className="hover:text-slate-900 underline underline-offset-2">
              Inicio
            </Link>
            {resolvedBreadcrumbs.map((crumb, idx) => {
              const isLast = idx === resolvedBreadcrumbs.length - 1;
              return (
                <span key={crumb.path} className="inline-flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  {isLast ? (
                    <span className="font-semibold text-slate-800" aria-current="page">
                      {crumb.name}
                    </span>
                  ) : (
                    <Link href={crumb.path} className="hover:text-slate-900 underline underline-offset-2">
                      {crumb.name}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
        {intro && <p className="mt-2 max-w-3xl text-slate-600 leading-relaxed">{intro}</p>}
        <div className="mt-6">{children}</div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalDocPage({
  doc,
  path,
  description,
}: {
  doc: LegalDocument;
  path?: string;
  description?: string;
}) {
  return (
    <PublicPageShell
      title={doc.title}
      intro={doc.intro}
      path={path}
      description={description ?? doc.intro}
    >
      {legalIsDraft() && (
        <div
          role="note"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <strong>Borrador pendiente de revisión legal.</strong> Los datos marcados
          como «[por confirmar]» se completan con la información real del operador
          antes del primer pago.
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        {doc.sections.map((s) => (
          <section key={s.title} className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
            <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-2 text-slate-700 leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </PublicPageShell>
  );
}

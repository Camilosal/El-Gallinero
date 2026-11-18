import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ResourceVisualCard({
  href,
  category,
  title,
  summary,
  image,
  imageAlt,
  actionLabel = "Abrir recurso",
  badge,
}: {
  href: string;
  category: string;
  title: string;
  summary: string;
  image: string;
  imageAlt: string;
  actionLabel?: string;
  badge?: string;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm">
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden bg-slate-100" aria-label={`${actionLabel}: ${title}`}>
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 360px"
          className="object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">{category}</span>
          {badge && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">{badge}</span>}
        </div>
        <h2 className="mt-2 text-base font-bold leading-snug text-slate-900">
          <Link href={href} className="hover:text-emerald-800">{title}</Link>
        </h2>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{summary}</p>
        <Link href={href} className="mt-4 inline-flex min-h-10 items-center gap-1.5 border-t border-slate-100 pt-3 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
          {actionLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

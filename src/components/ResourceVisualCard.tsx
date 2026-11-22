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
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] shadow-2xs transition hover:-translate-y-0.5 hover:border-[var(--iw-semantic-border-strong)] hover:shadow-sm">
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden bg-[var(--iw-semantic-bg-page)]" aria-label={`${actionLabel}: ${title}`}>
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
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--iw-semantic-action-primary)]">{category}</span>
          {badge && <span className="rounded-full border border-[var(--iw-color-ochre)]/50 bg-[var(--iw-semantic-bg-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--iw-semantic-text-primary)]">{badge}</span>}
        </div>
        <h2 className="mt-2 text-base font-bold leading-snug text-[var(--iw-semantic-text-primary)]">
          <Link href={href} className="hover:text-[var(--iw-semantic-action-primary-hover)]">{title}</Link>
        </h2>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">{summary}</p>
        <Link href={href} className="mt-4 inline-flex min-h-10 items-center gap-1.5 border-t border-[var(--iw-semantic-border-default)] pt-3 text-sm font-semibold text-[var(--iw-semantic-action-primary)] hover:text-[var(--iw-semantic-action-primary-hover)]">
          {actionLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

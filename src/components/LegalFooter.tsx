import { LandingFooter } from "@/components/LandingFooter";

/**
 * Pie público estándar para páginas auxiliares envueltas en PublicPageShell.
 * Delega en LandingFooter (incluye BrandLogo, firma por Iwagé, crédito de desarrollo y enlaces legales).
 */
export function LegalFooter({ className = "" }: { className?: string }) {
  return <LandingFooter brandHref="/" className={className} />;
}

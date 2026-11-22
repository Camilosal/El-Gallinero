import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicNavigation } from "@/components/PublicNavigation";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Iniciar sesión en tu granja · IwaGranja",
  description:
    "Ingresa a tu cuenta de IwaGranja para gestionar lotes, postura NTC 1240, alimento, sanidad ICA y finanzas de tu granja mixta.",
  path: "/login",
  noindex: true,
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavigation />
      <div className="flex-1">{children}</div>
    </div>
  );
}

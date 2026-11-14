import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Iniciar sesión en tu granja · El Gallinero",
  description:
    "Ingresa a tu cuenta de El Gallinero para gestionar lotes, postura NTC 1240, alimento, sanidad ICA y finanzas de tu granja mixta.",
  path: "/login",
  noindex: true,
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}

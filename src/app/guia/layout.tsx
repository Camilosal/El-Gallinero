import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GuideShell } from "@/components/guide/GuideShell";

export const metadata: Metadata = {
  title: "Manual de Uso · El Corral",
  description:
    "Guía ilustrada paso a paso con pantallazos reales de cada módulo, escáner QR, modo offline, sanidad, inventarios y finanzas de El Corral.",
};

export default function StandaloneGuiaLayout({ children }: { children: ReactNode }) {
  return (
    <GuideShell basePath="/guia" isStandalone>
      {children}
    </GuideShell>
  );
}

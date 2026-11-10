import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "El Gallinero — Iwagé Granja",
  description:
    "Software abierto que gestiona la parvada real de Iwagé Granja en la vereda Ambalá: identidad individual por ave, trazabilidad financiera automática y modo simple/avanzado para el registro diario.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sistema Gallinero",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-earth-50 text-slate-900 antialiased" style={{ fontFamily: "var(--font-inter, 'Inter'), sans-serif" }} suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

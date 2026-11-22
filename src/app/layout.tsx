import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { APP_DEVELOPER } from "@/lib/branding";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "IwaGranja · Software libre para granjas avícolas",
  description:
    "Gestión de granja sin señal: huevos, alimento, sanidad, trazabilidad QR y finanzas por especie. Código abierto, en producción en Ibagué, Colombia.",
  authors: [{ name: APP_DEVELOPER.name, url: APP_DEVELOPER.url }],
  creator: APP_DEVELOPER.name,
  publisher: APP_DEVELOPER.name,
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    siteName: SITE_NAME,
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IwaGranja",
  },
};

export const viewport: Viewport = {
  themeColor: "#315245",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className="bg-[var(--iw-semantic-bg-page)] text-[var(--iw-semantic-text-primary)] antialiased"
        style={{ fontFamily: "var(--iw-font-body)" }}
        suppressHydrationWarning
      >
        <PwaRegister />
        <AnalyticsTracker />
        {children}
      </body>
    </html>
  );
}

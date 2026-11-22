import type { Metadata } from "next";
import { Suspense } from "react";
import ClientAppLayout from "./_client-layout";

export const metadata: Metadata = {
  title: "Panel operativo · IwaGranja",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8">Cargando...</div>}>
      <ClientAppLayout>{children}</ClientAppLayout>
    </Suspense>
  );
}

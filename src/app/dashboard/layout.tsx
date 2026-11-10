import { Suspense } from "react";
import ClientAppLayout from "./_client-layout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8">Cargando...</div>}>
      <ClientAppLayout>{children}</ClientAppLayout>
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import ContactsDirectory from "@/components/contacts/ContactsDirectory";

function ContactosContent() {
  const searchParams = useSearchParams();
  const actionNuevo = searchParams.get("nuevo");
  const roleParam = searchParams.get("rol");
  const initialRole =
    roleParam === "cliente" || roleParam === "proveedor" || roleParam === "ambos"
      ? roleParam
      : "all";

  return (
    <div>
      <PageHeader
        title="Clientes y Proveedores"
        description="Directorio comercial con contacto directo, localización, plazos de crédito y resumen operativo"
        help={
          "Administra aquí todos los clientes y proveedores de la granja en un solo lugar.\n\n• Registra teléfono, WhatsApp, correo, ciudad, zona, dirección exacta y horarios de entrega o compra.\n• Define método de pago habitual y plazo de crédito (días) para precargar vencimientos al vender.\n• Todos los contactos creados aquí o desde formularios de ventas, egresos, alimento, insumos, adquisiciones o captura rápida quedan sincronizados en todo el sistema."
        }
      />

      <ContactsDirectory initialRole={initialRole} actionNuevo={actionNuevo} />
    </div>
  );
}

export default function ContactosPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-400">Cargando directorio...</div>}>
      <ContactosContent />
    </Suspense>
  );
}


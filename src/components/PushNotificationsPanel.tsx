"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button, Card } from "@/components/ui";

/**
 * C2: banner de activación de avisos push locales.
 * El permiso SOLO se solicita cuando el usuario pulsa el botón (nunca automático).
 * La notificación es genérica (título + conteo); el detalle vive en /inicio.
 */

type PermissionState = "unsupported" | "default" | "granted" | "denied";

export default function PushNotificationsPanel() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  const handleActivate = async () => {
    if (!("Notification" in window)) return;
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
    } finally {
      setRequesting(false);
    }
  };

  if (permission === "unsupported") return null;

  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              permission === "granted" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
            }`}
            aria-hidden="true"
          >
            {permission === "granted" ? <BellRing className="h-4.5 w-4.5" /> : permission === "denied" ? <BellOff className="h-4.5 w-4.5" /> : <Bell className="h-4.5 w-4.5" />}
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Avisos de Gina en este dispositivo</h2>
            <p className="mt-0.5 max-w-xl text-xs text-slate-600">
              {permission === "granted"
                ? "Activados. Cuando Gina tenga novedades verás un aviso genérico (solo el conteo); el detalle se abre en Inicio. Puedes desactivarlos desde los ajustes del navegador."
                : permission === "denied"
                  ? "Bloqueados por el navegador. Si los quieres, habilítalos en los ajustes de notificaciones del sitio."
                  : "Recibe un aviso cuando Gina prepare tu parte diario o detecte una anomalía. Solo se activan si tú lo autorizas; el aviso nunca muestra cifras ni datos de la granja."}
            </p>
          </div>
        </div>
        {permission === "default" && (
          <Button onClick={() => void handleActivate()} disabled={requesting} className="text-sm">
            {requesting ? "Solicitando..." : "Activar avisos"}
          </Button>
        )}
        {permission === "granted" && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Activados</span>
        )}
      </div>
    </Card>
  );
}
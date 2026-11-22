/**
 * Prefijos de rutas privadas de la aplicación operativa (bajo `src/app/(app)/`).
 * Se comparten entre `src/proxy.ts`, `HeroBanner` y `robots.ts` para evitar duplicación.
 */
export const APP_ROUTE_PREFIXES = [
  "/inicio",
  "/almacen",
  "/analisis",
  "/animales",
  "/configuracion",
  "/contactos",
  "/escanear",
  "/exportar",
  "/finanzas",
  "/manual",
  "/inventarios",
  "/operaciones",
  "/planeacion",
  "/produccion",
  "/sanidad",
  "/soberania",
  "/ubicaciones",
] as const;

export function isAppRoutePath(pathname?: string | null): boolean {
  if (!pathname) return false;
  const clean = pathname.split("?")[0];
  return APP_ROUTE_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`),
  );
}

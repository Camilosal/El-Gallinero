import { isIP } from "node:net";

const productionHosts = new Set(["iwage.co", "reservas.iwage.co", "app.iwage.co", "gallinero.iwage.co"]);

function outsideProductionOrigin(name) {
  const value = process.env[name];
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} debe ser un origen HTTPS de pruebas`);
  }
  if (
    url.protocol !== "https:" || url.username || url.password || value !== url.origin ||
    productionHosts.has(url.hostname.replace(/\.$/, "")) || !url.hostname.includes(".") || isIP(url.hostname)
  ) {
    throw new Error(`${name} debe ser un origen HTTPS de pruebas`);
  }
  return url.origin;
}

const reservasOrigin = outsideProductionOrigin("APP_URL");
const iwagranjaOrigin = outsideProductionOrigin("IWAGRANJA_RETURN_ORIGINS");
if (reservasOrigin === iwagranjaOrigin) throw new Error("Reservas e IwaGranja requieren orígenes distintos en Sandbox");
if (process.env.IWAGRANJA_PAYMENT_RESULT_URL !== `${iwagranjaOrigin}/api/billing/reservas`) {
  throw new Error("El receptor de resultados debe pertenecer a IwaGranja de pruebas");
}

for (const [name, prefix] of [
  ["WOMPI_PUBLIC_KEY", "pub_test_"],
  ["WOMPI_PRIVATE_KEY", "prv_test_"],
  ["WOMPI_INTEGRITY_SECRET", "test_integrity_"],
  ["WOMPI_EVENTS_SECRET", "test_events_"],
]) {
  if (!process.env[name]?.startsWith(prefix) || process.env[name].length === prefix.length) {
    throw new Error(`${name} debe pertenecer a Wompi Sandbox`);
  }
}

const secretNames = ["IWAGRANJA_PAYMENT_API_SECRET", "IWAGRANJA_PAYMENT_RESULT_SECRET", "IWAGRANJA_PAYMENT_OUTBOX_SECRET"];
const secrets = secretNames.map((name) => {
  const secret = process.env[name]?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error(`${name} requiere un secreto de prueba de al menos 32 bytes`);
  return secret;
});
if (new Set(secrets).size !== secrets.length) throw new Error("Los secretos de prueba deben ser distintos entre sí");

console.info("[pagos Sandbox] Orígenes, credenciales Sandbox y secretos de servicio verificados");

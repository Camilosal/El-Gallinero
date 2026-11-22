import { createHmac } from "node:crypto";

export function signReservationsServiceRequest(rawBody: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function isSafeReservationsCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.wompi.co" && !url.username && !url.password;
  } catch {
    return false;
  }
}

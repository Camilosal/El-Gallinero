import { createHmac } from "node:crypto";

export function getWompiEnvironment(
  env: Record<string, string | undefined> = process.env,
): { app: "sandbox" | "production"; event: "test" | "prod" } | null {
  const configured = env.WOMPI_ENVIRONMENT?.trim().toLowerCase();
  const sandbox = env.NODE_ENV !== "production" || env.BILLING_SANDBOX_STAGING === "true";
  if (sandbox) return configured === "sandbox" ? { app: "sandbox", event: "test" } : null;
  return configured === "production" ? { app: "production", event: "prod" } : null;
}

export function signReservationsServiceRequest(rawBody: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function isSafeReservationsCheckoutUrl(value: unknown, requireSandboxKey = false): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "checkout.wompi.co" || url.username || url.password) return false;
    if (!requireSandboxKey) return true;
    const keys = url.searchParams.getAll("public-key");
    return keys.length === 1 && /^pub_test_[a-z0-9_-]+$/i.test(keys[0]);
  } catch {
    return false;
  }
}

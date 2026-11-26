import { describe, expect, it } from "vitest";
import { getWompiEnvironment, isSafeReservationsCheckoutUrl, signReservationsServiceRequest } from "@/lib/reservas-payments";

describe("checkout centralizado en Reservas", () => {
  it("habilita Sandbox en un build de producción solo con la configuración de staging", () => {
    expect(getWompiEnvironment({ NODE_ENV: "production", WOMPI_ENVIRONMENT: "sandbox" })).toBeNull();
    expect(getWompiEnvironment({
      NODE_ENV: "production", WOMPI_ENVIRONMENT: "sandbox", BILLING_SANDBOX_STAGING: "true",
    })).toEqual({ app: "sandbox", event: "test" });
    expect(getWompiEnvironment({
      NODE_ENV: "production", WOMPI_ENVIRONMENT: "production", BILLING_SANDBOX_STAGING: "true",
    })).toBeNull();
    expect(getWompiEnvironment({ NODE_ENV: "production", WOMPI_ENVIRONMENT: "production" }))
      .toEqual({ app: "production", event: "prod" });
  });

  it("en staging solo acepta un checkout con una llave pública Sandbox", () => {
    const checkout = "https://checkout.wompi.co/p/?public-key=";
    expect(isSafeReservationsCheckoutUrl(checkout + "pub_test_synthetic", true)).toBe(true);
    expect(isSafeReservationsCheckoutUrl(checkout + "pub_prod_synthetic", true)).toBe(false);
    expect(isSafeReservationsCheckoutUrl(checkout + "pub_test_synthetic&public-key=pub_prod_synthetic", true)).toBe(false);
    expect(isSafeReservationsCheckoutUrl("https://checkout.wompi.co/p/", true)).toBe(false);
  });

  it("firma el cuerpo exacto junto al timestamp", () => {
    const body = JSON.stringify({ reference: "IWG-123" });
    const signature = signReservationsServiceRequest(body, "1731500123", "shared-test-secret");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(signReservationsServiceRequest(body + " ", "1731500123", "shared-test-secret")).not.toBe(signature);
    expect(signReservationsServiceRequest(body, "1731500124", "shared-test-secret")).not.toBe(signature);
  });

  it("solo acepta el checkout seguro oficial de Wompi", () => {
    expect(isSafeReservationsCheckoutUrl("https://checkout.wompi.co/p/?reference=IWG-123")).toBe(true);
    expect(isSafeReservationsCheckoutUrl("http://checkout.wompi.co/p/")).toBe(false);
    expect(isSafeReservationsCheckoutUrl("https://evil.example/checkout")).toBe(false);
    expect(isSafeReservationsCheckoutUrl("https://user:pass@checkout.wompi.co/p/")).toBe(false);
    expect(isSafeReservationsCheckoutUrl(null)).toBe(false);
  });
});

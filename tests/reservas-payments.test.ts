import { describe, expect, it } from "vitest";
import { isSafeReservationsCheckoutUrl, signReservationsServiceRequest } from "@/lib/reservas-payments";

describe("checkout centralizado en Reservas", () => {
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

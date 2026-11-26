import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("protección de rutas de facturación en Proxy", () => {
  it("deja llegar al cron de vencimientos a su validador de credenciales", async () => {
    const response = await proxy(new NextRequest("https://gallinero.test/api/cron/suscripciones-vencidas", {
      method: "POST",
      headers: { authorization: "Bearer example" },
    }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("conserva solo la referencia al volver del pago sin sesión", async () => {
    const reference = "IWG-4bebf227-6e00-4f0f-8f31-3ba4196f7290";
    const response = await proxy(new NextRequest(
      `https://gallinero.test/configuracion/plan?payment=return&reference=${reference}&transactionId=external&next=https://example.test`,
      { headers: { accept: "text/html" } },
    ));
    const login = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(login.origin).toBe("https://gallinero.test");
    expect(login.pathname).toBe("/login");
    expect([...login.searchParams]).toEqual([["next", `/configuracion/plan?payment=return&reference=${reference}`]]);
  });

  it("descarta una referencia ajena al formato del checkout", async () => {
    const response = await proxy(new NextRequest(
      "https://gallinero.test/configuracion/plan?payment=return&reference=%2F%2Fexample.test",
      { headers: { accept: "text/html" } },
    ));
    expect(response.headers.get("location")).toBe("https://gallinero.test/login");
  });

  it("deja llegar el callback de Reservas al validador HMAC de la ruta", async () => {
    const response = await proxy(new NextRequest("https://gallinero.test/api/billing/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
    }));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("mantiene protegidas las rutas vecinas que no tienen autenticación propia", async () => {
    const response = await proxy(new NextRequest("https://gallinero.test/api/billing/reservas/extra", {
      method: "GET",
      headers: { accept: "application/json" },
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "No autenticado" });
  });
});

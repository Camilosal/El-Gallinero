import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("public access routes", () => {
  it("allows the password recovery page without a session", async () => {
    const request = new NextRequest("https://gallinero.test/login/recuperar", {
      headers: { accept: "text/html" },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows the standalone manual routes without a session", async () => {
    const indexReq = new NextRequest("https://gallinero.test/guia", {
      headers: { accept: "text/html" },
    });
    const articleReq = new NextRequest("https://gallinero.test/guia/escanear-qr", {
      headers: { accept: "text/html" },
    });

    const indexRes = await proxy(indexReq);
    const articleRes = await proxy(articleReq);

    expect(indexRes.headers.get("x-middleware-next")).toBe("1");
    expect(articleRes.headers.get("x-middleware-next")).toBe("1");
  });

  it("still redirects other protected pages without a session", async () => {
    const request = new NextRequest("https://gallinero.test/dashboard/animales", {
      headers: { accept: "text/html" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://gallinero.test/login");
  });
});

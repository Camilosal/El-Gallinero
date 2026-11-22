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
    for (const protectedPath of ["/animales", "/dashboard/animales"]) {
      const request = new NextRequest(`https://gallinero.test${protectedPath}`, {
        headers: { accept: "text/html" },
      });

      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://gallinero.test/login");
    }
  });

  it("permanently redirects authenticated legacy /dashboard routes to direct app routes", async () => {
    const rootLegacy = new NextRequest("https://gallinero.test/dashboard", {
      headers: { accept: "text/html", cookie: "galli_session=token-demo" },
    });
    const rootRes = await proxy(rootLegacy);
    expect(rootRes.status).toBe(308);
    expect(rootRes.headers.get("location")).toBe("https://gallinero.test/inicio");

    const nestedLegacy = new NextRequest("https://gallinero.test/dashboard/animales?tab=pollos", {
      headers: { accept: "text/html", cookie: "galli_session=token-demo" },
    });
    const nestedRes = await proxy(nestedLegacy);
    expect(nestedRes.status).toBe(308);
    expect(nestedRes.headers.get("location")).toBe("https://gallinero.test/animales?tab=pollos");
  });

  it("blocks protected API routes with 401 without a session", async () => {
    const request = new NextRequest("https://gallinero.test/api/dashboard");

    const response = await proxy(request);

    expect(response.status).toBe(401);
  });

  it("lets the scheduled external sync reach its own Bearer secret check", async () => {
    const request = new NextRequest("https://gallinero.test/api/cron/fuentes-externas", {
      method: "POST",
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows unknown root paths through to render Next.js 404 instead of 401 or /login redirect", async () => {
    const htmlReq = new NextRequest("https://gallinero.test/pagina-inexistente-404", {
      headers: { accept: "text/html" },
    });
    const botReq = new NextRequest("https://gallinero.test/pagina-inexistente-404");

    const htmlRes = await proxy(htmlReq);
    const botRes = await proxy(botReq);

    expect(htmlRes.headers.get("x-middleware-next")).toBe("1");
    expect(botRes.headers.get("x-middleware-next")).toBe("1");
  });
});

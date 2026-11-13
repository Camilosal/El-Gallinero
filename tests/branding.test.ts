import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_BRAND, APP_DEVELOPER } from "@/lib/branding";

describe("marca y atribución de desarrollo en producción", () => {
  it("expone constantes exactas de autoría y contacto", () => {
    expect(APP_BRAND.name).toBe("El Gallinero");
    expect(APP_DEVELOPER.name).toBe("Camilo Saldarriaga");
    expect(APP_DEVELOPER.url).toBe("https://camilosaldarriaga.com");
    expect(APP_DEVELOPER.domain).toBe("camilosaldarriaga.com");
    expect("email" in APP_DEVELOPER).toBe(false);
  });

  it("integra autoría web en metadata, package.json y superficies públicas/internas sin correo visible", () => {
    const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

    const pkg = JSON.parse(read("package.json"));
    expect(pkg.author?.name).toBe("Camilo Saldarriaga");
    expect(pkg.author?.email).toBeUndefined();
    expect(pkg.author?.url).toBe("https://camilosaldarriaga.com");

    expect(read("src/components/DeveloperCredit.tsx")).not.toContain("mailto:");
    expect(read("src/app/page.tsx")).not.toContain("mailto:");

    expect(read("src/app/layout.tsx")).toContain("APP_DEVELOPER");
    expect(read("src/app/page.tsx")).toContain("APP_DEVELOPER");
    expect(read("src/app/login/page.tsx")).toContain("DeveloperCredit");
    expect(read("src/app/login/recuperar/page.tsx")).toContain("DeveloperCredit");
    expect(read("src/components/Sidebar.tsx")).toContain("DeveloperCredit");
    expect(read("src/app/dashboard/_client-layout.tsx")).toContain("DeveloperCredit");
    expect(read("src/app/dashboard/configuracion/page.tsx")).toContain("DeveloperCredit");
    expect(read("src/app/lote/[id]/page.tsx")).toContain("DeveloperCredit");
    expect(read("src/components/guide/GuideShell.tsx")).toContain("DeveloperCredit");
  });
});

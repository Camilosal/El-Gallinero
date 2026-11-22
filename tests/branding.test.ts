import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_BRAND, APP_DEVELOPER } from "@/lib/branding";

describe("marca y atribución de desarrollo en producción", () => {
  it("expone constantes exactas de autoría y contacto", () => {
    expect(APP_BRAND.name).toBe("IwaGranja");
    expect(APP_BRAND.horizontalLogoSrc).toBe("/logo-iwagranja-horizontal.webp");
    expect(APP_BRAND.squareLogoSrc).toBe("/logo-iwagranja.webp");
    expect(APP_BRAND.markSrc).toBe("/logo-iwagranja-mark.webp");
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
    expect(read("src/app/(app)/_client-layout.tsx")).toContain("DeveloperCredit");
    expect(read("src/app/(app)/configuracion/page.tsx")).toContain("DeveloperCredit");
    expect(read("src/app/lote/[id]/page.tsx")).toContain("DeveloperCredit");
    expect(read("src/components/guide/GuideShell.tsx")).toContain("DeveloperCredit");
  });

  it("sirve el logotipo ligero en WebP (horizontal con eslogan y cuadrado) y lo integra en landing y toda la aplicación", () => {
    const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    const sizeOf = (rel: string) => fs.statSync(path.join(process.cwd(), rel)).size;

    expect(sizeOf("public/logo-iwagranja-horizontal.webp")).toBeLessThan(80_000);
    expect(sizeOf("public/logo-iwagranja.webp")).toBeLessThan(80_000);
    expect(sizeOf("public/logo-iwagranja-mark.webp")).toBeLessThan(40_000);
    expect(sizeOf("public/icon-192.png")).toBeLessThan(40_000);

    // Cabeceras web/app usan horizontal; el hero público usa el emblema y pie/sidebar usan cuadrado.
    expect(read("src/components/PublicNavigation.tsx")).toContain('variant="horizontal"');
    expect(read("src/components/guide/GuideShell.tsx")).toContain('variant="horizontal"');
    expect(read("src/components/Sidebar.tsx")).toContain('variant="horizontal"');
    expect(read("src/app/page.tsx")).toContain('variant="mark"');
    expect(read("src/components/LandingFooter.tsx")).toContain('variant="square"');
    expect(read("src/app/login/page.tsx")).toContain('variant="square"');
    expect(read("src/app/registro/page.tsx")).toContain('variant="square"');

    const inicioSrc = read("src/app/(app)/inicio/page.tsx");
    expect(inicioSrc).toContain("FarmID:");
    expect(inicioSrc).toContain("Copiar FarmID");

    for (const surface of [
      "src/app/page.tsx",
      "src/components/LandingFooter.tsx",
      "src/components/MobileNav.tsx",
      "src/components/PublicNavigation.tsx",
      "src/components/LegalFooter.tsx",
      "src/components/Sidebar.tsx",
      "src/components/DeveloperCredit.tsx",
      "src/components/guide/GuideShell.tsx",
      "src/app/login/page.tsx",
      "src/app/login/recuperar/page.tsx",
      "src/app/registro/page.tsx",
      "src/app/lote/[id]/page.tsx",
    ]) {
      expect(read(surface)).toContain("BrandLogo");
    }
  });
});

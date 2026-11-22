import Image from "next/image";
import { APP_BRAND } from "@/lib/branding";

interface BrandLogoProps {
  /**
   * - `horizontal`: versión ancha con nombre + eslogan ("IwaGranja · Tu granja, todo bajo control.") para cabeceras web y app.
   * - `square`: versión cuadrada sin eslogan ("IwaGranja") para tarjetas, acceso, pies de página y demás vistas.
   * - `mark`: emblema compacto sin texto (sol, cerca y brote) para íconos reducidos o sidebar colapsado.
   */
  variant?: "horizontal" | "square" | "mark" | "full";
  size?: number;
  height?: number;
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}

export function BrandLogo({
  variant = "square",
  size = 40,
  height,
  decorative = false,
  priority = false,
  className = "",
}: BrandLogoProps) {
  if (variant === "horizontal") {
    const targetHeight = height ?? size;
    return (
      <Image
        src={APP_BRAND.horizontalLogoSrc}
        alt={decorative ? "" : `${APP_BRAND.name} — ${APP_BRAND.slogan}`}
        aria-hidden={decorative ? true : undefined}
        width={680}
        height={201}
        priority={priority}
        unoptimized
        style={{ height: targetHeight, width: "auto" }}
        className={`object-contain shrink-0 select-none ${className}`.trim()}
      />
    );
  }

  const src = variant === "mark" ? APP_BRAND.markSrc : APP_BRAND.squareLogoSrc;
  const resolvedSize = height ?? size;

  return (
    <Image
      src={src}
      alt={decorative ? "" : `Logo de ${APP_BRAND.name}`}
      aria-hidden={decorative ? true : undefined}
      width={resolvedSize}
      height={resolvedSize}
      priority={priority}
      unoptimized
      style={{ width: resolvedSize, height: resolvedSize }}
      className={`object-contain shrink-0 select-none ${className}`.trim()}
    />
  );
}

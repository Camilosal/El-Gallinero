import Image from "next/image";
import { APP_BRAND } from "@/lib/branding";

interface BrandLogoProps {
  /** `full` incluye el isotipo del corral con animales + texto "El Corral"; `mark` muestra solo el emblema cuadrado ideal para íconos y barras compactas. */
  variant?: "full" | "mark";
  size?: number;
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}

export function BrandLogo({
  variant = "mark",
  size = 36,
  decorative = false,
  priority = false,
  className = "",
}: BrandLogoProps) {
  const src = variant === "full" ? APP_BRAND.logoSrc : APP_BRAND.markSrc;

  return (
    <Image
      src={src}
      alt={decorative ? "" : `Logo de ${APP_BRAND.name}`}
      aria-hidden={decorative ? true : undefined}
      width={size}
      height={size}
      priority={priority}
      unoptimized
      style={{ width: size, height: size }}
      className={`bg-[#fcf6e7] object-contain shrink-0 select-none ${className}`.trim()}
    />
  );
}

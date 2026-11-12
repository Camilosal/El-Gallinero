"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, X, ZoomIn } from "lucide-react";

export interface LightboxImage {
  src: string;
  alt: string;
  title: string;
  caption: string;
  badge?: string;
  targetHref?: string;
  targetLabel?: string;
}

interface GuideScreenshotLightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
}

/**
 * Visor ampliado de pantallazos basado en `<dialog>` nativo (`showModal` + `closedby="any"`).
 * Respeta el top-layer, el foco y el cierre por Esc/backdrop sin lógica manual de trampa de foco.
 */
export function GuideScreenshotLightbox({ image, onClose }: GuideScreenshotLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerDownTargetRef = useRef<EventTarget | null>(null);
  const titleId = useId();
  const captionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (image && !dialog.open) {
      dialog.showModal();
    } else if (!image && dialog.open) {
      dialog.close();
    }
  }, [image]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDialogElement>) => {
    pointerDownTargetRef.current = event.target;
  };

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (
      !("closedBy" in HTMLDialogElement.prototype) &&
      event.target === dialog &&
      pointerDownTargetRef.current === dialog
    ) {
      dialog.close();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      // Atributo moderno para cerrar con Esc y clic fuera sin script extra en navegadores compatibles.
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby={titleId}
      aria-describedby={captionId}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className="m-auto w-[min(94dvw,1120px)] max-h-[92dvh] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-xs open:flex open:flex-col"
    >
      {image && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/90 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              {image.badge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800">
                  <ZoomIn className="h-3 w-3" aria-hidden="true" />
                  {image.badge}
                </span>
              )}
              <h2 id={titleId} className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                {image.title}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {image.targetHref && (
                <Link
                  href={image.targetHref}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 transition-colors hover:bg-green-100"
                >
                  <span>{image.targetLabel || "Abrir pantalla"}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Cerrar imagen ampliada"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <figure className="guide-scroll-pane flex flex-1 flex-col overflow-y-auto bg-slate-950/5 p-3 sm:p-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                className="block h-auto w-full object-contain"
              />
            </div>
            <figcaption id={captionId} className="mt-3 text-xs leading-relaxed text-slate-600 sm:text-sm">
              {image.caption}
            </figcaption>
          </figure>
        </>
      )}
    </dialog>
  );
}


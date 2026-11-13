"use client";

export type QuickCaptureMode = "huevos" | "alimentacion" | "mortalidad" | "gasto" | "venta";

export type QuickCaptureSaleType = "huevos" | "carne" | "animales" | "gallinaza" | "otros";

export interface QuickCaptureDetail {
  mode: QuickCaptureMode;
  saleType?: QuickCaptureSaleType;
  locationId?: string;
  batchId?: string;
  henId?: string;
  roosterId?: string;
  species?: string;
  suggestedEggs?: number;
  suggestedFeedQty?: number;
  suggestedFeedId?: string;
}

export const OPEN_QUICK_CAPTURE_EVENT = "gallinero-open-quick-capture";
export const QUICK_CAPTURE_SAVED_EVENT = "gallinero-quick-capture-saved";

export function openQuickCapture(detail: QuickCaptureDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QuickCaptureDetail>(OPEN_QUICK_CAPTURE_EVENT, { detail }));
}

export const OPEN_ONBOARDING_WIZARD_EVENT = "gallinero-open-onboarding-wizard";

export function openOnboardingWizard(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_ONBOARDING_WIZARD_EVENT));
}

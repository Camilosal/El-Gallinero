"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";
import { QUICK_CAPTURE_SAVED_EVENT } from "@/lib/quick-capture-events";
import {
  ONBOARDING_UPDATED_EVENT,
  type FeatureFlagKey,
  type ProducerScale,
  type ProgressiveUnlockableFlagKey,
} from "@/lib/onboarding";
import type { OnboardingStatePayload } from "@/lib/onboarding-server";

let cachedState: OnboardingStatePayload | null = null;
let inflightPromise: Promise<OnboardingStatePayload | null> | null = null;

async function fetchOnboardingShared(): Promise<OnboardingStatePayload | null> {
  if (inflightPromise) return inflightPromise;
  inflightPromise = apiFetch("/api/onboarding")
    .then(async (res) => {
      if (!res.ok) return cachedState;
      const json = (await res.json()) as OnboardingStatePayload;
      cachedState = json;
      return json;
    })
    .catch(() => cachedState)
    .finally(() => {
      inflightPromise = null;
    });
  return inflightPromise;
}

export function broadcastOnboardingState(next: OnboardingStatePayload | null) {
  cachedState = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ONBOARDING_UPDATED_EVENT, { detail: next }));
  }
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingStatePayload | null>(cachedState);
  const [loading, setLoading] = useState(!cachedState);

  const refresh = useCallback(async () => {
    inflightPromise = null;
    const next = await fetchOnboardingShared();
    if (next) broadcastOnboardingState(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void fetchOnboardingShared().then((res) => {
      if (!active) return;
      if (res) setState(res);
      setLoading(false);
    });

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingStatePayload | null>).detail;
      if (detail) {
        setState(detail);
        setLoading(false);
      } else {
        void refresh();
      }
    };

    const onQuickSaved = () => {
      void refresh();
    };

    window.addEventListener(ONBOARDING_UPDATED_EVENT, onUpdated);
    window.addEventListener(QUICK_CAPTURE_SAVED_EVENT, onQuickSaved);
    return () => {
      active = false;
      window.removeEventListener(ONBOARDING_UPDATED_EVENT, onUpdated);
      window.removeEventListener(QUICK_CAPTURE_SAVED_EVENT, onQuickSaved);
    };
  }, [refresh]);

  const patchOnboarding = useCallback(
    async (patch: {
      scale?: ProducerScale;
      toggleFlag?: { key: ProgressiveUnlockableFlagKey; enabled: boolean; reason?: string };
      solicitaReporteFormal?: boolean;
      onboardingCompleted?: boolean;
      wizardDismissed?: boolean;
      selectedSpecies?: string[];
    }) => {
      const res = await apiFetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo actualizar la configuración progresiva");
      }
      const next = (await res.json()) as OnboardingStatePayload;
      broadcastOnboardingState(next);
      setState(next);
      return next;
    },
    [],
  );

  const isFlagEnabled = useCallback(
    (key: FeatureFlagKey): boolean => {
      if (!state) return true;
      return state.flags[key] !== false;
    },
    [state],
  );

  return {
    state,
    config: state?.config ?? null,
    flags: state?.flags ?? null,
    metrics: state?.metrics ?? null,
    evaluation: state?.evaluation ?? null,
    history: state?.history ?? [],
    loading,
    refresh,
    patchOnboarding,
    isFlagEnabled,
  };
}


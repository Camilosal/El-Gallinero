"use client";

export const OPEN_ASSISTANT_PROMPT_EVENT = "gallinero-open-assistant-prompt";

export interface AssistantNormativeContext {
  id: string;
  code: string;
  kindLabel: string;
  authority: string;
  title: string;
  version: string;
  summary: string;
  keyReferences: string[];
  complianceChecklist: string[];
  sourceUrl: string;
  sourceLabel: string;
  appRoute?: string;
  appRouteLabel?: string;
}

export interface OpenAssistantPromptDetail {
  prompt: string;
  referenceContext?: AssistantNormativeContext;
}

export function askGinaWithContext(detail: OpenAssistantPromptDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenAssistantPromptDetail>(OPEN_ASSISTANT_PROMPT_EVENT, { detail }),
  );
}

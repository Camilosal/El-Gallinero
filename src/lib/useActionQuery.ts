"use client";

import { useEffect, useRef } from "react";

/** Ejecuta una acción `?nuevo=` una vez por cada valor recibido. */
export function useActionQuery(action: string | null, handlers: Record<string, () => void | Promise<void>>) {
  const handlersRef = useRef(handlers);
  const lastActionRef = useRef<string | null>(null);

  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  useEffect(() => {
    if (!action) {
      lastActionRef.current = null;
      return;
    }
    if (lastActionRef.current === action) return;
    const handler = handlersRef.current[action];
    if (!handler) return;
    lastActionRef.current = action;
    queueMicrotask(() => {
      if (lastActionRef.current !== action) return;
      const removeConsumedAction = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete("nuevo");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      };
      void Promise.resolve().then(() => handlersRef.current[action]?.()).then(removeConsumedAction, removeConsumedAction);
    });
  }, [action]);
}

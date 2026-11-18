"use client";

import { useEffect, useState } from "react";
import { normalizeRole, type AppRole } from "@/lib/rbac";

const ROLE_STORAGE_KEY = "galli-user-role";

/** Keeps role-aware navigation usable offline using the last authenticated role. */
export function useAppRole(): AppRole {
  const [role, setRole] = useState<AppRole>(() => {
    if (typeof window === "undefined") return "operario";
    try {
      return normalizeRole(window.localStorage.getItem(ROLE_STORAGE_KEY));
    } catch {
      return "operario";
    }
  });

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((user: { role?: string } | null) => {
        if (!active || !user?.role) return;
        const nextRole = normalizeRole(user.role);
        setRole(nextRole);
        try {
          window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
        } catch {
          // Role-aware navigation still works for the current session.
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return role;
}

export function clearCachedAppRole(): void {
  try {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    // Ignore storage errors during logout.
  }
}

export async function apiFetch(url: string, options?: RequestInit, cookies?: string) {
  const headers = new Headers(options?.headers);

  // If cookies are provided (server-side), add them to the request
  if (cookies) {
    headers.set("Cookie", cookies);
  }

  const res = await fetch(url, {
    cache: "no-store",
    credentials: cookies ? "omit" : "include", // Use omit when manually providing cookies
    headers,
    ...options,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Sesión expirada");
  }
  return res;
}

// Server-side version that accepts cookies from the request
export async function apiFetchServer(url: string, cookieHeader: string | null, options?: RequestInit) {
  return apiFetch(url, options, cookieHeader || undefined);
}
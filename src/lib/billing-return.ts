/** Keep only the opaque reference needed to resume a payment lookup after login. */
export function getPaymentReturnLoginUrl(current: URL): URL | null {
  if (current.pathname !== "/configuracion/plan" || current.searchParams.get("payment") !== "return") {
    return null;
  }

  const reference = current.searchParams.get("reference") ?? "";
  if (!/^IWG-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(reference)) return null;

  const next = new URLSearchParams({ payment: "return", reference });
  const login = new URL("/login", current.origin);
  login.searchParams.set("next", `/configuracion/plan?${next}`);
  return login;
}

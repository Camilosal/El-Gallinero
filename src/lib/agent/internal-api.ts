/**
 * Cliente HTTP interno del agente.
 *
 * Reutiliza los endpoints reales de la aplicación para respetar validaciones y
 * reglas de negocio. Reenvía la cookie de sesión del usuario para que las rutas
 * protegidas por `withApiHandler` funcionen igual que una petición del navegador.
 */

export class InternalApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "InternalApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class InternalApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly cookie: string | null,
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(options.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    if (options.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new InternalApiError(
        `No se pudo consultar el servicio interno (${path})`,
        503,
        error instanceof Error ? error.message : null,
      );
    }

    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      const message =
        (payload && typeof payload === "object" && (payload.error || payload.message)) ||
        `La operación falló con estado ${response.status}`;
      throw new InternalApiError(String(message), response.status, payload);
    }

    return payload as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }
}

/** Construye la URL base para llamadas internas. */
export function resolveInternalBaseUrl(requestOrigin?: string): string {
  const configured = process.env.ASSISTANT_INTERNAL_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (requestOrigin) return requestOrigin.replace(/\/+$/, "");
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

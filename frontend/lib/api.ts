const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE?.trim();
if (process.env.NODE_ENV === "production" && !configuredApiBase) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE must be explicitly configured for production.",
  );
}
export const API_BASE = (
  configuredApiBase || "http://localhost:4000/api"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(
    message: string,
    status: number,
    code = message,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function requestApi<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      // Plain GETs need no JSON content type (or cross-origin preflight).
      headers: { ...(init.body != null ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      `API_UNAVAILABLE: Express API is not reachable at ${API_BASE}`,
      0,
      "API_UNAVAILABLE",
    );
  }
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    const isSecurityPage = /YOU DO['’]NOT EXPLOITE THIS WEBSITE|Security warning\.? This request was not accepted/i.test(text);
    body = { error: isSecurityPage ? "SECURITY_REQUEST_DENIED" : `HTTP_${response.status}` };
  }
  if (!response.ok)
    throw new ApiError(
      body?.error || `HTTP_${response.status}`,
      response.status,
      body?.error || `HTTP_${response.status}`,
      body?.issues || body?.details,
    );
  return body as T;
}

// Share only simultaneous public reads. Each mounted consumer still gets the
// result; session, cart and admin data are never cached or shared here.
const publicReads = new Map<string, Promise<unknown>>();
export function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const shareable = Object.keys(init).length === 0 &&
    (/^\/(?:products|categories|settings)$/.test(path) || /^\/pages\/[^/?]+$/.test(path));
  if (!shareable) return requestApi<T>(path, init);
  const pending = publicReads.get(path);
  if (pending) return pending as Promise<T>;
  const request = requestApi<T>(path, init).finally(() => {
    if (publicReads.get(path) === request) publicReads.delete(path);
  });
  publicReads.set(path, request);
  return request;
}

import type { ClientConfig } from "@florin/client-config";
import { getBackendUrl } from "./backendUrl";

export type ApiClient = {
  get: <TRes>(path: string) => Promise<TRes>;
  post: <TBody extends object, TRes>(path: string, body: TBody) => Promise<TRes>;
};

export type ApplicationServices = {
  backendUrl: string;
  config: Readonly<ClientConfig>;
  api: ApiClient;
};

/** Server-signing routes; the backend requires a bearer token on these. */
const ADMIN_PATH_PREFIX = "/v1/admin";

/**
 * Bearer token for `/v1/admin/*`.
 *
 * Bundled into the client, so it is only as private as access to this console. Treat it as a
 * deployment credential: serve the admin console on a restricted origin, and never reuse the
 * token anywhere else.
 */
function adminAuthHeaders(path: string): Record<string, string> {
  if (!path.startsWith(ADMIN_PATH_PREFIX)) return {};
  const token = process.env.NEXT_PUBLIC_ADMIN_API_TOKEN;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function createApiClient(backendUrl: string): ApiClient {
  async function get<TRes>(path: string): Promise<TRes> {
    const res = await fetch(`${backendUrl}${path}`, {
      headers: adminAuthHeaders(path),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return (await res.json()) as TRes;
  }

  async function post<TBody extends object, TRes>(path: string, body: TBody): Promise<TRes> {
    const res = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders(path) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return (await res.json()) as TRes;
  }

  return { get, post };
}

export function createApplicationServices(config: Readonly<ClientConfig>): ApplicationServices {
  const backendUrl = getBackendUrl();
  return {
    backendUrl,
    config,
    api: createApiClient(backendUrl),
  };
}

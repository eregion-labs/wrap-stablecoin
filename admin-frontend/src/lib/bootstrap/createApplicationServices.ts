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

function createApiClient(backendUrl: string): ApiClient {
  async function get<TRes>(path: string): Promise<TRes> {
    const res = await fetch(`${backendUrl}${path}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return (await res.json()) as TRes;
  }

  async function post<TBody extends object, TRes>(path: string, body: TBody): Promise<TRes> {
    const res = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

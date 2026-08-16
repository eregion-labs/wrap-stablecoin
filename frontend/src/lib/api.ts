import { getApplicationServices } from "@/providers/ClientConfigProvider";

/** REST helpers — base URL from bootstrap; no x-solana-network header. */
export async function apiGet<TRes>(path: string): Promise<TRes> {
  return getApplicationServices().api.get<TRes>(path);
}

export async function apiPost<TBody extends object, TRes>(
  path: string,
  body: TBody,
): Promise<TRes> {
  return getApplicationServices().api.post<TBody, TRes>(path, body);
}

/**
 * Sole module allowed to read deployment process.env for product config.
 * Normalize trailing slash once here.
 */
export function getBackendUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL is required (backend origin, no trailing slash required)",
    );
  }

  return raw.replace(/\/$/, "");
}

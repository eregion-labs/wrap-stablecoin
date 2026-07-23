/**
 * Sole module allowed to read deployment process.env for product config.
 * Normalize trailing slash once here.
 */
export function getBackendUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    // One-release legacy alias — remove after migration.
    process.env.NEXT_PUBLIC_API_BASE?.trim();

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL is required (backend origin, no trailing slash required)",
    );
  }

  if (
    process.env.NEXT_PUBLIC_API_BASE &&
    !process.env.NEXT_PUBLIC_BACKEND_URL &&
    typeof console !== "undefined"
  ) {
    console.warn(
      "[bootstrap] NEXT_PUBLIC_API_BASE is deprecated; use NEXT_PUBLIC_BACKEND_URL",
    );
  }

  return raw.replace(/\/$/, "");
}

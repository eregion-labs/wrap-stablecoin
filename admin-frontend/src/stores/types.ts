export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionErr<T = void>(error: string): ActionResult<T> {
  return { ok: false, error };
}

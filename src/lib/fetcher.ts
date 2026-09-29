/** Tiny typed fetch helpers for client components. Surfaces our ApiError message. */

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) message = body.error.message;
  } catch {
    // non-JSON error body
  }
  throw new Error(message);
}

export async function getJson<T>(url: string): Promise<T> {
  return handle<T>(await fetch(url, { cache: "no-store" }));
}

export async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  return handle<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function del(url: string): Promise<void> {
  return handle<void>(await fetch(url, { method: "DELETE" }));
}

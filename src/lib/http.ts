import "server-only";
import { z } from "zod";
import type { ApiError } from "@/contracts";

type ErrorCode = ApiError["error"]["code"];

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  budget_exceeded: 429,
  upstream_timeout: 504,
  guardrail_blocked: 422,
  internal: 500,
};

/** Thrown anywhere in a route; `withApi` turns it into the uniform error body. */
export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonError(code: ErrorCode, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status: STATUS[code] });
}

/** Parse + validate a JSON body (golden rule 3). Throws HttpError(bad_request). */
export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError("bad_request", "Body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError("bad_request", z.prettifyError(parsed.error));
  return parsed.data;
}

/** Wrap a route handler: HttpError → typed response; anything else → 500 without leaking details. */
export function withApi<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.code, err.message);
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        return jsonError("upstream_timeout", "The twin took too long to answer. Try again.");
      }
      console.error("[api] unhandled error", err);
      return jsonError("internal", "Something went wrong.");
    }
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

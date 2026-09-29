/** Formatting helpers shared by server and client components (no "use client" here). */

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})/g;

/**
 * Replace ISO timestamps with readable local dates, so people approve what they understand.
 * On the server this uses the server's zone; the approval card itself formats client-side.
 */
export const localizeSummary = (s: string) =>
  s.replace(ISO, (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));

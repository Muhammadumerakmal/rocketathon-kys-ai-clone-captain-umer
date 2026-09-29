import type { TwinStreamEvent } from "@/contracts";

/**
 * Incremental SSE parser: feed it chunks, get complete events back.
 * Frames are `data: <json>\n\n`; a chunk may end mid-frame, so we keep a buffer.
 */
export function createSseParser() {
  let buffer = "";
  return (chunk: string): TwinStreamEvent[] => {
    buffer += chunk;
    const events: TwinStreamEvent[] = [];
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        events.push(JSON.parse(data) as TwinStreamEvent);
      } catch {
        // ignore malformed frame
      }
    }
    return events;
  };
}

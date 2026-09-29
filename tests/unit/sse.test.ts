import { describe, expect, it } from "vitest";
import { createSseParser } from "@/features/twin/sse";

describe("createSseParser", () => {
  it("parses complete frames", () => {
    const parse = createSseParser();
    expect(parse('data: {"type":"text","delta":"hi"}\n\ndata: {"type":"done"}\n\n')).toEqual([
      { type: "text", delta: "hi" },
      { type: "done" },
    ]);
  });

  it("buffers a frame split across chunks", () => {
    const parse = createSseParser();
    expect(parse('data: {"type":"te')).toEqual([]);
    expect(parse('xt","delta":"a b"}\n')).toEqual([]);
    expect(parse("\n")).toEqual([{ type: "text", delta: "a b" }]);
  });

  it("skips malformed and empty frames", () => {
    const parse = createSseParser();
    expect(parse("data: {oops\n\n: comment\n\n")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { itemsToMessages } from "@/features/twin/thread-items";

describe("itemsToMessages (thread history)", () => {
  it("keeps user and assistant text, in order, and drops everything else", () => {
    const items = [
      { role: "user", content: "Should I move?" },
      { type: "reasoning", content: [{ type: "reasoning_text", text: "hidden" }] },
      { type: "function_call", name: "create_focus_block", arguments: "{}" },
      { role: "assistant", type: "message", content: [{ type: "output_text", text: "Based on what you've told me…" }] },
      { role: "user", content: [{ type: "input_text", text: "Thanks" }] },
      { role: "assistant", content: [] },
    ];
    expect(itemsToMessages(items)).toEqual([
      { role: "user", text: "Should I move?" },
      { role: "twin", text: "Based on what you've told me…" },
      { role: "user", text: "Thanks" },
    ]);
  });
});

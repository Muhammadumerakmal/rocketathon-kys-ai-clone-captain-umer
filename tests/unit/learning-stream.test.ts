import { describe, expect, it } from "vitest";
import { mockChat } from "@/lib/mock/chat";

describe("learning chat stream", () => {
  it("marks the answer complete before reporting memory learning", async () => {
    const response = mockChat({ chatId: null, message: "Remember that I prefer TypeScript for coding.", asOf: null });
    const events = (await response.text())
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { type: string });
    const complete = events.findIndex((event) => event.type === "answer_complete");
    const update = events.findIndex((event) => event.type === "memory_update");
    expect(complete).toBeGreaterThanOrEqual(0);
    expect(update).toBeGreaterThan(complete);
  });

  it("reports when an explicit forget request matched no memory", async () => {
    const response = mockChat({ chatId: null, message: "Forget my nonexistent quantum-pineapple preference.", asOf: null });
    const events = (await response.text())
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { type: string });
    expect(events.some((event) => event.type === "memory_update_failed")).toBe(true);
    expect(events.some((event) => event.type === "memory_update")).toBe(false);
  });
});

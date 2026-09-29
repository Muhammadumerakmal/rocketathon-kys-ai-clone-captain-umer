import { describe, expect, it } from "vitest";
import { Memory } from "@/contracts";
import { rowToMemory, toVectorLiteral, type MemoryRow } from "@/server/repos/memories";

const row: MemoryRow = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-00000000000a",
  content: "I work best in the morning",
  summary: null,
  kind: "procedural",
  source_type: "manual",
  importance: 0.5,
  context_qualifier: null,
  valid_from: "2026-01-01 09:00:00+00", // Postgres text format
  valid_to: null,
  recorded_at: "2026-09-29 08:00:00.123+00",
  superseded_by: null,
  influence: "active",
};

describe("rowToMemory", () => {
  it("maps snake_case rows to a contract-valid Memory with strict ISO timestamps", () => {
    const m = rowToMemory(row);
    expect(Memory.safeParse(m).success).toBe(true);
    expect(m.validFrom).toBe("2026-01-01T09:00:00.000Z");
    expect(m).not.toHaveProperty("user_id");
  });

  it("appends the context qualifier from a 'both true' resolution", () => {
    expect(rowToMemory({ ...row, context_qualifier: "on weekdays" }).content).toBe(
      "I work best in the morning (on weekdays)",
    );
  });
});

describe("toVectorLiteral", () => {
  it("produces pgvector text input", () => {
    expect(toVectorLiteral([0.1, -2, 3])).toBe("[0.1,-2,3]");
  });
});

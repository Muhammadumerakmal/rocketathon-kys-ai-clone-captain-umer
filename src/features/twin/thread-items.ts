/**
 * Convert stored Agents SDK session items (messages.item) into display messages for the
 * thread history. Pure: tools, reasoning and other item types are not shown.
 */
export interface DisplayMessage {
  role: "user" | "twin";
  text: string;
}

type Part = { type?: string; text?: string };
type Item = { role?: string; type?: string; content?: string | Part[] };

const textOf = (content: Item["content"]): string =>
  typeof content === "string"
    ? content
    : (content ?? [])
        .filter((p) => p.type === "input_text" || p.type === "output_text" || p.type === "text")
        .map((p) => p.text ?? "")
        .join("");

export function itemsToMessages(items: readonly unknown[]): DisplayMessage[] {
  const out: DisplayMessage[] = [];
  for (const raw of items) {
    const item = raw as Item;
    if (item.role !== "user" && item.role !== "assistant") continue;
    const text = textOf(item.content).trim();
    if (!text) continue;
    out.push({ role: item.role === "user" ? "user" : "twin", text });
  }
  return out;
}

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "@/features/twin/markdown-message";

describe("MarkdownMessage", () => {
  it("renders formatted answers and code without executing model HTML", () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage text={'**Useful** answer\n\n```ts\nconst x = 1\n```\n\n<script>alert("bad")</script>'} />,
    );
    expect(html).toContain("<strong>Useful</strong>");
    expect(html).toContain("<pre");
    expect(html).toContain("const");
    expect(html).not.toContain("<script>");
  });
});

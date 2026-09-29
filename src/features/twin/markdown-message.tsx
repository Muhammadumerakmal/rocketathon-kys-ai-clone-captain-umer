import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

/** Model text is parsed as Markdown; raw HTML stays inert. */
export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="twin-markdown min-w-0 break-words text-[15px] leading-relaxed">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{text}</Markdown>
    </div>
  );
}

import type { Metadata } from "next";
import { AskView } from "@/features/twin/ask-view";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage() {
  await requireViewer();
  return <AskView />;
}

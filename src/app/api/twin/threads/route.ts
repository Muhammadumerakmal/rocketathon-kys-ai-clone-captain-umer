import { isMock } from "@/lib/env";
import { withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Thread history for the Ask screen (ChatKit-style history sheet). */
export const GET = withApi(async () => {
  if (isMock()) {
    return Response.json({ threads: mockState().threads.map(({ id, title, createdAt }) => ({ id, title, createdAt })) });
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("chats")
    .select("id,title,created_at")
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<{ id: string; title: string | null; created_at: string }[]>();
  if (error) throw error;
  return Response.json({ threads: data.map((c) => ({ id: c.id, title: c.title ?? "Conversation", createdAt: c.created_at })) });
});

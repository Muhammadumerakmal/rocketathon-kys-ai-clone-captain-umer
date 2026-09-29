import { Uuid } from "@/contracts";
import { itemsToMessages } from "@/features/twin/thread-items";
import { isMock } from "@/lib/env";
import { HttpError, withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One thread's messages, reconstructed from the stored Agents SDK session items. */
export const GET = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = Uuid.safeParse((await params).id);
  if (!id.success) throw new HttpError("bad_request", "Invalid thread id.");
  if (isMock()) {
    const t = mockState().threads.find((x) => x.id === id.data);
    if (!t) throw new HttpError("not_found", "Conversation not found.");
    return Response.json({ id: t.id, messages: t.messages });
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("messages")
    .select("item")
    .eq("chat_id", id.data)
    .order("id", { ascending: true })
    .limit(200)
    .returns<{ item: unknown }[]>();
  if (error) throw error;
  return Response.json({ id: id.data, messages: itemsToMessages(data.map((r) => r.item)) });
});

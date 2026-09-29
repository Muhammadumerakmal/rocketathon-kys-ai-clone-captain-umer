import { Uuid } from "@/contracts";
import { itemsToMessages } from "@/features/twin/thread-items";
import { isMock } from "@/lib/env";
import { HttpError, withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { deleteChat, listChatItems } from "@/server/repos/chats";

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
  return Response.json({ id: id.data, messages: itemsToMessages(await listChatItems(supabase, id.data)) });
});

/** Delete a conversation and its messages (FK cascade). RLS scopes it to the owner. */
export const DELETE = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = Uuid.safeParse((await params).id);
  if (!id.success) throw new HttpError("bad_request", "Invalid thread id.");
  if (isMock()) {
    const s = mockState();
    s.threads = s.threads.filter((t) => t.id !== id.data);
    return new Response(null, { status: 204 });
  }
  const { supabase } = await requireUser();
  if (!(await deleteChat(supabase, id.data))) throw new HttpError("not_found", "Conversation not found.");
  return new Response(null, { status: 204 });
});

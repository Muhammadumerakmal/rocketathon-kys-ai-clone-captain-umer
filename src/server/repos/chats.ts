import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createChat(sb: SupabaseClient, userId: string, title: string): Promise<string> {
  const { data, error } = await sb.from("chats").insert({ user_id: userId, title }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function chatExists(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await sb.from("chats").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function touchChat(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function listChats(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("chats")
    .select("id,title,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(30)
    .returns<{ id: string; title: string | null; created_at: string; updated_at: string }[]>();
  if (error) throw error;
  return data.map((c) => ({ id: c.id, title: c.title ?? "Conversation", createdAt: c.updated_at ?? c.created_at }));
}

export async function listChatItems(sb: SupabaseClient, id: string): Promise<unknown[]> {
  const { data, error } = await sb
    .from("messages")
    .select("item")
    .eq("chat_id", id)
    .order("id", { ascending: true })
    .limit(200)
    .returns<{ item: unknown }[]>();
  if (error) throw error;
  return data.map((r) => r.item);
}

export async function deleteChat(sb: SupabaseClient, id: string): Promise<boolean> {
  const { error, count } = await sb.from("chats").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  return Boolean(count);
}

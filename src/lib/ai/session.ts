import "server-only";
import type { AgentInputItem, Session } from "@openai/agents";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Agents SDK Session backed by our `messages` table (plan §4): history stays in our DB,
 * under RLS, and is covered by export / delete-all. Never OpenAIConversationsSession.
 */
export class SupabaseSession implements Session {
  constructor(
    private readonly sb: SupabaseClient,
    private readonly chatId: string,
    private readonly userId: string,
    /** most recent items replayed to the model */
    private readonly window = 20,
  ) {}

  async getSessionId(): Promise<string> {
    return this.chatId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const n = Math.min(limit ?? this.window, this.window);
    const { data, error } = await this.sb
      .from("messages")
      .select("item")
      .eq("chat_id", this.chatId)
      .order("id", { ascending: false })
      .limit(n)
      .returns<{ item: AgentInputItem }[]>();
    if (error) throw error;
    return data.map((r) => r.item).reverse();
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (items.length === 0) return;
    const rows = items.map((item) => ({
      chat_id: this.chatId,
      user_id: this.userId,
      role: "role" in item && typeof item.role === "string" ? item.role : item.type ?? "item",
      item,
    }));
    const { error } = await this.sb.from("messages").insert(rows);
    if (error) throw error;
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const { data, error } = await this.sb
      .from("messages")
      .select("id,item")
      .eq("chat_id", this.chatId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: number; item: AgentInputItem }>();
    if (error) throw error;
    if (!data) return undefined;
    const { error: delErr } = await this.sb.from("messages").delete().eq("id", data.id);
    if (delErr) throw delErr;
    return data.item;
  }

  async clearSession(): Promise<void> {
    const { error } = await this.sb.from("messages").delete().eq("chat_id", this.chatId);
    if (error) throw error;
  }
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  horizon: "week" | "quarter" | "year" | "life";
}

export async function activeGoals(sb: SupabaseClient, limit = 5): Promise<Goal[]> {
  const { data, error } = await sb
    .from("goals")
    .select("id,title,description,priority,horizon")
    .eq("status", "active")
    .order("priority", { ascending: true })
    .limit(limit)
    .returns<Goal[]>();
  if (error) throw error;
  return data;
}

export async function createGoal(
  sb: SupabaseClient,
  userId: string,
  g: { title: string; description?: string; priority?: number; horizon?: Goal["horizon"] },
): Promise<Goal> {
  const { data, error } = await sb
    .from("goals")
    .insert({ user_id: userId, title: g.title, description: g.description ?? null, priority: g.priority ?? 3, horizon: g.horizon ?? "quarter" })
    .select("id,title,description,priority,horizon")
    .single<Goal>();
  if (error) throw error;
  return data;
}

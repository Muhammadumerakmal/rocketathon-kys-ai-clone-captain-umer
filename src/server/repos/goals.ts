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

/**
 * Goals for prompts and Council lenses: the goals table if the user has any, otherwise
 * their active goal-kind memories ("My goal this year is…"), most important first.
 */
export async function goalsForTwin(sb: SupabaseClient, limit = 3): Promise<Goal[]> {
  const explicit = await activeGoals(sb, limit);
  if (explicit.length > 0) return explicit;
  const { data, error } = await sb
    .from("memories")
    .select("id,content,importance")
    .eq("kind", "goal")
    .eq("influence", "active")
    .is("valid_to", null)
    .order("importance", { ascending: false })
    .limit(limit)
    .returns<{ id: string; content: string; importance: number }[]>();
  if (error) throw error;
  return data.map((m, i) => ({ id: m.id, title: m.content.slice(0, 120), description: null, priority: i + 1, horizon: "year" as const }));
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

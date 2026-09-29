"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isMock } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { grantConsent } from "@/server/repos/profiles";

const ConsentForm = z.object({
  agree: z.literal("on"),
  euUser: z.enum(["on"]).optional(),
});

export type ConsentState = { error?: string };

/** Records versioned consent (profile + append-only ledger), then starts training. */
export async function acceptConsent(_prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const parsed = ConsentForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please tick the box to confirm you understand." };
  if (isMock()) redirect("/train");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  await grantConsent(supabase, data.user.id, parsed.data.euUser === "on");
  redirect("/train");
}

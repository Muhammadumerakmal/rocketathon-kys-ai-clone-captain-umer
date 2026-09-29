import { NextResponse, type NextRequest } from "next/server";
import { isMock } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST-only so a link or image can't sign someone out (CSRF-safe by method). */
export async function POST(request: NextRequest) {
  if (!isMock()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}

import { connection } from "next/server";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { WelcomeHero } from "@/features/identity/welcome-hero";
import { getViewer } from "@/lib/auth";
import { isMock } from "@/lib/env";

/** Welcome / onboarding (UI/UX plan §6.1). Signed-in users go straight to training. */
export default async function WelcomePage() {
  await connection();
  const signedIn = !isMock() && Boolean(await getViewer());

  return (
    <main className="min-h-[80dvh]">
      <div className="flex justify-end px-[18px] pt-3">
        <ThemeToggle />
      </div>
      <WelcomeHero ctaHref={signedIn ? "/train" : "/sign-in"} />
    </main>
  );
}

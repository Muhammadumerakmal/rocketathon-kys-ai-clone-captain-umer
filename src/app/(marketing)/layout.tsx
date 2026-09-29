import type { ReactNode } from "react";
import { AiDisclosure } from "@/components/shared/ai-disclosure";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AiDisclosure className="px-[18px] pb-8" />
    </>
  );
}

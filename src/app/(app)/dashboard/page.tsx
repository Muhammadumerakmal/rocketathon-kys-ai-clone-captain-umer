import { redirect } from "next/navigation";

/** The dashboard became Insights (UI/UX plan §6.6); keep old links working. */
export default function DashboardRedirect() {
  redirect("/insights");
}

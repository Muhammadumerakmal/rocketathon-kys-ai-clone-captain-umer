import {
  Brain,
  GraduationCap,
  Library,
  LineChart,
  type LucideIcon,
  MessagesSquare,
  NotebookPen,
  Settings,
  Split,
  Swords,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** The five primary tabs (UI/UX plan §4): bottom bar on phones, left rail on desktop. Order = transition direction. */
export const TABS: readonly NavItem[] = [
  { href: "/train", label: "Train", icon: GraduationCap },
  { href: "/duel", label: "Predict me", icon: Swords },
  { href: "/twin", label: "Ask", icon: MessagesSquare },
  { href: "/memories", label: "Memories", icon: Library },
  { href: "/insights", label: "Insights", icon: LineChart },
];

/** Secondary destinations: in the rail on desktop, in the top-bar menu on phones. */
export const MORE: readonly NavItem[] = [
  { href: "/decisions", label: "Decisions", icon: NotebookPen },
  { href: "/council", label: "Council", icon: Brain },
  { href: "/simulator", label: "Simulator", icon: Split },
  { href: "/settings/privacy", label: "Settings", icon: Settings },
];

export function activeTabIndex(pathname: string): number {
  return TABS.findIndex((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
}

/** Direction for the slide transition: forward if the destination tab is to the right. */
export function directionTo(from: string, to: string): "fwd" | "back" {
  const a = activeTabIndex(from);
  const b = activeTabIndex(to);
  if (a < 0 || b < 0) return "fwd";
  return b >= a ? "fwd" : "back";
}

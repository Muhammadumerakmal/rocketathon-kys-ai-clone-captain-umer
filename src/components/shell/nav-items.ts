import {
  Brain,
  Gauge,
  GraduationCap,
  Library,
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
  /** Roadmap phase that ships this page (CAPABILITY_MAP.md). Hidden links avoid 404s. */
  phase: number;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, phase: 0 },
  { href: "/train", label: "Train", icon: GraduationCap, phase: 3 },
  { href: "/duel", label: "Predict Me", icon: Swords, phase: 7 },
  { href: "/twin", label: "Twin", icon: MessagesSquare, phase: 5 },
  { href: "/memories", label: "Memories", icon: Library, phase: 4 },
  { href: "/decisions", label: "Decisions", icon: NotebookPen, phase: 6 },
  { href: "/council", label: "Council", icon: Brain, phase: 9 },
  { href: "/simulator", label: "Simulator", icon: Split, phase: 9 },
  { href: "/settings/privacy", label: "Settings", icon: Settings, phase: 9 },
];

/** Bump as phases land; items above this are shown as "coming soon". */
export const SHIPPED_PHASE = 8;

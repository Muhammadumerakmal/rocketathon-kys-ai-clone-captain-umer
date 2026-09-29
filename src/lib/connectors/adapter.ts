import type { ConnectorId, FocusBlockArgs } from "@/contracts";
import { focusBlockEnd } from "./policy";

/**
 * Connector adapter (plan §14). `execute` is only ever called by the gateway AFTER an
 * HMAC-verified human approval — adapters never decide on their own.
 */
export interface ConnectorAdapter {
  id: ConnectorId;
  label: string;
  /** shown verbatim in Settings → Connections */
  scopes: readonly string[];
  execute(action: "create_focus_block", args: FocusBlockArgs): Promise<Record<string, unknown>>;
}

/**
 * Built-in demo calendar: the event lives in the proposal's result row (no OAuth, no
 * third party). A Google Calendar adapter implements the same interface.
 */
export const demoCalendar: ConnectorAdapter = {
  id: "demo-calendar",
  label: "TwinOS demo calendar",
  scopes: ["Propose focus blocks (each one needs your approval)", "Create approved events"],
  async execute(_action, args) {
    return {
      calendar: "TwinOS demo calendar",
      eventId: crypto.randomUUID(),
      title: args.title,
      start: args.start,
      end: focusBlockEnd(args),
    };
  },
};

export const ADAPTERS: Partial<Record<ConnectorId, ConnectorAdapter>> = { "demo-calendar": demoCalendar };

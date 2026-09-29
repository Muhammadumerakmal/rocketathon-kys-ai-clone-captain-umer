import { run, RunState } from "@openai/agents";
import { describe, expect, it } from "vitest";
import { FocusBlockArgs } from "@/contracts";
import { twinChatAgent } from "@/lib/ai/agents";
import { configureAgents } from "@/lib/ai/models";
import { FOCUS_BLOCK_TOOL, focusBlockTool, neverExecute } from "@/lib/ai/tools";
import { ariaContext } from "../aria";

/**
 * Live check of the human-in-the-loop flow (plan §14): the run pauses on the write tool,
 * the state survives serialization, and only an explicit approve executes it.
 */
const hasKey = Boolean(process.env.OPENAI_API_KEY);
const ASK = "Block 45 minutes tomorrow at 09:00 UTC in my calendar to prep for the hackathon.";

async function pausedRun() {
  const res = await run(twinChatAgent(ariaContext(), [focusBlockTool(neverExecute)]), ASK, { maxTurns: 3 });
  expect(res.interruptions).toHaveLength(1);
  const item = res.interruptions[0]!;
  const raw = item.rawItem as { name: string; arguments: string };
  expect(raw.name).toBe(FOCUS_BLOCK_TOOL);
  const args = FocusBlockArgs.parse(JSON.parse(raw.arguments));
  return { serialized: res.state.toString(), args };
}

describe.skipIf(!hasKey)("approval-gated tool (live)", () => {
  configureAgents();

  it("pauses, survives serialization, and executes only after approve", async () => {
    const { serialized, args } = await pausedRun();
    expect(args.minutes).toBe(45);
    console.log(`[eval] proposed: ${JSON.stringify(args)}`);

    const executed: FocusBlockArgs[] = [];
    const agent = twinChatAgent(ariaContext(), [focusBlockTool(async (a) => (executed.push(a), { eventId: "evt_1" }))]);
    const state = await RunState.fromString(agent, serialized);
    const [pending] = state.getInterruptions();
    state.approve(pending!);
    const resumed = await run(agent, state, { maxTurns: 3 });

    expect(executed).toHaveLength(1);
    expect(executed[0]).toEqual(args);
    console.log(`[eval] after approve: ${String(resumed.finalOutput).slice(0, 160)}`);
  });

  it("reject → never executes, twin acknowledges", async () => {
    const { serialized } = await pausedRun();
    const executed: unknown[] = [];
    const agent = twinChatAgent(ariaContext(), [focusBlockTool(async (a) => (executed.push(a), {}))]);
    const state = await RunState.fromString(agent, serialized);
    state.reject(state.getInterruptions()[0]!, { message: "The user declined this calendar event." });
    const resumed = await run(agent, state, { maxTurns: 3 });
    expect(executed).toHaveLength(0);
    console.log(`[eval] after reject: ${String(resumed.finalOutput).slice(0, 160)}`);
  });

  it("without a connected calendar the twin has no tool and can't act", async () => {
    const res = await run(twinChatAgent(ariaContext()), ASK, { maxTurns: 3 });
    expect(res.interruptions).toHaveLength(0);
  });
});

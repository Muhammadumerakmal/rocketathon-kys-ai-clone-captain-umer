# TwinOS — Device 3 Plan
## Clone Council, What-If Simulator, Connectors & Integration QA

**Branch:** `track/simulation-connectors`

---

# Mission

Build the "wow" layer without destabilizing the core clone.

You own:

- Clone Council
- What-If Simulator
- connector abstraction
- approval workflow
- optional Google Calendar / Gmail integration
- integration tests and E2E
- optional voice setup after core works

---

# 1. Owned Paths

```text
src/app/(app)/council/**
src/app/(app)/simulator/**
src/app/(app)/settings/connections/**
src/app/api/council/**
src/app/api/simulator/**
src/app/api/connectors/**
src/app/api/realtime/**
src/features/council/**
src/features/simulator/**
src/features/connectors/**
src/lib/connectors/**
tests/integration/**
tests/e2e/**
```

Do not change Device 2's DB schema directly.
Request a coordinated migration if new columns/tables are needed.

---

# 2. Clone Council

## Goal

Show different lenses of the same person.

Perspectives:

1. Student Me
2. Career Me
3. Financial Me
4. Future Me

Each is **not a separate human identity**.
It is one user's data viewed through different evaluation lenses.

## API

POST `/api/council`

Input:

```ts
{
  scenario: string;
}
```

Output:

```ts
{
  perspectives: [
    {
      id: "student",
      title: "Student Me",
      position: string,
      considerations: string[],
      evidence: Evidence[]
    }
  ],
  synthesis: {
    agreements: string[],
    tradeoffs: string[],
    unknowns: string[],
    questionsForUser: string[]
  }
}
```

## Efficiency

For hackathon:
- use one model call with structured output OR controlled parallel calls
- do not build a heavyweight multi-agent framework
- reuse memory pack from shared retrieval service after Device 2 merge

Before Device 2 merge:
- implement with a mock `ContextProvider` adapter

---

# 3. What-If Simulator

## Goal

Compare possible outcomes/trade-offs, not predict the future.

POST `/api/simulator`

Input:

```ts
{
  scenario: string;
  options: [
    { "id": "a", "label": "Paid job" },
    { "id": "b", "label": "Dream-field internship" }
  ]
}
```

Output:

```ts
{
  options: [
    {
      id: "a",
      possibleUpsides: [],
      possibleTradeoffs: [],
      goalAlignment: 0.0,
      evidence: []
    }
  ],
  unknowns: [],
  userQuestions: []
}
```

UI labels:
- "Possible upside"
- "Trade-off"
- "Goal alignment"
- "Unknown"

Avoid:
- "This will happen"
- "Future probability 91%"

---

# 4. Connector Abstraction

Build an adapter boundary so the product does not depend on one vendor forever.

```ts
interface ConnectorAdapter {
  id: string;
  capabilities: ("read" | "propose-write" | "execute-write")[];

  executeRead(
    userId: string,
    tool: string,
    args: unknown
  ): Promise<unknown>;

  proposeWrite(
    userId: string,
    tool: string,
    args: unknown
  ): Promise<ActionProposal>;

  executeApproved(
    userId: string,
    proposalId: string
  ): Promise<ActionResult>;
}
```

---

# 5. MCP Strategy

Use Vercel AI SDK MCP support.

Production:
- Streamable HTTP transport
- close MCP clients
- explicit tool allowlist
- Zod-defined schemas when possible

Avoid:
- stdio MCP in production deployment
- exposing every available tool to the model
- passing raw connector secrets into prompts

Create:

```text
src/lib/connectors/mcp-client.ts
src/lib/connectors/tool-allowlist.ts
```

---

# 6. Composio Strategy

Use only if core is already stable.

Recommended first connector:
**Google Calendar**

Why:
- strong demo
- easy to explain
- human clone can use schedule context
- proposed event is visibly approval-gated

Second optional:
**Gmail read/search**

For hackathon, prefer:
- search/read
- create draft

Avoid automatic send unless approval workflow is fully tested.

---

# 7. Human Approval State Machine

```text
PROPOSED
   |
   +--> REJECTED
   |
   +--> APPROVED
           |
           +--> EXECUTED
           |
           +--> FAILED
```

Server checks:
- proposal belongs to current user
- status is `approved`
- arguments haven't changed since approval
- tool is allowlisted
- connector account is active

Never trust a client-supplied `"approved": true` by itself.

Approval must update server-side state first.

---

# 8. Best Connector Demo

User:
> "Find me a 45 minute free slot tomorrow and block it for hackathon preparation."

Flow:

1. AI requests read-only calendar availability.
2. UI shows free slots.
3. TwinOS proposes one event.
4. Approval card shows:
   - title
   - date/time
   - duration
   - calendar
5. User presses **Approve**.
6. Server executes connector tool.
7. Result displayed.
8. Audit log saved.

This proves:
- personalization
- real tool use
- safe action control

---

# 9. Integration with AI SDK Tools

Use server-side tools for reads.

Write tools should require approval.

Concept:

```ts
const createCalendarEvent = tool({
  description: "Create a calendar event after user approval",
  inputSchema: CalendarEventSchema,
  needsApproval: true,
  execute: async (args) => {
    // execute only through approved connector path
  }
});
```

Do not duplicate approval logic entirely in UI.
Server remains authoritative.

---

# 10. Connections Page

`/settings/connections`

Cards:
- Google Calendar
- Gmail
- future connectors

Each card:
- Connected / Not connected
- granted capabilities
- last used
- disconnect button

Show scope/capability text in plain language.

---

# 11. Voice — Optional Only

After Council + Simulator + connector demo work:

Use OpenAI Realtime with WebRTC.

Architecture:

```text
browser
 -> your Next.js server session endpoint
 -> OpenAI Realtime
 -> WebRTC session
```

Never place permanent OpenAI API key in browser JavaScript.

Voice mode should call the same clone context service, not create a separate personality system.

---

# 12. Integration Tests

Required:

### Council
- unauthorized -> 401
- output validates schema
- evidence belongs to user

### Simulator
- 2 options minimum
- unknowns returned
- invalid payload -> 400

### Connector
- cannot execute proposed action
- cannot execute rejected action
- can execute approved action once
- replay attempt blocked
- user A cannot approve user B proposal
- changed arguments invalidate approval

---

# 13. E2E Test

Use Playwright.

Main demo:

```text
login
 -> train
 -> add memory
 -> clone chat
 -> prediction
 -> feedback
 -> dashboard
 -> council
 -> simulator
```

Connector E2E can use a mocked adapter in CI.

Do not require real Google OAuth for every automated test.

---

# 14. Mock Connector

Create:

```text
src/lib/connectors/adapters/mock-calendar.ts
```

It should:
- return deterministic free slots
- accept approved create-event
- write an audit record

This gives a reliable fallback if external OAuth fails during judging.

Keep real connector behind same interface.

---

# 15. Error Handling

Connector errors must become safe states:

- expired connection
- insufficient scope
- provider unavailable
- rate limited
- action rejected
- action already executed

UI should offer:
- reconnect
- retry
- cancel

Never leak raw OAuth/provider stack traces.

---

# 16. Git Routine

```bash
git clone <repo>
# repo root = ai-human-clone-hack-kys
git checkout track/simulation-connectors
npm install
```

Suggested commits:

```text
feat(council): add multi-perspective schema and ui
feat(simulator): add scenario comparison flow
feat(connectors): add connector adapter contract
feat(connectors): add approval state machine
feat(connectors): add mock calendar adapter
feat(connectors): add mcp client
test(e2e): cover complete demo path
```

Before push:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

---

# 17. Definition of Done

Device 3 is done when:

- Council works with agreed contracts
- Simulator works with structured results
- connector interface is vendor-independent
- mock calendar demo is reliable
- real connector is optional but cleanly supported
- write action cannot run before server-side approval
- critical E2E path passes
- voice is attempted only after everything above is stable

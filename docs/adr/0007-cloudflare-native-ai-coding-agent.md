---
status: proposed
date: 2026-03-19
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0007: Adopt Cloudflare-Native Infrastructure for an Internal AI Coding Agent

## Context and Problem Statement

Elite engineering orgs (Stripe, Ramp, Coinbase) are running internal AI coding agents — Slackbots, CLIs, and web apps — that meet engineers where they work, connected to internal systems with the right context and safety boundaries. [open-swe](https://github.com/langchain-ai/open-swe) is an open-source framework that implements this pattern on top of LangGraph and a pluggable sandbox provider (Modal, Daytona, Runloop, LangSmith).

WODsmith is already deployed entirely on Cloudflare Workers (ADR-0001). Cloudflare now offers [Containers](https://developers.cloudflare.com/containers/) — isolated Docker containers spawned directly from Durable Objects — which is exactly the "isolated sandbox" primitive open-swe needs. Running the full agent stack on Cloudflare means:

1. No third-party sandbox vendor (Modal, Daytona, Runloop) — one infrastructure provider
2. Webhook receipt is edge-global (low latency Linear/Slack/GitHub acknowledgement)
3. All sensitive credentials use Alchemy secret bindings (`alchemy.secret()`), declared in `alchemy.run.ts` and injected as encrypted Worker secrets — Cloudflare KV is reserved for non-secret, non-sensitive state only
4. Durable Objects provide per-thread stateful session management with zero extra infrastructure

How should we architect an open-swe-style internal coding agent that runs natively on Cloudflare?

## Decision Drivers

* **Infrastructure consolidation** — everything else runs on Cloudflare; a separate sandbox vendor adds cost and operational surface area
* **Latency** — webhooks (Linear, Slack, GitHub) must acknowledge within 3 seconds; edge Workers handle this without cold-start penalties
* **Isolation** — every agent task must run in a fully isolated environment with no access to production systems
* **Statefulness** — agent sessions are long-running (minutes to hours); state must survive across model calls and follow-up messages
* **Pluggable orchestration** — the open-swe architecture separates webhook I/O, session management, and execution cleanly; we should preserve that separation
* **Existing auth/secrets** — all sensitive credentials (GitHub tokens, Linear API keys, Slack signing secrets, Anthropic API key) must use Alchemy secret bindings (`alchemy.secret()`) declared in `alchemy.run.ts` and injected as encrypted Worker secrets; Cloudflare KV is for non-secret, non-sensitive state only
* **Consistency with AGENTS.md** — the agent should read repo-level `AGENTS.md` context, matching the open-swe pattern, to know WODsmith conventions automatically

## Considered Options

* **Option A: Cloudflare-native stack** — Workers (webhooks) + Queues (async dispatch) + Durable Objects (session state) + Cloudflare Containers (sandbox execution)
* **Option B: Hybrid — Cloudflare Workers for webhooks, third-party for everything else** — keep LangGraph Cloud + Modal/Daytona as the sandbox, route webhooks through Cloudflare as a thin proxy
* **Option C: Fully external** — deploy open-swe as-is on a traditional host (Fly.io, Cloud Run) with no Cloudflare integration except DNS

## Decision Outcome

Chosen option: **Option A: Cloudflare-native stack**, because:

- Cloudflare Containers is a first-class Cloudflare product directly integrated with Durable Objects, removing the need for a separate sandbox vendor
- The team already operates zero non-Cloudflare infrastructure; adding Modal/Daytona (Option B) or a separate host (Option C) increases operational complexity for no architectural benefit
- Durable Objects provide exactly the "one stateful session per agent thread" model open-swe implements via LangGraph thread metadata — without needing LangGraph Cloud
- AI Gateway gives LLM call caching, rate limiting, and observability in the same Cloudflare dashboard already used for everything else

### Consequences

* Good, because all infrastructure stays in one provider — Cloudflare dashboard covers containers, secrets, queues, and KV in one place
* Good, because webhook receipt is edge-global; Linear/Slack/GitHub always get sub-second acknowledgement regardless of agent task duration
* Good, because Cloudflare Containers are lightweight (~1–3s cold start vs ~10–30s for Modal); sandbox creation is fast
* Good, because Durable Objects co-locate agent session state with container lifecycle — no separate state store
* Good, because the open-swe sandbox protocol (`SandboxBackendProtocol`) is pluggable; we implement one new integration file and nothing else in the orchestration changes
* Good, because `AGENTS.md` from the wodsmith repo is read inside the container, giving the agent full WODsmith conventions automatically
* Bad, because Cloudflare Containers is still in open beta; breaking API changes are possible before GA
* Bad, because the agent orchestration (Python + LangGraph) runs inside the container, not in the Worker — the Worker is a thin I/O layer only; TypeScript agents are not yet feasible with LangGraph's complexity
* Bad, because the Python container image must be rebuilt and re-registered in Cloudflare when the agent logic changes — it is not hot-reloadable like a Worker script
* Neutral, because LangGraph is used only for the agent graph inside the container; LangGraph Cloud / LangSmith are NOT required (we skip them)
* Neutral, because Cloudflare AI Gateway is additive — initial deployment can route directly to Anthropic; Gateway can be layered in later

### Non-Goals

* Replacing LangGraph inside the container — the agent graph remains Python/LangGraph, running inside the Docker container
* Building a public-facing coding agent product (this is an internal developer tool)
* Replacing the existing wodsmith-start app with agent-generated code automatically (human approval on PRs is always required)
* Supporting non-GitHub code hosts (GitLab, Bitbucket) in v1
* Agent-to-agent communication or multi-agent orchestration beyond open-swe's built-in subagent support

## Implementation Plan

### Architecture Overview

```
Slack / Linear / GitHub Webhooks
           ↓
┌──────────────────────────────────────┐
│  Cloudflare Worker                   │  ← thin webhook receiver
│  apps/wodsmith-start (existing)      │
│  src/routes/api/webhooks/            │
│  - verify signatures                 │
│  - react 👀 immediately              │
│  - enqueue task to AGENT_QUEUE       │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│  Cloudflare Queue: agent-tasks       │  ← async dispatch
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│  Durable Object: AgentSession        │  ← one per thread (deterministic ID)
│  - owns container lifecycle          │
│  - persists thread state in DO       │
│  - buffers follow-up messages        │
│  - WebSocket for real-time UI        │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│  Cloudflare Container                │  ← isolated Linux sandbox per thread
│  Image: open-swe Python agent        │
│  - git clone repo inside             │
│  - read AGENTS.md                    │
│  - LangGraph agent loop              │
│  - calls Anthropic API               │
│  - commits code, opens PR            │
└──────────────┬───────────────────────┘
               ↓
   GitHub API / Linear API / Slack API
```

### Phase 1: Webhook Receivers

**Affected paths**: `apps/wodsmith-start/src/routes/api/webhooks/`

Add three API route files in the existing TanStack Start app:

- `linear.ts` — receive Linear webhooks, verify `linear-signature` HMAC, enqueue to `AGENT_QUEUE` if comment body contains `@openswe`
- `slack.ts` — receive Slack Event API webhooks, verify `X-Slack-Signature`, enqueue if bot is mentioned
- `github.ts` — receive GitHub App webhooks, verify `X-Hub-Signature-256`, enqueue if `@openswe` mentioned in PR review comment

**Pattern**: follows existing API route pattern (`createAPIFileRoute`) from `apps/wodsmith-start/src/routes/api/`

**All webhook handlers must**:
- Return 200 within 500ms (use `waitUntil` or Queue for async work)
- Validate signatures before processing any payload
- Use `env` from `cloudflare:workers` for secrets — never `process.env`
- Generate a deterministic thread ID (SHA-256 of `"linear-issue:{id}"`, `"slack:{channel}:{ts}"`, etc.)

**Infrastructure is managed via Alchemy** in `apps/wodsmith-start/alchemy.run.ts`, following the same pattern as all other resources in the app. Alchemy v0.82.2 (already installed) exports `Queue`, `QueueConsumer`, `DurableObjectNamespace`, and `Container` from `alchemy/cloudflare` — no `wrangler.jsonc` edits required.

```typescript
// apps/wodsmith-start/alchemy.run.ts additions
import {
  Container,
  DurableObjectNamespace,
  Queue,
  QueueConsumer,
  // ...existing imports
} from "alchemy/cloudflare"

// Agent task queue — async dispatch from webhook handlers to session DOs
const agentQueue = await Queue("agent-tasks", {
  settings: { messageRetentionPeriod: 3600 }, // 1 hour max task age
})

// Queue consumer: routes messages from the queue to the AgentSession DO
await QueueConsumer("agent-tasks-consumer", {
  queue: agentQueue,
  settings: {
    batchSize: 1,         // one task at a time per consumer invocation
    maxRetries: 3,
    retryDelay: 30,
  },
})

// Cloudflare Container: one isolated Linux instance per agent thread
// Image is built from apps/open-swe-agent/Dockerfile and pushed to
// Cloudflare's container registry on each `pnpm alchemy:dev` / deploy
const agentContainer = await Container("agent-sandbox", {
  className: "AgentSession",   // must match the DO class name
  dockerfile: "../../apps/open-swe-agent/Dockerfile",
  maxInstances: 10,
  instanceType: "dev",         // upgrade to "standard" for production
})

// Durable Object namespace: one stateful session per agent thread
const agentSession = DurableObjectNamespace("agent-session", {
  className: "AgentSession",
  sqlite: true,                // enable SQLite for thread state storage
})

// Add to TanStackStart bindings:
const website = await TanStackStart("app", {
  bindings: {
    // ...existing bindings
    AGENT_QUEUE: agentQueue,
    AGENT_SESSION: agentSession,
    // Secrets — read from .dev.vars locally, Cloudflare dashboard in prod
    LINEAR_WEBHOOK_SECRET: alchemy.secret(process.env.LINEAR_WEBHOOK_SECRET!),
    SLACK_SIGNING_SECRET: alchemy.secret(process.env.SLACK_SIGNING_SECRET!),
    SLACK_BOT_TOKEN: alchemy.secret(process.env.SLACK_BOT_TOKEN!),
    GITHUB_APP_PRIVATE_KEY: alchemy.secret(process.env.GITHUB_APP_PRIVATE_KEY!),
    GITHUB_WEBHOOK_SECRET: alchemy.secret(process.env.GITHUB_WEBHOOK_SECRET!),
    ANTHROPIC_API_KEY: alchemy.secret(process.env.ANTHROPIC_API_KEY!),
  },
})
```

After running `pnpm alchemy:dev`, run `pnpm cf-typegen` to regenerate `worker-configuration.d.ts` so TypeScript picks up the new `AGENT_QUEUE`, `AGENT_SESSION`, and secret bindings.

**New secrets** (add to `.dev.vars` and Cloudflare dashboard):
- `LINEAR_WEBHOOK_SECRET`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`

### Phase 2: Durable Object — AgentSession

**Affected paths**: `apps/wodsmith-start/src/durable-objects/agent-session.ts`

The `AgentSession` Durable Object manages the full lifecycle of one agent thread:

```typescript
// src/durable-objects/agent-session.ts
import { DurableObject } from "cloudflare:workers";

export class AgentSession extends DurableObject<Env> {
  // Called by queue consumer to start a new task or resume an existing one
  async startTask(input: AgentTaskInput): Promise<void> { ... }

  // Called by webhook handler when a follow-up message arrives mid-run
  async queueFollowUpMessage(message: string): Promise<void> { ... }

  // Called by the container to dequeue pending follow-up messages
  async drainMessageQueue(): Promise<string[]> { ... }

  // WebSocket handler for real-time status streaming to any future UI
  async fetch(request: Request): Promise<Response> { ... }
}
```

State stored in DO storage (not KV — DO storage is co-located):
- `sandboxId` — Cloudflare Container instance ID for this thread
- `threadStatus` — `idle | running | waiting`
- `pendingMessages` — queue of follow-up messages to inject before next model call
- `repoOwner`, `repoName` — persisted for reconnects
- `githubTokenEncrypted` — encrypted GitHub token (reuse encryption from `src/server/`)

### Phase 3: Cloudflare Container Image (open-swe fork)

**Affected paths**: `apps/open-swe-agent/` (new app in the monorepo)

Fork open-swe and add a Cloudflare sandbox integration:

```
apps/open-swe-agent/
├── agent/
│   ├── integrations/
│   │   └── cloudflare.py        ← NEW: CloudflareContainerSandbox
│   ├── utils/sandbox.py         ← register "cloudflare" in SANDBOX_FACTORIES
│   ├── server.py                ← unchanged (get_agent function)
│   └── webapp.py                ← REMOVED (webhook handling moves to Workers)
├── Dockerfile
└── pyproject.toml
```

**Python dependencies** for `apps/open-swe-agent/pyproject.toml` (pin to minor versions, update as open-swe upstream moves):
```toml
[project]
dependencies = [
  "deepagents>=0.1.0,<0.2",        # open-swe's agent framework
  "langgraph>=0.2.0,<0.3",         # graph orchestration
  "langchain-anthropic>=0.3.0,<0.4", # Anthropic LLM binding
  "langchain-core>=0.3.0,<0.4",
  "httpx>=0.27,<0.28",             # HTTP client for GitHub/Linear/Slack
  "gitpython>=3.1,<4",             # git operations in sandbox
]
```

**`agent/integrations/cloudflare.py`** — implements `SandboxBackendProtocol` by calling back to the Durable Object's HTTP API to execute commands in the container:

```python
from deepagents.backends.sandbox import BaseSandbox
from deepagents.backends.protocol import ExecuteResponse
import subprocess

class CloudflareContainerSandbox(BaseSandbox):
    """Sandbox that runs directly inside a Cloudflare Container.
    
    The container IS the sandbox — commands execute as subprocess calls.
    The DO manages the container lifecycle; the Python agent runs inside it.
    """
    
    def __init__(self, container_id: str):
        self._id = container_id

    @property
    def id(self) -> str:
        return self._id

    def execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout or 300
        )
        output = result.stdout + result.stderr
        return ExecuteResponse(
            output=output,
            exit_code=result.returncode,
            truncated=len(output) > 100_000,
        )
```

**Set `SANDBOX_TYPE=cloudflare`** in the container's environment.

**The container entrypoint** receives a task JSON payload (from the DO), sets up git credentials, and runs the LangGraph agent to completion.

### Phase 4: Queue Consumer

**Affected paths**: `apps/wodsmith-start/src/workers/queue-consumer.ts` (or as a `queue` export in `src/entry.ts`)

```typescript
export default {
  async queue(batch: MessageBatch<AgentTask>, env: Env) {
    for (const msg of batch.messages) {
      const { threadId, source, repoOwner, repoName, task, userEmail } = msg.body;
      const sessionId = env.AGENT_SESSION.idFromName(threadId);
      const session = env.AGENT_SESSION.get(sessionId);
      await session.startTask({ source, repoOwner, repoName, task, userEmail });
      msg.ack();
    }
  }
};
```

### Phase 5: AI Gateway (optional, layer in after v1)

Route Anthropic API calls through Cloudflare AI Gateway for:
- LLM call caching (reduce costs on repeated prompts)
- Rate limiting per agent thread
- Observability (token usage, latency) in Cloudflare dashboard

Change container env var: `ANTHROPIC_BASE_URL=https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/anthropic`

### Affected File Summary

| File / Path | Change |
|---|---|
| `apps/wodsmith-start/alchemy.run.ts` | add `Queue`, `QueueConsumer`, `DurableObjectNamespace`, `Container`, and secret bindings |
| `apps/wodsmith-start/.dev.vars` | add 6 new webhook secrets + `ANTHROPIC_API_KEY` |
| `apps/wodsmith-start/src/routes/api/webhooks/linear.ts` | NEW |
| `apps/wodsmith-start/src/routes/api/webhooks/slack.ts` | NEW |
| `apps/wodsmith-start/src/routes/api/webhooks/github.ts` | NEW |
| `apps/wodsmith-start/src/durable-objects/agent-session.ts` | NEW |
| `apps/open-swe-agent/` | NEW app — forked open-swe with Cloudflare integration |
| `apps/open-swe-agent/agent/integrations/cloudflare.py` | NEW |
| `apps/open-swe-agent/agent/utils/sandbox.py` | register `cloudflare` factory |
| `apps/open-swe-agent/Dockerfile` | NEW |
| `pnpm-workspace.yaml` | add `apps/open-swe-agent` |

### Verification

- [ ] Linear webhook at `/api/webhooks/linear` returns 200 within 500ms and reacts 👀 on the triggering comment before the agent starts
- [ ] Slack webhook at `/api/webhooks/slack` returns 200 within 3 seconds (Slack's hard timeout)
- [ ] GitHub webhook at `/api/webhooks/github` returns 200 and enqueues a run when `@openswe` appears in a PR review comment
- [ ] Invalid webhook signatures return 401, not 500
- [ ] Each agent task runs in an isolated Cloudflare Container; two parallel tasks do not share filesystem state
- [ ] Agent reads `AGENTS.md` from the cloned repo and uses it in the system prompt
- [ ] Agent opens a draft PR on GitHub when task is complete
- [ ] Agent replies in-thread on Slack (or as a Linear comment) with the PR link
- [ ] Follow-up messages sent to an active thread are injected before the next model call, not queued as a new task
- [ ] `pnpm alchemy:dev` in `apps/wodsmith-start` deploys Queue, QueueConsumer, DurableObjectNamespace, and Container resources without errors
- [ ] `pnpm cf-typegen` regenerates `worker-configuration.d.ts` with `AGENT_QUEUE`, `AGENT_SESSION`, and all new secret bindings correctly typed
- [ ] `pnpm type-check` passes in `apps/wodsmith-start`

## Pros and Cons of the Options

### Option A: Cloudflare-native stack

* Good, because single infrastructure provider — no new vendor accounts or billing relationships
* Good, because Durable Objects are the right primitive for long-running stateful sessions with message queuing
* Good, because Cloudflare Containers provide true Linux isolation at low cold-start cost
* Good, because existing Cloudflare KV session/auth patterns (ADR-0001) apply unchanged
* Neutral, because Containers is in open beta — API may change before GA
* Bad, because the Python agent runs inside a container, not a Worker — requires Docker image management

### Option B: Hybrid (Cloudflare webhooks + external sandbox)

* Good, because open-swe runs unchanged without a Cloudflare fork
* Good, because Modal/Daytona/LangGraph Cloud are production-proven
* Bad, because adds a second infrastructure vendor (Modal or Daytona) with separate billing, secrets, and dashboards
* Bad, because cross-vendor latency between Cloudflare Worker (webhook) and external sandbox coordinator adds complexity
* Bad, because contradicts the team's infrastructure consolidation goal

### Option C: Fully external (Fly.io / Cloud Run)

* Good, because open-swe deploys with zero modification — `docker build && docker push`
* Bad, because requires operating a non-Cloudflare host, contradicting ADR-0001's Cloudflare-native principle
* Bad, because webhook latency is tied to the external host's region, not edge-global
* Bad, because secrets must be duplicated across Cloudflare and the external host

## More Information

- **Alchemy resources used**: `Queue`, `QueueConsumer`, `DurableObjectNamespace`, `Container` — all exported from `alchemy/cloudflare` in v0.82.2 (already installed). See `apps/wodsmith-start/alchemy.run.ts` for the established pattern all new resources must follow.
- **open-swe repository**: https://github.com/langchain-ai/open-swe — the reference implementation this ADR adapts
- **Cloudflare Containers docs**: https://developers.cloudflare.com/containers/ — beta product; check for API changes before implementation
- **Cloudflare AI Gateway**: https://developers.cloudflare.com/ai-gateway/ — optional Phase 5 addition
- **open-swe CUSTOMIZATION.md**: Documents the `SandboxBackendProtocol` interface that `CloudflareContainerSandbox` must implement
- **Revisit conditions**: If Cloudflare Containers does not reach GA or changes its Durable Object integration significantly before implementation begins, re-evaluate Option B as a fallback. If the team adopts a TypeScript-native agent framework (e.g., Vercel AI SDK agent loop), the Python container requirement can be dropped and the entire agent can run as a Worker.
- **Related ADRs**: ADR-0001 (Cloudflare-native deployment) is the foundation this decision extends

import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { Agent, callable } from "agents"
import { generateText, stepCountIs, type Tool, tool } from "ai"
import { createAiGateway } from "ai-gateway-provider"
import { createUnified } from "ai-gateway-provider/providers/unified"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { type AgentImportRun, agentImportRunsTable } from "@/db/schema"
import { logError, logInfo } from "@/lib/logging"
import {
  type ParsedFile,
  renderParsedForModel,
} from "@/lib/organizer-file-import/parse"
import {
  type ActivityEntry,
  type AgentState,
  askClarificationInputSchema,
  type EventProposal,
  initialAgentState,
  MAX_THINKING_LOG_ENTRIES,
  markCompleteInputSchema,
  markImportAppliedInputSchema,
  proposeEventCreateInputSchema,
  proposeEventUpdateInputSchema,
  proposeVolunteerInputSchema,
  refineImportInputSchema,
  revokeProposalInputSchema,
  startImportInputSchema,
  type VolunteerProposal,
} from "@/lib/organizer-file-import/schemas"
import {
  type ExistingEvent,
  type ExistingVolunteer,
  reconcileVolunteerProposal,
} from "@/lib/organizer-file-import/validate"
import { requireFileImportAgentAccess } from "@/server/organizer-file-import/access"
import {
  loadExistingEvents,
  loadExistingVolunteers,
  readImportFile,
} from "@/server/organizer-file-import/context"

const MODEL_ID = "workers-ai/@cf/moonshotai/kimi-k2.6"
const MAX_STEPS = 24

interface ImportContext {
  run: AgentImportRun
  parsed: ParsedFile
  existingVolunteers: ExistingVolunteer[]
  existingEvents: ExistingEvent[]
}

/**
 * Durable-Object-backed agent that reads a dropped file and drafts import
 * proposals for organizer review. It is PROPOSAL-ONLY: it classifies, extracts,
 * validates, and proposes, streaming each proposal into `state` over the
 * WebSocket. It never writes to the database — that happens only when the
 * organizer confirms, through `applyOrganizerImportFn`.
 *
 * Instance name is `${importRunId}__${userId}` (see server.ts auth), so each
 * dropped file is an isolated agent and a reconnecting tab resumes the stream.
 *
 * @see src/routes/api/agent-import/upload.ts
 * @see src/server-fns/organizer-file-import-fns.ts
 */
export class OrganizerFileImportAgent extends Agent<Env, AgentState> {
  initialState: AgentState = initialAgentState

  #abortController: AbortController | null = null

  logActivity(kind: ActivityEntry["kind"], message: string): void {
    const entry: ActivityEntry = {
      id: createId(),
      timestamp: Date.now(),
      kind,
      message,
    }
    const next = [...this.state.thinkingLog, entry]
    const trimmed =
      next.length > MAX_THINKING_LOG_ENTRIES
        ? next.slice(next.length - MAX_THINKING_LOG_ENTRIES)
        : next
    this.setState({ ...this.state, thinkingLog: trimmed })
  }

  @callable()
  async start(rawInput: unknown): Promise<{ ok: boolean; error?: string }> {
    const runStartedAt = Date.now()
    try {
      const input = startImportInputSchema.parse(rawInput)
      const userId = getUserIdFromAgentName(this.name)
      const scope = await requireFileImportAgentAccess(
        {
          competitionId: input.competitionId,
          routeKind: input.routeKind,
          eventId: input.eventId,
        },
        userId,
      )

      this.setState({
        ...initialAgentState,
        importRunId: input.importRunId,
        routeKind: input.routeKind,
        status: "parsing",
        startedAt: Date.now(),
      })
      this.logActivity("thinking", "Reading the dropped file…")

      const ctx = await this.loadContext(input.importRunId, scope, userId)
      if (ctx.parsed.warnings.length > 0) {
        this.setState({ ...this.state, parseWarnings: ctx.parsed.warnings })
      }
      this.setState({ ...this.state, status: "thinking" })
      this.logActivity("thinking", describeParsed(ctx.parsed, input.routeKind))

      await this.runModel(buildKickoffPrompt(input.routeKind, ctx), input, ctx)

      if (this.state.status !== "proposals_ready") {
        this.setState({
          ...this.state,
          status: "proposals_ready",
          completedAt: Date.now(),
        })
      }
      logInfo({
        message: "[FileImportAgent] start finished",
        attributes: {
          importRunId: input.importRunId,
          durationMs: Date.now() - runStartedAt,
          volunteerProposals: this.state.volunteerProposals.length,
          eventProposals: this.state.eventProposals.length,
        },
      })
      return { ok: true }
    } catch (err) {
      return this.handleRunError(err, runStartedAt)
    } finally {
      this.#abortController = null
    }
  }

  @callable()
  async refine(rawInput: unknown): Promise<{ ok: boolean; error?: string }> {
    const runStartedAt = Date.now()
    try {
      const { instruction } = refineImportInputSchema.parse(rawInput)
      const importRunId = this.state.importRunId
      const routeKind = this.state.routeKind
      if (!importRunId || !routeKind) {
        return { ok: false, error: "No active import to refine" }
      }
      const userId = getUserIdFromAgentName(this.name)
      // loadContextForRefine re-authorizes from the run row itself, which is
      // the source of truth for competitionId/eventId (the client can't move it).
      const ctx = await this.loadContextForRefine(importRunId, userId)
      if (!ctx) {
        return { ok: false, error: "Import run not found" }
      }

      this.setState({ ...this.state, status: "thinking" })
      this.logActivity("thinking", `Refining: "${instruction}"`)

      await this.runModel(
        buildRefinePrompt(routeKind, ctx, this.state, instruction),
        { routeKind },
        ctx,
      )

      this.setState({
        ...this.state,
        status: "proposals_ready",
        completedAt: Date.now(),
      })
      return { ok: true }
    } catch (err) {
      return this.handleRunError(err, runStartedAt)
    } finally {
      this.#abortController = null
    }
  }

  @callable()
  stop(): { ok: boolean; running: boolean } {
    if (!this.#abortController) {
      return { ok: false, running: false }
    }
    this.#abortController.abort()
    return { ok: true, running: true }
  }

  @callable()
  reset(): { ok: true } {
    this.setState({ ...initialAgentState })
    return { ok: true }
  }

  /**
   * Drop the given proposals from the review surface after the organizer's
   * confirm has persisted them (via applyOrganizerImportFn). The DB run row +
   * receipt are the durable record; agent state only holds pending work.
   */
  @callable()
  markApplied(rawInput: unknown): { ok: true; appliedCount: number } {
    const input = markImportAppliedInputSchema.parse(rawInput)
    const applied = new Set(input.proposalIds)
    this.setState({
      ...this.state,
      volunteerProposals: this.state.volunteerProposals.filter(
        (p) => !applied.has(p.proposalId),
      ),
      eventProposals: this.state.eventProposals.filter(
        (p) => !applied.has(p.proposalId),
      ),
    })
    this.logActivity(
      "done",
      `Organizer confirmed ${input.proposalIds.length} change${
        input.proposalIds.length === 1 ? "" : "s"
      }.`,
    )
    return { ok: true, appliedCount: input.proposalIds.length }
  }

  // --------------------------------------------------------------------------
  // internals
  // --------------------------------------------------------------------------

  private async loadContext(
    importRunId: string,
    scope: { competitionTeamId: string | null; competitionId: string },
    _userId: string,
  ): Promise<ImportContext> {
    const run = await loadRun(importRunId)
    const parsed = await readImportFile(run)
    const [existingVolunteers, existingEvents] = await Promise.all([
      scope.competitionTeamId
        ? loadExistingVolunteers(scope.competitionTeamId)
        : Promise.resolve<ExistingVolunteer[]>([]),
      loadExistingEvents(scope.competitionId),
    ])
    return { run, parsed, existingVolunteers, existingEvents }
  }

  private async loadContextForRefine(
    importRunId: string,
    userId: string,
  ): Promise<ImportContext | null> {
    const run = await loadRun(importRunId).catch(() => null)
    if (!run) return null
    // Re-authorize from the run's own competition (the client can't move it).
    const scope = await requireFileImportAgentAccess(
      {
        competitionId: run.competitionId,
        routeKind: run.routeKind,
        eventId: run.eventId ?? undefined,
      },
      userId,
    )
    const parsed = await readImportFile(run)
    const [existingVolunteers, existingEvents] = await Promise.all([
      scope.competitionTeamId
        ? loadExistingVolunteers(scope.competitionTeamId)
        : Promise.resolve<ExistingVolunteer[]>([]),
      loadExistingEvents(scope.competitionId),
    ])
    return { run, parsed, existingVolunteers, existingEvents }
  }

  private async runModel(
    prompt: string,
    input: { routeKind: string },
    ctx: ImportContext,
  ): Promise<void> {
    const gatewayBinding = this.env.AI.gateway(this.env.CF_AIG_GATEWAY)
    const aiGateway = createAiGateway({
      binding: {
        run: (data) =>
          gatewayBinding.run(data as Parameters<typeof gatewayBinding.run>[0]),
      },
    })
    const unified = createUnified()
    this.#abortController = new AbortController()
    await generateText({
      model: aiGateway(unified(MODEL_ID)),
      system: buildSystemPrompt(input.routeKind),
      prompt,
      tools: buildTools(this, ctx),
      stopWhen: stepCountIs(MAX_STEPS),
      abortSignal: this.#abortController.signal,
    })
  }

  private handleRunError(
    err: unknown,
    runStartedAt: number,
  ): { ok: boolean; error?: string } {
    const message = err instanceof Error ? err.message : String(err)
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || message.toLowerCase().includes("abort"))
    if (isAbort) {
      this.logActivity("thinking", "Run stopped by organizer.")
      this.setState({
        ...this.state,
        status:
          this.state.volunteerProposals.length > 0 ||
          this.state.eventProposals.length > 0
            ? "proposals_ready"
            : "idle",
        completedAt: Date.now(),
      })
      return { ok: true }
    }
    this.logActivity("error", `Run failed: ${message}`)
    logError({
      message: "[FileImportAgent] run failed",
      error: err,
      attributes: { durationMs: Date.now() - runStartedAt },
    })
    this.setState({
      ...this.state,
      status: "error",
      errorMessage: message,
      completedAt: Date.now(),
    })
    return { ok: false, error: message }
  }
}

function getUserIdFromAgentName(name: string): string {
  const match = /^[a-z0-9_-]{1,128}__([a-z0-9_-]{1,128})$/i.exec(name)
  if (!match?.[1]) {
    throw new Error("Invalid agent name")
  }
  return match[1]
}

async function loadRun(importRunId: string): Promise<AgentImportRun> {
  const db = getDb()
  const run = await db.query.agentImportRunsTable.findFirst({
    where: eq(agentImportRunsTable.id, importRunId),
  })
  if (!run) {
    throw new Error("Import run not found")
  }
  return run
}

function isVolunteerRoute(routeKind: string): boolean {
  return routeKind === "volunteers" || routeKind === "judges"
}

function describeParsed(parsed: ParsedFile, routeKind: string): string {
  if (parsed.kind === "table") {
    return `Parsed ${parsed.rowCount} row${parsed.rowCount === 1 ? "" : "s"} with columns: ${parsed.headers.join(", ")}.`
  }
  return `Parsed ${parsed.text.length} characters of text for ${routeKind}.`
}

function buildSystemPrompt(routeKind: string): string {
  const intent = isVolunteerRoute(routeKind)
    ? `The organizer dropped this file on the ${routeKind === "judges" ? "Judges" : "Volunteers"} page. Treat it as a roster of people to invite as volunteers${routeKind === "judges" ? " (default their role to judge unless the file says otherwise)" : ""}.`
    : `The organizer dropped this file on the ${routeKind === "event_detail" ? "event detail" : "Events"} page. Treat it as event/workout information to create or update.`

  return `You are an import assistant for a fitness-competition organizer tool. ${intent}

STRICT RULES:
- You ONLY propose changes. You NEVER create, invite, update, or send anything. Never claim you have saved or sent anything — the organizer reviews your proposals and confirms separately.
- Start by calling get_import_file once, then get_existing_volunteers and/or get_existing_events as relevant, so you can match against what already exists.
- Emit one proposal per row via the propose_* tools. Use a fresh proposalId per proposal ("p1", "p2", …) and set rowKey to a stable identifier from the source row (prefer the email; else the name).
- The system attaches duplicate/match info and warnings automatically — still set a concise, specific rationale (≤240 chars) and a confidence ('high'|'medium'|'low').
- If the file's contents clearly do NOT match this page (e.g. a volunteer roster dropped on the Events page), call ask_clarification ONCE describing the mismatch and suggesting the right page, then stop.
- When every row has a proposal, call mark_complete with a 1-2 sentence summary. Do not invent rows that aren't in the file.`
}

function buildKickoffPrompt(routeKind: string, ctx: ImportContext): string {
  const lines = [
    `Route: ${routeKind}.`,
    isVolunteerRoute(routeKind)
      ? `There are ${ctx.existingVolunteers.length} existing volunteers/invites to match against.`
      : `There are ${ctx.existingEvents.length} existing events to match against.`,
    "",
    "FILE CONTENTS:",
    renderParsedForModel(ctx.parsed),
    "",
    "Begin by calling get_import_file, then the relevant get_existing_* tool.",
  ]
  return lines.join("\n")
}

function buildRefinePrompt(
  routeKind: string,
  ctx: ImportContext,
  state: AgentState,
  instruction: string,
): string {
  const current = isVolunteerRoute(routeKind)
    ? JSON.stringify(
        state.volunteerProposals.map((p) => ({
          proposalId: p.proposalId,
          name: p.name,
          email: p.email,
          roleTypes: p.roleTypes,
          action: p.action,
        })),
      )
    : JSON.stringify(
        state.eventProposals.map((p) => ({
          proposalId: p.proposalId,
          name: p.name,
          action: p.action,
        })),
      )
  return [
    `The organizer wants to refine the current draft with this instruction:`,
    `"${instruction}"`,
    "",
    `Current proposals: ${current}`,
    "",
    "FILE CONTENTS (for reference):",
    renderParsedForModel(ctx.parsed),
    "",
    "Use revoke_proposal to drop proposals that no longer fit, and re-emit updated proposals via the propose_* tools. Reuse the same proposalId when updating an existing one. Call mark_complete when done.",
  ].join("\n")
}

function buildTools(
  agent: OrganizerFileImportAgent,
  ctx: ImportContext,
): Record<string, Tool> {
  return {
    get_import_file: tool({
      description:
        "Return the parsed contents of the dropped file (columns + rows, or text). Call once at the start.",
      inputSchema: z.object({}),
      execute: async () => {
        agent.logActivity("tool", "Inspecting the dropped file.")
        if (ctx.parsed.kind === "table") {
          return {
            kind: "table" as const,
            headers: ctx.parsed.headers,
            rowCount: ctx.parsed.rowCount,
            rows: ctx.parsed.rows.slice(0, 200),
          }
        }
        return { kind: "text" as const, text: ctx.parsed.text.slice(0, 12_000) }
      },
    }),

    get_existing_volunteers: tool({
      description:
        "Return existing volunteers and pending invitations for this competition, so you can detect duplicates (match on email).",
      inputSchema: z.object({}),
      execute: async () => {
        agent.logActivity(
          "tool",
          `Loaded ${ctx.existingVolunteers.length} existing volunteers/invites.`,
        )
        return ctx.existingVolunteers.map((v) => ({
          email: v.email,
          name: v.name,
          kind: v.isInvite ? "invite" : "member",
        }))
      },
    }),

    get_existing_events: tool({
      description:
        "Return existing events for this competition, so you can target updates and avoid duplicate creates.",
      inputSchema: z.object({}),
      execute: async () => {
        agent.logActivity(
          "tool",
          `Loaded ${ctx.existingEvents.length} existing events.`,
        )
        return ctx.existingEvents
      },
    }),

    propose_volunteer: tool({
      description:
        "Propose importing ONE volunteer from a file row. The system attaches duplicate/match info and warnings (e.g. missing email) automatically.",
      inputSchema: proposeVolunteerInputSchema,
      execute: async (input) => {
        const base: VolunteerProposal = {
          ...input,
          matchKind: "new",
          matchedMembershipId: null,
          status: "pending",
        }
        const reconciled = reconcileVolunteerProposal(
          base,
          ctx.existingVolunteers,
        )
        const next = agent.state.volunteerProposals.filter(
          (p) => p.proposalId !== reconciled.proposalId,
        )
        next.push(reconciled)
        agent.setState({ ...agent.state, volunteerProposals: next })
        agent.logActivity(
          reconciled.matchKind === "new" ? "proposed" : "skipped",
          summarizeVolunteer(reconciled),
        )
        return {
          status: "recorded" as const,
          action: reconciled.action,
          matchKind: reconciled.matchKind,
          warnings: reconciled.warnings,
        }
      },
    }),

    propose_event_create: tool({
      description: "Propose creating ONE new event/workout from the file.",
      inputSchema: proposeEventCreateInputSchema,
      execute: async (input) => {
        const proposal: EventProposal = {
          ...input,
          targetTrackWorkoutId: null,
          changedFields: {},
          status: "pending",
        }
        pushEvent(agent, proposal)
        agent.logActivity("proposed", `Create event "${proposal.name}".`)
        return { status: "recorded" as const }
      },
    }),

    propose_event_update: tool({
      description:
        "Propose updating ONE existing event. targetTrackWorkoutId must come from get_existing_events; put each change in changedFields as {before, after}.",
      inputSchema: proposeEventUpdateInputSchema,
      execute: async (input) => {
        const known = ctx.existingEvents.some(
          (e) => e.trackWorkoutId === input.targetTrackWorkoutId,
        )
        if (!known) {
          agent.logActivity(
            "skipped",
            `Skipped update for unknown event ${input.targetTrackWorkoutId}.`,
          )
          return {
            status: "rejected" as const,
            reason: "targetTrackWorkoutId is not an event in this competition",
          }
        }
        const proposal: EventProposal = { ...input, status: "pending" }
        pushEvent(agent, proposal)
        agent.logActivity("proposed", `Update event "${proposal.name}".`)
        return { status: "recorded" as const }
      },
    }),

    revoke_proposal: tool({
      description: "Withdraw a previously emitted proposal by id.",
      inputSchema: revokeProposalInputSchema,
      execute: async (input) => {
        agent.setState({
          ...agent.state,
          volunteerProposals: agent.state.volunteerProposals.filter(
            (p) => p.proposalId !== input.proposalId,
          ),
          eventProposals: agent.state.eventProposals.filter(
            (p) => p.proposalId !== input.proposalId,
          ),
        })
        agent.logActivity(
          "thinking",
          `Withdrew ${input.proposalId} — ${input.reason}`,
        )
        return { status: "revoked" as const }
      },
    }),

    ask_clarification: tool({
      description:
        "Use ONCE when the file's contents don't match this page. Describe the mismatch and suggest the right page, then stop.",
      inputSchema: askClarificationInputSchema,
      execute: async (input) => {
        agent.setState({
          ...agent.state,
          clarification: {
            question: input.question,
            suggestedRouteKind: input.suggestedRouteKind,
          },
        })
        agent.logActivity("thinking", `Needs clarification: ${input.question}`)
        return { status: "asked" as const }
      },
    }),

    mark_complete: tool({
      description:
        "Mark the run finished with a 1-2 sentence summary for the organizer.",
      inputSchema: markCompleteInputSchema,
      execute: async (input) => {
        agent.setState({
          ...agent.state,
          status: "proposals_ready",
          summary: input.summary,
          completedAt: Date.now(),
        })
        agent.logActivity("done", input.summary)
        return { status: "complete" as const }
      },
    }),
  }
}

function pushEvent(agent: OrganizerFileImportAgent, proposal: EventProposal) {
  const next = agent.state.eventProposals.filter(
    (p) => p.proposalId !== proposal.proposalId,
  )
  next.push(proposal)
  agent.setState({ ...agent.state, eventProposals: next })
}

function summarizeVolunteer(p: VolunteerProposal): string {
  const who = p.name ?? p.email ?? p.rowKey
  if (p.matchKind === "existing_member") return `${who} is already a volunteer.`
  if (p.matchKind === "existing_invite") return `${who} already has an invite.`
  if (p.action === "needs_input") return `${who} — needs an email to invite.`
  const roles = p.roleTypes.length > 0 ? ` as ${p.roleTypes.join(", ")}` : ""
  return `Invite ${who}${roles}.`
}

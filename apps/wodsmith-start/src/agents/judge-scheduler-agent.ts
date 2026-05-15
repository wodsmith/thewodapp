import "server-only"

import { Agent, callable } from "agents"
import { generateText, stepCountIs, type Tool, tool } from "ai"
import { createAiGateway } from "ai-gateway-provider"
import { createUnified } from "ai-gateway-provider/providers/unified"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schema"
import { createId } from "@paralleldrive/cuid2"
import {
  type ActivityEntry,
  type AgentState,
  type EventContextDto,
  initialAgentState,
  type JudgeRosterEntry,
  markCompleteInputSchema,
  MAX_THINKING_LOG_ENTRIES,
  type PriorRotationExample,
  proposeRotationInputSchema,
  revokeProposalInputSchema,
  startSchedulingInputSchema,
} from "@/lib/judge-scheduler/schemas"
import {
  computeCoverageFromProposals,
  validateProposal,
} from "@/lib/judge-scheduler/tools"
import { logError, logInfo, logWarning } from "@/lib/logging"
import { hasFeature } from "@/server/entitlements"
import {
  loadEventContext,
  loadJudgeRoster,
  loadPriorRotations,
} from "@/server/judge-scheduler/context"

/**
 * Cloudflare Workers AI model id, addressed via the AI Gateway. The gateway
 * provider's `unified` adapter takes `<provider>/<model>` strings, so for
 * Workers AI we prefix the standard `@cf/...` slug with `workers-ai/`.
 */
const MODEL_ID = "workers-ai/@cf/moonshotai/kimi-k2.5"
const MAX_STEPS = 24

const SYSTEM_PROMPT = `You are an assistant that drafts judge rotations for a single Functional Fitness-style competition workout.

Your goal: cover every (heat, lane) slot once with a judge from the available roster, while respecting their stated availability and credentials as soft preferences.

Rules:
- Always start by calling get_event_context, get_judge_roster, and get_prior_rotations once each. Use prior rotations as a style guide for heatsCount and laneShiftPattern.
- Emit one proposal at a time via propose_rotation. Generate a fresh proposalId per proposal (e.g. "p1", "p2"). The system streams each proposal to the organizer as you call it, so they see your work in real time.
- HARD rules (will be rejected if violated):
  - startingLane must be <= the laneCount of every heat in the rotation. If a heat has 5 lanes, never propose lane 6. Coverage targets only existing (heat, lane) slots returned by get_event_context.
  - membershipId must come from get_judge_roster.
  - startingHeat + heatsCount - 1 must be <= totalHeats.
- Prefer the event's defaultHeatsPerRotation and defaultLaneShiftPattern unless prior rotations or coverage gaps suggest otherwise.
- Treat availability ('morning' / 'afternoon' / 'all_day') and minHeatBuffer as SOFT rules. If you must violate them to fill the schedule, set confidence='low' and list the specific violations in softViolations[]. Never silently break preferences.
- After every 3-5 proposals, call check_coverage to inspect gaps and overlaps. Adjust subsequent proposals to fill gaps and avoid overlaps.
- When every (heat, lane) slot from get_event_context has been proposed once, STOP and call mark_complete with a 1-2 sentence summary. Do not invent extra slots.
- Do NOT call propose_rotation for the same membershipId+startingHeat twice. If you change your mind, call revoke_proposal first.
- Keep rationale strings under 240 characters, concrete and judge-specific. Avoid filler.`

interface BuildContextResult {
  eventContext: EventContextDto
  roster: JudgeRosterEntry[]
  priors: PriorRotationExample[]
}

/**
 * Durable-Object-backed agent that drafts judge rotations for one event.
 *
 * The agent's `state.proposals` array is the source of truth the UI watches —
 * each tool call that emits or revokes a proposal triggers a setState which
 * the agents library broadcasts to every connected client over WebSocket.
 *
 * Lifecycle: client calls `start({trackWorkoutId, competitionId, reset})`
 * → agent loads context → runs an LLM loop with intent-based tools →
 * marks state.status = "done" when finished.
 */
export class JudgeSchedulerAgent extends Agent<Env, AgentState> {
  initialState: AgentState = initialAgentState

  /**
   * Append an entry to the activity log and broadcast via setState. The log
   * is capped at MAX_THINKING_LOG_ENTRIES — older entries are dropped so DO
   * storage doesn't grow unboundedly across long runs.
   */
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
    const input = startSchedulingInputSchema.parse(rawInput)

    logInfo({
      message: "[JudgeAgent] start invoked",
      attributes: {
        trackWorkoutId: input.trackWorkoutId,
        competitionId: input.competitionId,
        reset: input.reset,
      },
    })

    // Defense in depth: the UI page already gates by hasFeature, but the
    // agent's @callable() endpoint is reachable directly over WebSocket so
    // we re-verify the organizing team has the AI_JUDGE_SCHEDULING feature
    // before burning Workers AI tokens.
    const organizingTeamId = await resolveOrganizingTeamId(input.competitionId)
    const entitled = await hasFeature(
      organizingTeamId,
      FEATURES.AI_JUDGE_SCHEDULING,
    )
    if (!entitled) {
      const msg =
        "Your plan does not include AI Judge Scheduling. Ask an admin to enable it."
      logWarning({
        message: "[JudgeAgent] entitlement check failed",
        attributes: {
          organizingTeamId,
          feature: FEATURES.AI_JUDGE_SCHEDULING,
        },
      })
      this.setState({
        ...this.state,
        status: "error",
        errorMessage: msg,
        completedAt: Date.now(),
      })
      return { ok: false, error: msg }
    }

    this.setState({
      trackWorkoutId: input.trackWorkoutId,
      status: "thinking",
      proposals: input.reset ? [] : this.state.proposals,
      thinkingLog: input.reset ? [] : this.state.thinkingLog,
      summary: null,
      errorMessage: null,
      startedAt: Date.now(),
      completedAt: null,
    })
    this.logActivity("thinking", "Starting scheduling run…")

    const runStartedAt = Date.now()
    try {
      const ctx = await loadAllContext(input)
      this.logActivity(
        "thinking",
        `Loaded context: ${ctx.eventContext.totalHeats} heats, ${ctx.roster.length} eligible judges, ${ctx.priors.length} prior rotations.`,
      )
      logInfo({
        message: "[JudgeAgent] context loaded",
        attributes: {
          trackWorkoutId: input.trackWorkoutId,
          totalHeats: ctx.eventContext.totalHeats,
          rosterSize: ctx.roster.length,
          priorRotations: ctx.priors.length,
        },
      })
      const tools = buildTools(this, ctx)

      // Route all AI traffic through the Cloudflare AI Gateway so we get
      // logs/analytics/caching in the dashboard and a single integration
      // point for adding non-CF providers later (OpenAI, Anthropic, etc).
      console.log(this.env)
      const aiGateway = createAiGateway({
        accountId: this.env.CF_ACCOUNT_ID,
        gateway: this.env.CF_AIG_GATEWAY,
        apiKey: this.env.CF_AIG_TOKEN,
      })
      const unified = createUnified()
      const result = await generateText({
        model: aiGateway(unified(MODEL_ID)),
        system: SYSTEM_PROMPT,
        prompt: buildKickoffPrompt(ctx),
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
      })

      logInfo({
        message: "[JudgeAgent] generateText finished",
        attributes: {
          trackWorkoutId: input.trackWorkoutId,
          durationMs: Date.now() - runStartedAt,
          proposalCount: this.state.proposals.length,
          stepCount: result.steps?.length ?? 0,
          finishReason: result.finishReason,
          status: this.state.status,
        },
      })

      if (this.state.status !== "done") {
        this.setState({
          ...this.state,
          status: "done",
          summary: result.text || this.state.summary || "Done.",
          completedAt: Date.now(),
        })
        this.logActivity(
          "done",
          result.text || this.state.summary || "Finished without summary.",
        )
      }

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logActivity("error", `Run failed: ${message}`)
      logError({
        message: "[JudgeAgent] start failed",
        error: err,
        attributes: {
          trackWorkoutId: input.trackWorkoutId,
          durationMs: Date.now() - runStartedAt,
          proposalCount: this.state.proposals.length,
        },
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

  /**
   * Allow the organizer to manually clear all proposals and reset the agent
   * without starting a new run (e.g. before retrying with different settings).
   */
  @callable()
  reset(): { ok: true } {
    this.setState({ ...initialAgentState })
    return { ok: true }
  }
}

async function loadAllContext(input: {
  trackWorkoutId: string
  competitionId: string
}): Promise<BuildContextResult> {
  const [eventContext, roster, priors] = await Promise.all([
    loadEventContext(input.trackWorkoutId),
    loadJudgeRoster(input.competitionId),
    loadPriorRotations(input.competitionId, input.trackWorkoutId, 12),
  ])
  return { eventContext, roster, priors }
}

async function resolveOrganizingTeamId(competitionId: string): Promise<string> {
  const db = getDb()
  const [row] = await db
    .select({ organizingTeamId: competitionsTable.organizingTeamId })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
  if (!row) {
    throw new Error(`Competition not found: ${competitionId}`)
  }
  return row.organizingTeamId
}

function buildKickoffPrompt(ctx: BuildContextResult): string {
  const judgeCount = ctx.roster.length
  const slotCount = ctx.eventContext.heats.reduce(
    (acc, h) =>
      acc + (h.occupiedLanes.length > 0 ? h.occupiedLanes.length : h.laneCount),
    0,
  )
  return [
    `Schedule judges for "${ctx.eventContext.workoutName}".`,
    `${ctx.eventContext.totalHeats} heats, ~${slotCount} lane-slots, ${judgeCount} eligible judges.`,
    `Default rotation length: ${ctx.eventContext.defaultHeatsPerRotation} heats; default lane pattern: ${ctx.eventContext.defaultLaneShiftPattern}.`,
    `Begin by calling get_event_context, get_judge_roster, then get_prior_rotations.`,
  ].join("\n")
}

function buildTools(
  agent: JudgeSchedulerAgent,
  ctx: BuildContextResult,
): Record<string, Tool> {
  const { eventContext, roster, priors } = ctx

  const trackWorkoutId = eventContext.trackWorkoutId

  return {
    get_event_context: tool({
      description:
        "Return the heats, lanes, occupancy, and event defaults for the workout being scheduled. Call once per run.",
      inputSchema: z.object({}),
      execute: async () => {
        agent.logActivity(
          "tool",
          `Inspecting event setup — ${eventContext.heats.length} heats, default ${eventContext.defaultHeatsPerRotation}-heat rotations.`,
        )
        logInfo({
          message: "[JudgeAgent.tool] get_event_context",
          attributes: { trackWorkoutId, heats: eventContext.heats.length },
        })
        return eventContext
      },
    }),

    get_judge_roster: tool({
      description:
        "Return all eligible judges with their availability ('morning' | 'afternoon' | 'all_day' | null), credentials, and current rotation count. Call once per run.",
      inputSchema: z.object({}),
      execute: async () => {
        agent.logActivity(
          "tool",
          `Reviewing roster — ${roster.length} judges available.`,
        )
        logInfo({
          message: "[JudgeAgent.tool] get_judge_roster",
          attributes: { trackWorkoutId, rosterSize: roster.length },
        })
        return roster
      },
    }),

    get_prior_rotations: tool({
      description:
        "Return up to 12 recent rotations from other workouts in the same competition. Use them as a style guide for heatsCount and laneShiftPattern.",
      inputSchema: z.object({}),
      execute: async () => {
        agent.logActivity(
          "tool",
          priors.length > 0
            ? `Studying ${priors.length} prior rotation${priors.length === 1 ? "" : "s"} for pattern cues.`
            : "No prior rotations to reference — starting from scratch.",
        )
        logInfo({
          message: "[JudgeAgent.tool] get_prior_rotations",
          attributes: { trackWorkoutId, count: priors.length },
        })
        return priors
      },
    }),

    propose_rotation: tool({
      description:
        "Emit ONE rotation proposal. The organizer sees it stream in immediately. Set confidence='low' and fill softViolations[] when overriding a soft preference.",
      inputSchema: proposeRotationInputSchema,
      execute: async (input) => {
        const { violations } = validateProposal({
          proposal: input,
          context: eventContext,
          roster,
          existingProposals: agent.state.proposals,
        })
        const hardViolations = violations.filter(
          (v) =>
            v.startsWith("Starting lane ") ||
            v.startsWith("Unknown membershipId") ||
            v.startsWith("Rotation runs past"),
        )
        const judge = roster.find((j) => j.membershipId === input.membershipId)
        const judgeLabel = judge?.name ?? input.membershipId
        const lastHeat = input.startingHeat + input.heatsCount - 1
        const slotLabel =
          input.heatsCount === 1
            ? `H${input.startingHeat} L${input.startingLane}`
            : `H${input.startingHeat}–H${lastHeat} L${input.startingLane}`

        if (hardViolations.length > 0) {
          agent.logActivity(
            "rejected",
            `Skipped ${judgeLabel} at ${slotLabel}: ${hardViolations.join("; ")}`,
          )
          logWarning({
            message: "[JudgeAgent.tool] propose_rotation rejected",
            attributes: {
              trackWorkoutId,
              proposalId: input.proposalId,
              membershipId: input.membershipId,
              startingHeat: input.startingHeat,
              startingLane: input.startingLane,
              heatsCount: input.heatsCount,
              hardViolations: hardViolations.join(" | "),
            },
          })
          return {
            status: "rejected" as const,
            hardViolations,
          }
        }
        const softViolations = violations.filter(
          (v) => !hardViolations.includes(v),
        )
        const merged = {
          ...input,
          softViolations: dedupeStrings([
            ...softViolations,
            ...input.softViolations,
          ]),
        }
        const next = agent.state.proposals.filter(
          (p) => p.proposalId !== merged.proposalId,
        )
        next.push(merged)
        agent.setState({ ...agent.state, proposals: next })
        const violationsSuffix =
          merged.softViolations.length > 0
            ? ` (with ${merged.softViolations.length} soft warning${merged.softViolations.length === 1 ? "" : "s"})`
            : ""
        agent.logActivity(
          "accepted",
          `Proposed ${judgeLabel} at ${slotLabel}${violationsSuffix}.`,
        )
        logInfo({
          message: "[JudgeAgent.tool] propose_rotation recorded",
          attributes: {
            trackWorkoutId,
            proposalId: input.proposalId,
            membershipId: input.membershipId,
            startingHeat: input.startingHeat,
            startingLane: input.startingLane,
            heatsCount: input.heatsCount,
            confidence: input.confidence,
            softViolationCount: merged.softViolations.length,
            totalProposals: next.length,
          },
        })
        return {
          status: "recorded" as const,
          autoDetectedViolations: softViolations,
        }
      },
    }),

    revoke_proposal: tool({
      description:
        "Withdraw a previously emitted proposal by id. Use when reconsidering.",
      inputSchema: revokeProposalInputSchema,
      execute: async (input) => {
        const before = agent.state.proposals.length
        const next = agent.state.proposals.filter(
          (p) => p.proposalId !== input.proposalId,
        )
        agent.setState({ ...agent.state, proposals: next })
        agent.logActivity(
          "thinking",
          `Withdrew proposal ${input.proposalId} — ${input.reason}`,
        )
        logInfo({
          message: "[JudgeAgent.tool] revoke_proposal",
          attributes: {
            trackWorkoutId,
            proposalId: input.proposalId,
            reason: input.reason,
            removed: before - next.length,
            remaining: next.length,
          },
        })
        return { status: "revoked" as const, reason: input.reason }
      },
    }),

    check_coverage: tool({
      description:
        "Inspect coverage of the current proposal set. Returns gaps and overlaps so you can plug holes.",
      inputSchema: z.object({}),
      execute: async () => {
        const coverage = computeCoverageFromProposals(
          agent.state.proposals,
          eventContext,
        )
        const gapCount = coverage.gaps?.length ?? 0
        const overlapCount = coverage.overlaps?.length ?? 0
        agent.logActivity(
          "tool",
          gapCount === 0 && overlapCount === 0
            ? `Coverage check: ${coverage.coveragePercent}% — no gaps or overlaps.`
            : `Coverage check: ${coverage.coveragePercent}% covered, ${gapCount} gap${gapCount === 1 ? "" : "s"}, ${overlapCount} overlap${overlapCount === 1 ? "" : "s"}.`,
        )
        logInfo({
          message: "[JudgeAgent.tool] check_coverage",
          attributes: {
            trackWorkoutId,
            proposals: agent.state.proposals.length,
            gaps: gapCount,
            overlaps: overlapCount,
          },
        })
        return coverage
      },
    }),

    mark_complete: tool({
      description:
        "Mark the run finished with a 1-2 sentence summary for the organizer.",
      inputSchema: markCompleteInputSchema,
      execute: async (input) => {
        agent.setState({
          ...agent.state,
          status: "done",
          summary: input.summary,
          completedAt: Date.now(),
        })
        agent.logActivity("done", input.summary)
        logInfo({
          message: "[JudgeAgent.tool] mark_complete",
          attributes: {
            trackWorkoutId,
            proposalCount: agent.state.proposals.length,
            summary: input.summary.slice(0, 200),
          },
        })
        return { status: "complete" as const }
      },
    }),
  }
}

function dedupeStrings(input: string[]): string[] {
  return Array.from(new Set(input))
}

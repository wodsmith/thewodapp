import "server-only"

import { env } from "cloudflare:workers"
import { createOpenAI } from "@ai-sdk/openai"
import { Agent, callable } from "agents"
import { generateText, stepCountIs, type Tool, tool } from "ai"
import { z } from "zod"
import {
  type AgentState,
  type EventContextDto,
  initialAgentState,
  type JudgeRosterEntry,
  markCompleteInputSchema,
  type PriorRotationExample,
  proposeRotationInputSchema,
  revokeProposalInputSchema,
  startSchedulingInputSchema,
} from "@/lib/judge-scheduler/schemas"
import {
  computeCoverageFromProposals,
  validateProposal,
} from "@/lib/judge-scheduler/tools"
import {
  loadEventContext,
  loadJudgeRoster,
  loadPriorRotations,
} from "@/server/judge-scheduler/context"

const MODEL_ID = "gpt-4o-mini"
const MAX_STEPS = 24

const SYSTEM_PROMPT = `You are an assistant that drafts judge rotations for a single CrossFit-style competition workout.

Your goal: cover every (heat, lane) slot once with a judge from the available roster, while respecting their stated availability and credentials as soft preferences.

Rules:
- Always start by calling get_event_context, get_judge_roster, and get_prior_rotations once each. Use prior rotations as a style guide for heatsCount and laneShiftPattern.
- Emit one proposal at a time via propose_rotation. Generate a fresh proposalId per proposal (e.g. "p1", "p2"). The system streams each proposal to the organizer as you call it, so they see your work in real time.
- Prefer the event's defaultHeatsPerRotation and defaultLaneShiftPattern unless prior rotations or coverage gaps suggest otherwise.
- Treat availability ('morning' / 'afternoon' / 'all_day') and minHeatBuffer as SOFT rules. If you must violate them to fill the schedule, set confidence='low' and list the specific violations in softViolations[]. Never silently break preferences.
- After every 3-5 proposals, call check_coverage to inspect gaps and overlaps. Adjust subsequent proposals to fill gaps and avoid overlaps.
- When coverage reaches 100% (or as close as the roster allows), call mark_complete with a 1-2 sentence summary.
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

  @callable()
  async start(rawInput: unknown): Promise<{ ok: boolean; error?: string }> {
    const input = startSchedulingInputSchema.parse(rawInput)

    this.setState({
      trackWorkoutId: input.trackWorkoutId,
      status: "thinking",
      proposals: input.reset ? [] : this.state.proposals,
      summary: null,
      errorMessage: null,
      startedAt: Date.now(),
      completedAt: null,
    })

    try {
      const ctx = await loadAllContext(input)
      const tools = buildTools(this, ctx)

      const result = await generateText({
        model: createOpenAI({ apiKey: env.OPENAI_API_KEY ?? "" })(MODEL_ID),
        system: SYSTEM_PROMPT,
        prompt: buildKickoffPrompt(ctx),
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
      })

      if (this.state.status !== "done") {
        this.setState({
          ...this.state,
          status: "done",
          summary: result.text || this.state.summary || "Done.",
          completedAt: Date.now(),
        })
      }

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
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

  return {
    get_event_context: tool({
      description:
        "Return the heats, lanes, occupancy, and event defaults for the workout being scheduled. Call once per run.",
      inputSchema: z.object({}),
      execute: async () => eventContext,
    }),

    get_judge_roster: tool({
      description:
        "Return all eligible judges with their availability ('morning' | 'afternoon' | 'all_day' | null), credentials, and current rotation count. Call once per run.",
      inputSchema: z.object({}),
      execute: async () => roster,
    }),

    get_prior_rotations: tool({
      description:
        "Return up to 12 recent rotations from other workouts in the same competition. Use them as a style guide for heatsCount and laneShiftPattern.",
      inputSchema: z.object({}),
      execute: async () => priors,
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
        })
        const merged = {
          ...input,
          softViolations: dedupeStrings([
            ...violations,
            ...input.softViolations,
          ]),
        }
        const next = agent.state.proposals.filter(
          (p) => p.proposalId !== merged.proposalId,
        )
        next.push(merged)
        agent.setState({ ...agent.state, proposals: next })
        return {
          status: "recorded" as const,
          autoDetectedViolations: violations,
        }
      },
    }),

    revoke_proposal: tool({
      description:
        "Withdraw a previously emitted proposal by id. Use when reconsidering.",
      inputSchema: revokeProposalInputSchema,
      execute: async (input) => {
        const next = agent.state.proposals.filter(
          (p) => p.proposalId !== input.proposalId,
        )
        agent.setState({ ...agent.state, proposals: next })
        return { status: "revoked" as const, reason: input.reason }
      },
    }),

    check_coverage: tool({
      description:
        "Inspect coverage of the current proposal set. Returns gaps and overlaps so you can plug holes.",
      inputSchema: z.object({}),
      execute: async () =>
        computeCoverageFromProposals(agent.state.proposals, eventContext),
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
        return { status: "complete" as const }
      },
    }),
  }
}

function dedupeStrings(input: string[]): string[] {
  return Array.from(new Set(input))
}

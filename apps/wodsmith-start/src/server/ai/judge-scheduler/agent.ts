import "server-only"

import {createOpenAI} from "@ai-sdk/openai"
import {Agent} from "@mastra/core/agent"
import {RequestContext} from "@mastra/core/request-context"
import {createTool} from "@mastra/core/tools"
import {z} from "zod"
import {getOpenAiApiKey} from "@/lib/env"
import {ProposalCollector} from "./collector"
import type {SchedulingContext} from "./types"

/**
 * RequestContext keys used to scope tool execution to a single event/run.
 * Tools always read from these keys instead of accepting cross-event identifiers
 * as inputs, which prevents the agent from poking at unrelated competitions.
 */
const CONTEXT_KEY = "scheduling_context"
const COLLECTOR_KEY = "proposal_collector"
const INSTRUCTIONS_KEY = "organizer_instructions"

interface AgentRequestContextValues {
  [CONTEXT_KEY]: SchedulingContext
  [COLLECTOR_KEY]: ProposalCollector
  [INSTRUCTIONS_KEY]: string | undefined
}

/**
 * Tool 1 — "What does the schedule currently look like?"
 *
 * The starting context (heats, existing rotations, coverage gaps) is also passed
 * inline in the system prompt, but exposing it as a tool lets the agent re-read
 * the latest snapshot after one or more proposeRotation calls have mutated it.
 */
const getEventSchedulingContext = createTool({
  id: "getEventSchedulingContext",
  description:
    "Inspect the current state of the event schedule: every heat (with lane count and which lanes have athletes), every rotation already placed, and the live coverage stats (gaps and overlaps). Call this before deciding which gaps to fill, and call it again after proposing rotations to see updated coverage.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    heats: z.array(
      z.object({
        heatNumber: z.number(),
        laneCount: z.number(),
        occupiedLanes: z.array(z.number()).optional(),
        scheduledTime: z.string().nullable(),
      }),
    ),
    rotations: z.array(
      z.object({
        id: z.string(),
        membershipId: z.string(),
        startingHeat: z.number(),
        startingLane: z.number(),
        heatsCount: z.number(),
        laneShiftPattern: z.string(),
      }),
    ),
    coverage: z.object({
      totalSlots: z.number(),
      coveredSlots: z.number(),
      coveragePercent: z.number(),
      gaps: z.array(
        z.object({heatNumber: z.number(), laneNumber: z.number()}),
      ),
      overlaps: z.array(
        z.object({heatNumber: z.number(), laneNumber: z.number()}),
      ),
    }),
    eventDefaults: z.object({minHeatBuffer: z.number()}),
  }),
  execute: async (_input, context) => {
    const ctx = context?.requestContext?.get(
      CONTEXT_KEY,
    ) as SchedulingContext
    return {
      heats: ctx.heats.map((h) => ({
        heatNumber: h.heatNumber,
        laneCount: h.laneCount,
        occupiedLanes: h.occupiedLanes
          ? Array.from(h.occupiedLanes)
          : undefined,
        scheduledTime: h.scheduledTime ? h.scheduledTime.toISOString() : null,
      })),
      rotations: ctx.rotations.map((r) => ({
        id: r.id,
        membershipId: r.membershipId,
        startingHeat: r.startingHeat,
        startingLane: r.startingLane,
        heatsCount: r.heatsCount,
        laneShiftPattern: r.laneShiftPattern,
      })),
      coverage: {
        totalSlots: ctx.coverage.totalSlots,
        coveredSlots: ctx.coverage.coveredSlots,
        coveragePercent: ctx.coverage.coveragePercent,
        gaps: ctx.coverage.gaps,
        overlaps: ctx.coverage.overlaps.map((o) => ({
          heatNumber: o.heatNumber,
          laneNumber: o.laneNumber,
        })),
      },
      eventDefaults: ctx.eventDefaults,
    }
  },
})

/**
 * Tool 2 — "Who can I assign?"
 *
 * Lists every judge eligible for this event with their availability, free-text
 * notes, credentials, and current load (rotation count). The agent uses this to
 * balance assignments and respect soft preferences.
 */
const getJudgeRoster = createTool({
  id: "getJudgeRoster",
  description:
    "List every judge available for this event. Each entry includes the judge's display name, availability bucket (morning / afternoon / all_day), free-text availability notes, credentials, and how many rotations they are already assigned to. Use this to balance load and to honor soft preferences before calling proposeRotation.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    judges: z.array(
      z.object({
        membershipId: z.string(),
        displayName: z.string(),
        availability: z.string().optional(),
        availabilityNotes: z.string().optional(),
        credentials: z.string().optional(),
        currentRotationCount: z.number(),
      }),
    ),
  }),
  execute: async (_input, context) => {
    const ctx = context?.requestContext?.get(
      CONTEXT_KEY,
    ) as SchedulingContext
    return {
      judges: ctx.judges.map((j) => ({
        membershipId: j.membershipId,
        displayName: j.displayName,
        availability: j.availability,
        availabilityNotes: j.availabilityNotes,
        credentials: j.credentials,
        currentRotationCount: j.currentRotationCount,
      })),
    }
  },
})

/**
 * Tool 3 — "Place this judge on this rotation pattern."
 *
 * The only "mutation" tool. Each call is validated against the current context;
 * accepted proposals are buffered (NOT written to the database) and treated as
 * occupying their slots for any subsequent proposals so the agent can build up
 * a coherent plan in one turn.
 *
 * Both `reason` and `confidence` are required so the organizer reviewing the
 * proposals always sees a justification and a quality signal.
 */
const proposeRotation = createTool({
  id: "proposeRotation",
  description:
    "Propose a single rotation to place a judge on a contiguous range of heats starting at a specific lane. The proposal is buffered for organizer review, not written to the database. Always include a one-sentence reason and a confidence rating (high / medium / low). Mark availability mismatches or aggressive load as low confidence so the organizer can spot weak suggestions.",
  inputSchema: z.object({
    membershipId: z.string().describe("Judge's team membership id."),
    startingHeat: z.number().int().min(1),
    startingLane: z.number().int().min(1),
    heatsCount: z.number().int().min(1),
    laneShiftPattern: z
      .enum(["stay", "shift_right"])
      .describe(
        "stay = same lane every heat. shift_right = lane advances by 1 each heat (wraps to lane 1).",
      ),
    reason: z
      .string()
      .min(1)
      .describe(
        "One sentence the organizer will see explaining why this rotation makes sense.",
      ),
    confidence: z
      .enum(["high", "medium", "low"])
      .describe(
        "Use 'low' for any soft-constraint violations like availability mismatches or judge already at high load.",
      ),
  }),
  outputSchema: z.union([
    z.object({accepted: z.literal(true), proposalId: z.string()}),
    z.object({
      accepted: z.literal(false),
      conflict: z.object({
        kind: z.string(),
        message: z.string(),
      }),
    }),
  ]),
  execute: async (input, context) => {
    const collector = context?.requestContext?.get(
      COLLECTOR_KEY,
    ) as ProposalCollector
    const result = collector.propose({
      membershipId: input.membershipId,
      startingHeat: input.startingHeat,
      startingLane: input.startingLane,
      heatsCount: input.heatsCount,
      laneShiftPattern: input.laneShiftPattern,
      reason: input.reason,
      confidence: input.confidence,
    })
    if (result.accepted) {
      return {accepted: true as const, proposalId: result.proposalId}
    }
    return {
      accepted: false as const,
      conflict: {
        kind: result.conflict.kind,
        message: result.conflict.message,
      },
    }
  },
})

const SYSTEM_INSTRUCTIONS = `
You are a judge-scheduling assistant for a CrossFit-style competition. Your job
is to propose rotations that fill gaps in the judge schedule for ONE event.

Hard rules:
- Use ONLY the judges returned by getJudgeRoster. Never invent membership ids.
- Each rotation places one judge on N consecutive heats starting at a specific
  lane. Choose laneShiftPattern='stay' unless rotating across lanes makes the
  schedule fairer (e.g. when a judge would otherwise sit on the same lane all day).
- Respect the heat buffer in eventDefaults: the same judge cannot judge two heats
  closer together than minHeatBuffer.
- Aim to close the largest gaps first, then balance load across judges.

Soft constraints (do NOT block, but mark confidence='low' and explain in reason):
- Availability mismatch: e.g. a 'morning' judge proposed on an afternoon heat.
- Judge already has many rotations relative to others.
- The organizer's free-text instructions ask to favor or avoid a particular judge.

Process:
1. Call getEventSchedulingContext and getJudgeRoster once at the start.
2. Decide on a small batch of proposals (typically 3-10) that, if all accepted,
   would substantially raise coverage. Quality > quantity.
3. For each proposal, call proposeRotation. If it returns a conflict, adjust and
   try again - do not retry an identical proposal.
4. Stop when coverage is high or no further sensible proposals remain. Return a
   one-paragraph natural-language summary of what you proposed and why.
`.trim()

/**
 * Build (and cache) the agent. Cached across invocations because the model and
 * instructions are static; the per-request data is passed via RequestContext.
 */
let cachedAgent: Agent | null = null

function getAgent(): Agent {
  if (cachedAgent) return cachedAgent
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set it via .dev.vars locally or as a Cloudflare secret in production.",
    )
  }
  const openai = createOpenAI({apiKey})
  cachedAgent = new Agent({
    id: "judge-scheduler",
    name: "Judge Scheduler",
    instructions: SYSTEM_INSTRUCTIONS,
    model: openai("gpt-4o-mini"),
    tools: {getEventSchedulingContext, getJudgeRoster, proposeRotation},
  })
  return cachedAgent
}

export interface JudgeSchedulingAgentInput {
  context: SchedulingContext
  organizerInstructions?: string
  /**
   * Optional pre-built collector. Used by the streaming API route to inject a
   * BroadcastingProposalCollector that publishes events as proposals arrive.
   * Defaults to a fresh in-memory ProposalCollector when omitted.
   */
  collector?: ProposalCollector
}

export interface JudgeSchedulingAgentOutput {
  proposals: ReturnType<ProposalCollector["list"]>
  narrative: string
}

/**
 * Run the agent end-to-end against a single event. Returns the buffered
 * proposals plus the agent's natural-language summary. Does NOT write to the
 * database — caller is responsible for persisting accepted proposals via the
 * existing createJudgeRotationFn flow.
 */
export async function runJudgeSchedulerAgent(
  input: JudgeSchedulingAgentInput,
): Promise<JudgeSchedulingAgentOutput> {
  const collector = input.collector ?? new ProposalCollector(input.context)
  const requestContext = new RequestContext<AgentRequestContextValues>([
    [CONTEXT_KEY, input.context],
    [COLLECTOR_KEY, collector],
    [INSTRUCTIONS_KEY, input.organizerInstructions],
  ])

  const userMessage = buildUserMessage(input)
  const result = await getAgent().generate(userMessage, {
    requestContext,
    maxSteps: 12,
  })

  return {
    proposals: collector.list(),
    narrative: result.text ?? "",
  }
}

function buildUserMessage(input: JudgeSchedulingAgentInput): string {
  const lines = [
    "Suggest judge rotations to fill the gaps in this event's schedule.",
    `Coverage starts at ${input.context.coverage.coveragePercent}% (${input.context.coverage.coveredSlots}/${input.context.coverage.totalSlots} slots).`,
    `There are ${input.context.judges.length} judges available and ${input.context.coverage.gaps.length} uncovered slot(s).`,
  ]
  if (input.organizerInstructions?.trim()) {
    lines.push("", "Organizer notes:", input.organizerInstructions.trim())
  }
  lines.push(
    "",
    "Call getEventSchedulingContext and getJudgeRoster first, then call proposeRotation for each rotation you want to add. End with a short natural-language summary.",
  )
  return lines.join("\n")
}

/**
 * Zod schemas for the AI judge-scheduling agent.
 *
 * Tool inputs/outputs and persisted state are all defined here so the LLM,
 * the server, and the client share one source of truth.
 *
 * The schemas live alongside the agent rather than in src/schemas/ because
 * they are an implementation detail of the agent and not a public form schema.
 */

import { z } from "zod"
import { LANE_SHIFT_PATTERN } from "@/db/schema"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"

// ============================================================================
// Building blocks
// ============================================================================

export const laneShiftPatternSchema = z.enum([
  LANE_SHIFT_PATTERN.STAY,
  LANE_SHIFT_PATTERN.SHIFT_RIGHT,
])

export const confidenceSchema = z.enum(["high", "medium", "low"])

export const availabilitySchema = z.enum([
  VOLUNTEER_AVAILABILITY.MORNING,
  VOLUNTEER_AVAILABILITY.AFTERNOON,
  VOLUNTEER_AVAILABILITY.ALL_DAY,
])

// ============================================================================
// Proposal — the central artifact the agent produces
// ============================================================================

/**
 * Lifecycle status of a proposed rotation in the agent's state.
 *
 * - `pending`: just streamed in by the LLM, awaiting organizer review.
 * - `accepted`: organizer hit "Save as drafts" — the proposal has been
 *   persisted to `competition_judge_rotations` and the slot is taken.
 *   Kept in the agent's state so subsequent runs know the slot is
 *   already filled and don't re-suggest it.
 */
export const proposalStatusSchema = z.enum(["pending", "accepted"])
export type ProposalStatus = z.infer<typeof proposalStatusSchema>

export const proposedRotationSchema = z.object({
  proposalId: z.string().min(1).max(64),
  membershipId: z.string().min(1),
  startingHeat: z.number().int().min(1),
  startingLane: z.number().int().min(1),
  heatsCount: z.number().int().min(1).max(50),
  laneShiftPattern: laneShiftPatternSchema,
  confidence: confidenceSchema,
  rationale: z.string().min(1).max(280),
  softViolations: z.array(z.string().max(160)).max(10),
  status: proposalStatusSchema.default("pending"),
})

export type ProposedRotation = z.infer<typeof proposedRotationSchema>

// ============================================================================
// Tool input schemas (what the LLM is allowed to send)
// ============================================================================

// LLM only proposes new (pending) rotations. Status defaults at the
// schema level so we don't need to require the model to send it.
export const proposeRotationInputSchema = proposedRotationSchema.omit({
  status: true,
})

export const revokeProposalInputSchema = z.object({
  proposalId: z.string().min(1),
  reason: z.string().min(1).max(240),
})

export const markCompleteInputSchema = z.object({
  summary: z.string().min(1).max(600),
})

/** Input to the agent's @callable() markAccepted method. */
export const markAcceptedInputSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1),
  /**
   * When true, also remove proposals from agent state that aren't in
   * `proposalIds` (used by the "Save N as drafts" batch path so the
   * review surface clears once the user is done with this run).
   * Defaults to false so per-card accepts keep the other pending
   * suggestions visible.
   */
  clearOthers: z.boolean().default(false),
})

// ============================================================================
// Coverage report (returned by check_coverage tool)
// ============================================================================

export const coverageReportSchema = z.object({
  totalSlots: z.number().int().min(0),
  coveredSlots: z.number().int().min(0),
  coveragePercent: z.number().min(0).max(100),
  gaps: z.array(
    z.object({
      heatNumber: z.number().int().min(1),
      laneNumber: z.number().int().min(1),
    }),
  ),
  overlaps: z.array(
    z.object({
      heatNumber: z.number().int().min(1),
      laneNumber: z.number().int().min(1),
      proposalIds: z.array(z.string()),
    }),
  ),
})

export type CoverageReport = z.infer<typeof coverageReportSchema>

// ============================================================================
// Context DTOs (what the agent sees when loading context)
// ============================================================================

export const heatInfoDtoSchema = z.object({
  heatNumber: z.number().int().min(1),
  laneCount: z.number().int().min(1),
  startTime: z.string().nullable(),
  occupiedLanes: z.array(z.number().int().min(1)),
})

export type HeatInfoDto = z.infer<typeof heatInfoDtoSchema>

export const eventContextDtoSchema = z.object({
  trackWorkoutId: z.string(),
  workoutName: z.string(),
  competitionId: z.string(),
  totalHeats: z.number().int().min(0),
  defaultHeatsPerRotation: z.number().int().min(1),
  defaultLaneShiftPattern: laneShiftPatternSchema,
  minHeatBuffer: z.number().int().min(0),
  heats: z.array(heatInfoDtoSchema),
  existingRotations: z.array(
    z.object({
      membershipId: z.string(),
      judgeName: z.string(),
      startingHeat: z.number().int(),
      startingLane: z.number().int(),
      heatsCount: z.number().int(),
      laneShiftPattern: laneShiftPatternSchema,
    }),
  ),
})

export type EventContextDto = z.infer<typeof eventContextDtoSchema>

export const judgeRosterEntrySchema = z.object({
  membershipId: z.string(),
  name: z.string(),
  availability: availabilitySchema.nullable(),
  availabilityNotes: z.string().nullable(),
  credentials: z.string().nullable(),
  /** How many rotations this judge already has across the competition */
  currentRotationCount: z.number().int().min(0),
})

export type JudgeRosterEntry = z.infer<typeof judgeRosterEntrySchema>

export const priorRotationExampleSchema = z.object({
  workoutName: z.string(),
  judgeName: z.string(),
  startingHeat: z.number().int(),
  startingLane: z.number().int(),
  heatsCount: z.number().int(),
  laneShiftPattern: laneShiftPatternSchema,
})

export type PriorRotationExample = z.infer<typeof priorRotationExampleSchema>

// ============================================================================
// Persisted agent state (synced to client over the websocket)
// ============================================================================

export const agentStatusSchema = z.enum(["idle", "thinking", "done", "error"])

export type AgentStatus = z.infer<typeof agentStatusSchema>

/**
 * One entry in the agent's activity log. Streamed to the UI via the standard
 * setState → WebSocket broadcast so organizers see a running narration of
 * what the model is doing (loaded roster, proposed X for lane Y, rejected
 * invalid slot, etc.) instead of just a spinner.
 */
export const activityEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  kind: z.enum(["thinking", "tool", "accepted", "rejected", "done", "error"]),
  message: z.string(),
})

export type ActivityEntry = z.infer<typeof activityEntrySchema>

/** Cap the persisted log so long runs don't bloat DO storage. */
export const MAX_THINKING_LOG_ENTRIES = 200

export const agentStateSchema = z.object({
  trackWorkoutId: z.string().nullable(),
  status: agentStatusSchema,
  proposals: z.array(proposedRotationSchema),
  thinkingLog: z.array(activityEntrySchema).default([]),
  summary: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
})

export type AgentState = z.infer<typeof agentStateSchema>

export const initialAgentState: AgentState = {
  trackWorkoutId: null,
  status: "idle",
  proposals: [],
  thinkingLog: [],
  summary: null,
  errorMessage: null,
  startedAt: null,
  completedAt: null,
}

// ============================================================================
// Client → agent kickoff message
// ============================================================================

export const startSchedulingInputSchema = z.object({
  trackWorkoutId: z.string().min(1),
  competitionId: z.string().min(1),
  /** When true, agent will revoke any proposals from a previous run on this DO */
  reset: z.boolean().default(true),
})

export type StartSchedulingInput = z.infer<typeof startSchedulingInputSchema>

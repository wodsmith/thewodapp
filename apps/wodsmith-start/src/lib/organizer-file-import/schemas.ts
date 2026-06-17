/**
 * Zod schemas for the organizer file-drop import agent.
 *
 * Tool inputs, persisted Durable Object state, and the apply server-fn payload
 * are all defined here so the LLM, the server, and the client share one source
 * of truth — mirroring src/lib/judge-scheduler/schemas.ts.
 */

import { z } from "zod"
import { AGENT_IMPORT_ROUTE_KIND_VALUES } from "@/db/schemas/agent-imports"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_TYPE_VALUES,
} from "@/db/schemas/volunteers"

// ============================================================================
// Building blocks
// ============================================================================

export const confidenceSchema = z.enum(["high", "medium", "low"])
export type Confidence = z.infer<typeof confidenceSchema>

export const routeKindSchema = z.enum(AGENT_IMPORT_ROUTE_KIND_VALUES)
export type RouteKind = z.infer<typeof routeKindSchema>

export const volunteerAvailabilitySchema = z.enum([
  VOLUNTEER_AVAILABILITY.MORNING,
  VOLUNTEER_AVAILABILITY.AFTERNOON,
  VOLUNTEER_AVAILABILITY.ALL_DAY,
])

export const volunteerRoleTypeSchema = z.enum(VOLUNTEER_ROLE_TYPE_VALUES)

/** How a proposed row relates to data that already exists. */
export const matchKindSchema = z.enum([
  "new",
  "existing_invite",
  "existing_member",
])
export type MatchKind = z.infer<typeof matchKindSchema>

/** Lifecycle of a single proposal in agent state. */
export const proposalStatusSchema = z.enum(["pending", "accepted"])

// ============================================================================
// Volunteer / judge proposals
// ============================================================================

export const volunteerActionSchema = z.enum([
  "create", // invite a new volunteer
  "update", // update an existing volunteer's metadata/roles
  "skip", // duplicate or intentionally excluded
  "needs_input", // missing required data (e.g. no email)
])
export type VolunteerAction = z.infer<typeof volunteerActionSchema>

export const volunteerProposalSchema = z.object({
  proposalId: z.string().min(1).max(64),
  /** stable key derived from the source row, used for idempotent apply */
  rowKey: z.string().min(1).max(200),
  action: volunteerActionSchema,
  name: z.string().max(200).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().max(40).nullable(),
  roleTypes: z.array(volunteerRoleTypeSchema).max(13).default([]),
  credentials: z.string().max(200).nullable(),
  shirtSize: z.string().max(20).nullable(),
  availability: volunteerAvailabilitySchema.nullable(),
  // Match info surfaced inline in the review surface
  matchKind: matchKindSchema.default("new"),
  matchedMembershipId: z.string().nullable(),
  confidence: confidenceSchema,
  rationale: z.string().min(1).max(280),
  warnings: z.array(z.string().max(200)).max(10).default([]),
  status: proposalStatusSchema.default("pending"),
})
export type VolunteerProposal = z.infer<typeof volunteerProposalSchema>

// ============================================================================
// Event proposals
// ============================================================================

export const eventActionSchema = z.enum(["create", "update", "skip"])
export type EventAction = z.infer<typeof eventActionSchema>

/** A single field-level before/after, powering the inline diff (pattern C). */
export const changedFieldSchema = z.object({
  before: z.unknown(),
  after: z.unknown(),
})

export const eventProposalSchema = z.object({
  proposalId: z.string().min(1).max(64),
  rowKey: z.string().min(1).max(200),
  action: eventActionSchema,
  /** set for updates — the trackWorkoutId being changed */
  targetTrackWorkoutId: z.string().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable(),
  /** validated against WORKOUT_SCHEME_VALUES server-side at apply time */
  scheme: z.string().max(64).nullable(),
  scoreType: z.string().max(64).nullable(),
  timeCap: z.number().int().positive().nullable(),
  changedFields: z.record(z.string(), changedFieldSchema).default({}),
  confidence: confidenceSchema,
  rationale: z.string().min(1).max(280),
  warnings: z.array(z.string().max(200)).max(10).default([]),
  status: proposalStatusSchema.default("pending"),
})
export type EventProposal = z.infer<typeof eventProposalSchema>

// ============================================================================
// Clarification (intent disambiguation)
// ============================================================================

/** Set when the dropped file doesn't match the page ("did you mean Volunteers?"). */
export const clarificationSchema = z
  .object({
    question: z.string().min(1).max(300),
    suggestedRouteKind: routeKindSchema.nullable(),
  })
  .nullable()
export type Clarification = z.infer<typeof clarificationSchema>

// ============================================================================
// Activity log
// ============================================================================

export const activityEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  kind: z.enum(["thinking", "tool", "proposed", "skipped", "done", "error"]),
  message: z.string(),
})
export type ActivityEntry = z.infer<typeof activityEntrySchema>

/** Cap the persisted log so long runs don't bloat DO storage. */
export const MAX_THINKING_LOG_ENTRIES = 200

// ============================================================================
// Persisted agent state (synced to the client over the WebSocket)
// ============================================================================

export const importStatusSchema = z.enum([
  "idle",
  "parsing",
  "thinking",
  "proposals_ready",
  "error",
])
export type ImportStatus = z.infer<typeof importStatusSchema>

export const agentStateSchema = z.object({
  importRunId: z.string().nullable(),
  routeKind: routeKindSchema.nullable(),
  status: importStatusSchema,
  volunteerProposals: z.array(volunteerProposalSchema).default([]),
  eventProposals: z.array(eventProposalSchema).default([]),
  clarification: clarificationSchema.default(null),
  thinkingLog: z.array(activityEntrySchema).default([]),
  parseWarnings: z.array(z.string()).default([]),
  summary: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
})
export type AgentState = z.infer<typeof agentStateSchema>

export const initialAgentState: AgentState = {
  importRunId: null,
  routeKind: null,
  status: "idle",
  volunteerProposals: [],
  eventProposals: [],
  clarification: null,
  thinkingLog: [],
  parseWarnings: [],
  summary: null,
  errorMessage: null,
  startedAt: null,
  completedAt: null,
}

// ============================================================================
// Tool input schemas (what the LLM is allowed to send)
// ============================================================================

// The LLM only emits pending proposals; status defaults at the schema level.
export const proposeVolunteerInputSchema = volunteerProposalSchema.omit({
  status: true,
  matchKind: true,
  matchedMembershipId: true,
})

export const proposeEventCreateInputSchema = eventProposalSchema
  .omit({ status: true, targetTrackWorkoutId: true, changedFields: true })
  .extend({ action: z.literal("create") })

export const proposeEventUpdateInputSchema = eventProposalSchema
  .omit({ status: true })
  .extend({
    action: z.literal("update"),
    targetTrackWorkoutId: z.string().min(1),
  })

export const revokeProposalInputSchema = z.object({
  proposalId: z.string().min(1),
  reason: z.string().min(1).max(240),
})

export const askClarificationInputSchema = z.object({
  question: z.string().min(1).max(300),
  suggestedRouteKind: routeKindSchema.nullable().default(null),
})

export const markCompleteInputSchema = z.object({
  summary: z.string().min(1).max(600),
})

// ============================================================================
// Client → agent kickoff / refine / mark-applied
// ============================================================================

export const startImportInputSchema = z.object({
  importRunId: z.string().min(1),
  competitionId: z.string().min(1),
  routeKind: routeKindSchema,
  eventId: z.string().min(1).optional(),
})
export type StartImportInput = z.infer<typeof startImportInputSchema>

export const refineImportInputSchema = z.object({
  instruction: z.string().min(1).max(500),
})

export const markImportAppliedInputSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1),
})

// ============================================================================
// Apply / undo server-fn payloads
// ============================================================================

export const applyImportInputSchema = z.object({
  importRunId: z.string().min(1),
  volunteerProposals: z.array(volunteerProposalSchema).max(500).default([]),
  eventProposals: z.array(eventProposalSchema).max(200).default([]),
})
export type ApplyImportInput = z.infer<typeof applyImportInputSchema>

export const undoImportInputSchema = z.object({
  importRunId: z.string().min(1),
})

/** Per-row outcome returned by the apply server fn (drives the receipt). */
export const applyRowResultSchema = z.object({
  rowKey: z.string(),
  status: z.enum(["applied", "skipped", "failed"]),
  kind: z.string(),
  entityId: z.string().nullable(),
  message: z.string().nullable(),
})
export type ApplyRowResult = z.infer<typeof applyRowResultSchema>

export interface ApplyImportResult {
  appliedCount: number
  skippedCount: number
  failedCount: number
  results: ApplyRowResult[]
}

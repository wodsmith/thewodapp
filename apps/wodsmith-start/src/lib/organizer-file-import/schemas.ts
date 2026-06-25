/**
 * Zod schemas for the organizer file-drop import agent.
 *
 * Tool inputs/outputs and persisted agent state all live here so the LLM, the
 * apply server function, and the client share one source of truth — mirroring
 * src/lib/judge-scheduler/schemas.ts.
 */

import { z } from "zod"
import { AGENT_IMPORT_ROUTE_KIND } from "@/db/schemas/agent-imports"
import {
	VOLUNTEER_AVAILABILITY,
	VOLUNTEER_ROLE_TYPE_VALUES,
} from "@/db/schemas/volunteers"

// ============================================================================
// Building blocks
// ============================================================================

export const confidenceSchema = z.enum(["high", "medium", "low"])

export const routeKindSchema = z.enum([
	AGENT_IMPORT_ROUTE_KIND.VOLUNTEERS,
	AGENT_IMPORT_ROUTE_KIND.JUDGES,
	AGENT_IMPORT_ROUTE_KIND.EVENTS,
	AGENT_IMPORT_ROUTE_KIND.EVENT_DETAIL,
])

export const availabilitySchema = z.enum([
	VOLUNTEER_AVAILABILITY.MORNING,
	VOLUNTEER_AVAILABILITY.AFTERNOON,
	VOLUNTEER_AVAILABILITY.ALL_DAY,
])

export const proposalActionSchema = z.enum([
	"create",
	"skip",
	"needs_input",
])

/** How a proposal matched against existing data — surfaced inline in the UI. */
export const matchKindSchema = z.enum([
	"new",
	"existing_invite",
	"existing_member",
])

/**
 * Lifecycle status of a single proposal in the agent's state.
 * - `pending`: streamed in by the model, awaiting organizer review.
 * - `accepted`: organizer confirmed it; kept so re-runs/refine don't re-propose.
 */
export const proposalStatusSchema = z.enum(["pending", "accepted"])
export type ProposalStatus = z.infer<typeof proposalStatusSchema>

// ============================================================================
// Volunteer / judge proposal
// ============================================================================

export const volunteerProposalSchema = z.object({
	proposalId: z.string().min(1).max(64),
	// stable key from the source row, for idempotency across refine + apply
	rowKey: z.string().min(1).max(200),
	action: proposalActionSchema,
	name: z.string().max(200).nullable(),
	email: z.string().email().max(320).nullable(),
	phone: z.string().max(40).nullable(),
	roleTypes: z.array(z.enum(VOLUNTEER_ROLE_TYPE_VALUES)).default([]),
	credentials: z.string().max(200).nullable(),
	shirtSize: z.string().max(20).nullable(),
	availability: availabilitySchema.nullable(),
	// match info surfaced inline ("matched on email", "already a volunteer")
	matchKind: matchKindSchema.default("new"),
	matchedMembershipId: z.string().nullable(),
	confidence: confidenceSchema,
	rationale: z.string().min(1).max(280),
	// e.g. "no email — can't invite"
	warnings: z.array(z.string().max(200)).max(10).default([]),
	status: proposalStatusSchema.default("pending"),
})
export type VolunteerProposal = z.infer<typeof volunteerProposalSchema>

// ============================================================================
// Event / workout proposal
// ============================================================================

export const eventProposalSchema = z.object({
	proposalId: z.string().min(1).max(64),
	rowKey: z.string().min(1).max(200),
	action: z.enum(["create", "update", "skip"]),
	// set for updates — the trackWorkoutId being changed
	targetTrackWorkoutId: z.string().nullable(),
	name: z.string().min(1).max(200),
	description: z.string().max(5000).nullable(),
	// validated against WORKOUT_SCHEME_VALUES server-side
	scheme: z.string().max(50).nullable(),
	scoreType: z.string().max(50).nullable(),
	timeCap: z.number().int().positive().nullable(),
	// field-level diff for the inline-diff pattern (C)
	changedFields: z
		.record(
			z.string(),
			z.object({ before: z.unknown(), after: z.unknown() }),
		)
		.default({}),
	confidence: confidenceSchema,
	rationale: z.string().min(1).max(280),
	warnings: z.array(z.string().max(200)).max(10).default([]),
	status: proposalStatusSchema.default("pending"),
})
export type EventProposal = z.infer<typeof eventProposalSchema>

// ============================================================================
// Clarification — asked when the file doesn't match the page
// ============================================================================

export const clarificationSchema = z
	.object({
		question: z.string().max(300),
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
	kind: z.enum([
		"thinking",
		"tool",
		"proposed",
		"skipped",
		"done",
		"error",
	]),
	message: z.string(),
})
export type ActivityEntry = z.infer<typeof activityEntrySchema>

/** Cap the persisted log so long runs don't bloat DO storage. */
export const MAX_THINKING_LOG_ENTRIES = 200

// ============================================================================
// Persisted agent state (synced to client over the websocket)
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
	competitionId: z.string().nullable(),
	eventId: z.string().nullable(),
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
	competitionId: null,
	eventId: null,
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
// Client → agent kickoff + refine
// ============================================================================

export const startImportInputSchema = z.object({
	importRunId: z.string().min(1),
	competitionId: z.string().min(1),
	routeKind: routeKindSchema,
	eventId: z.string().min(1).optional(),
})
export type StartImportInput = z.infer<typeof startImportInputSchema>

export const refineInputSchema = z.object({
	instruction: z.string().min(1).max(500),
})
export type RefineInput = z.infer<typeof refineInputSchema>

export const markImportAppliedInputSchema = z.object({
	proposalIds: z.array(z.string().min(1)).min(1),
})
export type MarkImportAppliedInput = z.infer<
	typeof markImportAppliedInputSchema
>

// ============================================================================
// Tool input schemas (what the LLM is allowed to send)
// ============================================================================

// The model only ever proposes pending items; status/match fields are filled
// in deterministically by the agent's tools, so they are omitted here.
export const proposeVolunteerInputSchema = volunteerProposalSchema.omit({
	status: true,
	matchKind: true,
	matchedMembershipId: true,
	warnings: true,
})

export const proposeEventCreateInputSchema = eventProposalSchema
	.omit({
		status: true,
		warnings: true,
		targetTrackWorkoutId: true,
		changedFields: true,
	})
	.extend({ action: z.literal("create") })

export const proposeEventUpdateInputSchema = eventProposalSchema
	.omit({
		status: true,
		warnings: true,
	})
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

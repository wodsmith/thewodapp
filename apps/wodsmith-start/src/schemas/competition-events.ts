/**
 * Competition Events Schemas
 *
 * Zod validation schemas for competition event settings,
 * including submission windows for online competitions.
 */

import { z } from "zod"

/**
 * Single competition event schema
 * Represents per-event settings like submission windows
 */
export const competitionEventSchema = z.object({
	/** Event ID (optional for create, required for update) */
	id: z.string().optional(),
	/** Competition this event belongs to */
	competitionId: z.string(),
	/** Track workout ID (the workout/event) */
	trackWorkoutId: z.string(),
	/** When athletes can start submitting (ISO 8601 datetime) */
	submissionOpensAt: z.string().datetime().nullish(),
	/** When submissions close (ISO 8601 datetime) */
	submissionClosesAt: z.string().datetime().nullish(),
})
export type CompetitionEvent = z.infer<typeof competitionEventSchema>

/**
 * Schema for creating a new competition event
 * Omits ID since it's auto-generated
 */
export const createCompetitionEventSchema = competitionEventSchema.omit({
	id: true,
})
export type CreateCompetitionEvent = z.infer<
	typeof createCompetitionEventSchema
>

/**
 * Schema for updating an existing competition event
 * ID required, other fields optional
 */
export const updateCompetitionEventSchema = competitionEventSchema
	.partial()
	.required({ id: true })
export type UpdateCompetitionEvent = z.infer<
	typeof updateCompetitionEventSchema
>

/**
 * Schema for bulk upserting competition events
 * Used by the submission windows manager to save all windows at once
 */
export const upsertCompetitionEventsSchema = z.object({
	/** Competition ID */
	competitionId: z.string(),
	/** Events to upsert (create or update based on presence of ID) */
	events: z.array(
		z.object({
			/** Event ID (if present, update; if absent, create) */
			id: z.string().optional(),
			/** Track workout ID */
			trackWorkoutId: z.string(),
			/** Submission window start (ISO 8601 datetime) */
			submissionOpensAt: z.string().datetime().nullish(),
			/** Submission window end (ISO 8601 datetime) */
			submissionClosesAt: z.string().datetime().nullish(),
		}),
	),
})
export type UpsertCompetitionEvents = z.infer<
	typeof upsertCompetitionEventsSchema
>

/**
 * Schema for deleting competition events
 */
export const deleteCompetitionEventSchema = z.object({
	/** Event ID to delete */
	id: z.string(),
})
export type DeleteCompetitionEvent = z.infer<
	typeof deleteCompetitionEventSchema
>

/**
 * Schema for fetching competition events
 */
export const getCompetitionEventsSchema = z.object({
	/** Competition ID */
	competitionId: z.string(),
})
export type GetCompetitionEvents = z.infer<typeof getCompetitionEventsSchema>

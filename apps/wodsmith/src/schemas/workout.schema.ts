import { z } from "zod"
import {
	SCORE_TYPE_VALUES,
	TIEBREAK_SCHEME_VALUES,
	WORKOUT_SCHEME_VALUES,
} from "@/db/schemas/workouts"

/**
 * Base workout fields schema - shared between create workout form and competition event form
 * Uses optional() for consistency with existing form patterns where undefined means "not set"
 */
export const workoutFieldsSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	scheme: z.enum(WORKOUT_SCHEME_VALUES, {
		required_error: "Scheme is required",
	}),
	scoreType: z.enum(SCORE_TYPE_VALUES).optional(),
	roundsToScore: z.number().min(1).optional(),
	repsPerRound: z.number().min(1).optional(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).optional(),
	selectedMovements: z.array(z.string()).default([]),
})

export type WorkoutFieldsSchema = z.output<typeof workoutFieldsSchema>
export type WorkoutFieldsInput = z.input<typeof workoutFieldsSchema>

/**
 * Competition event details schema - extends workout fields with competition-specific fields
 * Uses nullable() for fields that may be explicitly set to null in the database
 */
export const competitionEventSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	scheme: z.enum(WORKOUT_SCHEME_VALUES, {
		required_error: "Scheme is required",
	}),
	scoreType: z.enum(SCORE_TYPE_VALUES).nullable(),
	roundsToScore: z.number().min(1).nullable(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable(),
	timeCap: z.number().min(1).nullable(), // Time cap in seconds
	selectedMovements: z.array(z.string()).default([]),
	pointsMultiplier: z.number().min(1).max(1000),
	notes: z.string(),
	divisionDescs: z.record(z.string(), z.string()),
	sponsorId: z.string().nullable(), // "Presented by" sponsor
})

export type CompetitionEventSchema = z.output<typeof competitionEventSchema>
export type CompetitionEventInput = z.input<typeof competitionEventSchema>

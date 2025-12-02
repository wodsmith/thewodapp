import { z } from "zod"

// Zod schemas for validation and type safety

export const workoutTypeSchema = z.enum(["for-time", "amrap", "max-load"])

export const divisionSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  badge: z.string(),
  color: z.string(),
})

export const workoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: workoutTypeSchema,
  timeCap: z.number().positive(),
  repScheme: z.string().optional(),
  standards: z.record(
    z.string(),
    z.object({
      timeCap: z.number().positive(),
      load: z.number().optional(),
      height: z.number().optional(),
      description: z.string().optional(),
    }),
  ),
})

export const athleteSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  bibNumber: z.string(),
  divisionId: z.string(),
})

export const scoreInputSchema = z.object({
  athleteId: z.string(),
  heatId: z.string(),
  value: z.string(),
  tieBreak: z.string().optional(),
})

// Smart input parser result
export const parsedScoreSchema = z.object({
  formatted: z.string(),
  isValid: z.boolean(),
  needsTieBreak: z.boolean(),
  error: z.string().optional(),
})

export const heatSchema = z.object({
  id: z.string(),
  workoutId: z.string(),
  heatNumber: z.number(),
  divisionId: z.string(),
  divisionName: z.string(),
  scheduledStartTime: z.string(),
  status: z.enum(["upcoming", "active", "scoring", "complete"]),
  athletes: z.array(
    athleteSchema.extend({
      lane: z.number(),
      divisionBadge: z.string(),
    }),
  ),
  isMixed: z.boolean(),
  standardsConfig: z
    .record(
      z.string(),
      z.object({
        timeCap: z.number(),
        load: z.number().optional(),
      }),
    )
    .optional(),
  nextHeatId: z.string().nullable(),
  previousHeatId: z.string().nullable(),
  isDivisionCrossover: z.boolean(),
})

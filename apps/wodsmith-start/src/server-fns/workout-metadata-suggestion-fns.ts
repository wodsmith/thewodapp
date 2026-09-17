import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  WORKOUT_METADATA_MIN_DESCRIPTION_LENGTH,
  WORKOUT_METADATA_WRITE_PERMISSIONS,
} from "@/lib/workout-metadata-suggestions"

const inputSchema = z
  .object({
    teamId: z.string().min(1),
    writePermission: z.enum(WORKOUT_METADATA_WRITE_PERMISSIONS).optional(),
    description: z
      .string()
      .trim()
      .min(WORKOUT_METADATA_MIN_DESCRIPTION_LENGTH)
      .max(20_000),
    competitionAccess: z
      .object({
        competitionId: z.string().min(1),
        competitionTeamId: z.string().min(1),
      })
      .optional(),
  })
  .superRefine((input, context) => {
    if (!input.competitionAccess && !input.writePermission) {
      context.addIssue({
        code: "custom",
        path: ["writePermission"],
        message: "A write permission is required outside cohost access",
      })
    }
  })

export const suggestWorkoutMetadataFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { suggestWorkoutMetadata } = await import(
      "@/server/workout-metadata-suggestions.server"
    )
    return suggestWorkoutMetadata(data)
  })

import { env } from "cloudflare:workers"
import { createServerFn } from "@tanstack/react-start"
import { describeWorkoutInputSchema } from "@/lib/workout-authoring"
import { getWorkoutAuthoringCatalog } from "@/server/workout-authoring"
import {
  inferCompetitionEventDescription,
  inferWorkoutDescription,
} from "@/server/workout-description-inference"

export const describeWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => describeWorkoutInputSchema.parse(data))
  .handler(async ({ data }) => {
    const catalog = await getWorkoutAuthoringCatalog(data.context)
    return inferWorkoutDescription(
      data.description,
      catalog,
      env.TYPESAFE_API_KEY ?? "",
    )
  })

export const describeCompetitionEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => describeWorkoutInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.context.kind !== "competition")
      throw new Error("Multi-part event recognition requires a competition.")
    const catalog = await getWorkoutAuthoringCatalog(data.context)
    return inferCompetitionEventDescription(
      data.description,
      catalog,
      env.TYPESAFE_API_KEY ?? "",
    )
  })

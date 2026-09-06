import { createServerFn } from "@tanstack/react-start"
import {
  copyTrainingSession,
  getTrainingContext,
  getTrainingHistory,
  getTrainingWeek,
  publishTrainingSession,
  saveTrainingDraft,
  saveTrainingResult,
  setTrainingCheer,
} from "@/server/training"
import {
  trainingCheerInputSchema,
  trainingCopyInputSchema,
  trainingDraftInputSchema,
  trainingPublishInputSchema,
  trainingResultInputSchema,
  trainingTrackInputSchema,
  trainingWeekInputSchema,
} from "@/server/training-validation"

export const getTrainingContextFn = createServerFn({ method: "GET" }).handler(
  () => getTrainingContext(),
)
export const getTrainingWeekFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => trainingWeekInputSchema.parse(data))
  .handler(({ data }) => getTrainingWeek(data))
export const saveTrainingDraftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trainingDraftInputSchema.parse(data))
  .handler(({ data }) => saveTrainingDraft(data))
export const publishTrainingSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trainingPublishInputSchema.parse(data))
  .handler(({ data }) => publishTrainingSession(data))
export const copyTrainingSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trainingCopyInputSchema.parse(data))
  .handler(({ data }) => copyTrainingSession(data))
export const saveTrainingResultFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trainingResultInputSchema.parse(data))
  .handler(({ data }) => saveTrainingResult(data))
export const setTrainingCheerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trainingCheerInputSchema.parse(data))
  .handler(({ data }) => setTrainingCheer(data))
export const getTrainingHistoryFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => trainingTrackInputSchema.parse(data))
  .handler(({ data }) => getTrainingHistory(data))

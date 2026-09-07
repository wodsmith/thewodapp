import { createServerFn } from "@tanstack/react-start"
import { getPersonalTrainingWorkoutOptions } from "@/server/training"
import {
  getPersonalLibraryScalingLevels,
  getPersonalTrainingDay,
  getPersonalTrainingHistory,
  getTrainingLibraryWorkout,
  linkPersonalTrainingScore,
  listTrainingLibraryWorkouts,
  savePersonalLibraryResult,
  savePersonalTrainingResult,
  savePersonalTrainingSession,
  saveTrainingPreference,
} from "@/server/training-personal"
import {
  personalLibraryResultSchema,
  personalTrainingDaySchema,
  personalTrainingResultSchema,
  personalTrainingSaveSchema,
  personalTrainingScoreLinkSchema,
  trainingLibraryListSchema,
  trainingLibraryWorkoutSchema,
  trainingPreferenceSchema,
} from "@/server/training-personal-validation"
export const getPersonalTrainingDayFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => personalTrainingDaySchema.parse(data))
  .handler(({ data }) => getPersonalTrainingDay(data))
export const saveTrainingPreferenceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trainingPreferenceSchema.parse(data))
  .handler(({ data }) => saveTrainingPreference(data))
export const savePersonalTrainingSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => personalTrainingSaveSchema.parse(data))
  .handler(({ data }) => savePersonalTrainingSession(data))
export const savePersonalTrainingResultFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => personalTrainingResultSchema.parse(data))
  .handler(({ data }) => savePersonalTrainingResult(data))
export const getTrainingLibraryWorkoutFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => trainingLibraryWorkoutSchema.parse(data))
  .handler(({ data }) => getTrainingLibraryWorkout(data))
export const listTrainingLibraryWorkoutsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => trainingLibraryListSchema.parse(data))
  .handler(({ data }) => listTrainingLibraryWorkouts(data))
export const linkPersonalTrainingScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    personalTrainingScoreLinkSchema.parse(data),
  )
  .handler(({ data }) => linkPersonalTrainingScore(data))

export const savePersonalLibraryResultFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => personalLibraryResultSchema.parse(data))
  .handler(({ data }) => savePersonalLibraryResult(data))

export const getPersonalTrainingHistoryFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    trainingLibraryListSchema.pick({ teamId: true }).parse(data),
  )
  .handler(({ data }) => getPersonalTrainingHistory(data))

export const getPersonalLibraryScalingLevelsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    personalTrainingResultSchema
      .pick({ personalSessionId: true, itemId: true })
      .parse(data),
  )
  .handler(({ data }) => getPersonalLibraryScalingLevels(data))

export const getPersonalTrainingWorkoutOptionsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    trainingLibraryListSchema.pick({ teamId: true }).parse(data),
  )
  .handler(({ data }) => getPersonalTrainingWorkoutOptions(data))

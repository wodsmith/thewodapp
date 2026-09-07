export * from "./personal-fixtures"
import { providerDays, previewContext } from "./track-fixtures"
import type {
  PersonalTrainingDay,
  PersonalTrainingSession,
  PersonalTrainingItem,
  SavePersonalTrainingSessionInput,
  SavePersonalTrainingResultInput,
} from "@/lib/training/personal-types"
import type { OwnTrainingResult } from "@/lib/training/types"
const results = new Map<string, OwnTrainingResult>()
const sessions = new Map<string, PersonalTrainingSession>()
export async function getPersonalTrainingDayFn({
  data,
}: {
  data: { teamId: string; trainingDate: string; trackId?: string }
}): Promise<PersonalTrainingDay> {
  const day = providerDays.find((day) => day.date === data.trainingDate)
  const session = sessions.get(`${data.teamId}:${data.trainingDate}`) ?? null
  return {
    defaultTrackId: "ptrk_crossfit_dotcom",
    selectedTrackId: data.trackId ?? "ptrk_crossfit_dotcom",
    sourceSession: null,
    source: day ? { kind: "provider-day", day } : { kind: "unavailable" },
    personalSession: session,
    items: session?.items ?? [],
    results: [...results.values()].filter(
      (result) => result.sessionId === session?.id,
    ),
    libraryResults: [],
  }
}
export async function getTrainingLibraryWorkoutFn({
  data,
}: {
  data: { workoutId: string }
}) {
  const day = providerDays.find((day) =>
    day.workouts.some((workout) => workout.workoutId === data.workoutId),
  )
  const workout = day?.workouts.find(
    (workout) => workout.workoutId === data.workoutId,
  )
  if (!day || !workout)
    throw new Error("No preview workout exists for this ID.")
  return {
    ...workout,
    description: workout.description ?? "",
    id: workout.workoutId,
    provenance: {
      importId: day.id,
      trackId: "ptrk_crossfit_dotcom",
      trackName: "CrossFit.com",
      sourceDate: day.date,
      sourceUrl: day.url,
    },
  }
}
export async function savePersonalTrainingSessionFn({
  data,
}: {
  data: SavePersonalTrainingSessionInput
}) {
  const old = sessions.get(`${data.teamId}:${data.trainingDate}`)
  if ((old?.revision ?? 0) !== data.expectedRevision)
    throw new Error("Session changed. Reload.")
  const items = await Promise.all(
    data.items.map(async (item) => {
      if (item.kind !== "library") return item as PersonalTrainingItem
      const workout = await getTrainingLibraryWorkoutFn({
        data: { workoutId: item.workoutId },
      })
      return { ...item, workout, provenance: workout.provenance }
    }),
  )
  const session = {
    id: `preview-session-${data.teamId}-${data.trainingDate}`,
    teamId: data.teamId,
    trainingDate: data.trainingDate,
    revision: (old?.revision ?? 0) + 1,
    items,
  }
  sessions.set(`${data.teamId}:${data.trainingDate}`, session)
  return session
}

export async function savePersonalTrainingResultFn({
  data,
}: {
  data: SavePersonalTrainingResultInput
}): Promise<OwnTrainingResult> {
  const session = [...sessions.values()].find(
    (session) => session.id === data.personalSessionId,
  )
  const item = session?.items.find((item) => item.id === data.itemId)
  if (!session || !item) throw new Error("Workout missing.")
  if (item.kind === "library")
    throw new Error(
      "Library results use the workout log route, which is outside this preview.",
    )
  if (session.revision !== data.expectedRevision)
    throw new Error("This session changed. Reload before saving.")
  const value = data.score.trim()
    ? item.block.kind === "time"
      ? data.score
          .split(":")
          .reduce((total, part) => total * 60 + Number(part), 0) * 1000
      : item.block.kind === "load"
        ? Math.round(
            Number(data.score) * (data.unit === "lb" ? 453.59237 : 1000),
          )
        : Number(data.score)
    : null
  const result: OwnTrainingResult = {
    id: `${session.id}-${item.id}`,
    sessionId: session.id,
    blockId: item.id,
    publishedVersion: 1,
    userId: previewContext.userId,
    userName: "Preview athlete",
    trainingDate: session.trainingDate,
    trackId: "",
    block: item.block,
    scoreValue: value,
    displayScore: data.score,
    scaling: "custom",
    modification: "",
    audience: "private",
    unit: data.unit,
    completed: data.completed,
    cheerCount: 0,
    hasCheered: false,
    notes: data.notes,
  }
  results.set(result.id, result)
  return structuredClone(result)
}
export async function getPersonalTrainingHistoryFn({
  data,
}: {
  data: { teamId: string }
}) {
  const ids = new Set(
    [...sessions.values()]
      .filter((session) => session.teamId === data.teamId)
      .map((session) => session.id),
  )
  return structuredClone(
    [...results.values()].filter((result) => ids.has(result.sessionId)),
  )
}

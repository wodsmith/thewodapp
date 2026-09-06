export * from "./personal-fixtures"
import { providerDays } from "./track-fixtures"
import type {
  PersonalTrainingDay,
  PersonalTrainingSession,
  PersonalTrainingItem,
  SavePersonalTrainingSessionInput,
} from "@/lib/training/personal-types"
const sessions = new Map<string, PersonalTrainingSession>()
export async function getPersonalTrainingDayFn({
  data,
}: {
  data: { teamId: string; trainingDate: string; trackId?: string }
}): Promise<PersonalTrainingDay> {
  const day = providerDays.find((day) => day.date === data.trainingDate)
  const session = sessions.get(data.trainingDate) ?? null
  return {
    defaultTrackId: "ptrk_crossfit_dotcom",
    selectedTrackId: data.trackId ?? "ptrk_crossfit_dotcom",
    sourceSession: null,
    source: day ? { kind: "provider-day", day } : { kind: "unavailable" },
    personalSession: session,
    items: session?.items ?? [],
    results: [],
    libraryResults: [],
  }
}
export async function getTrainingLibraryWorkoutFn({
  data,
}: {
  data: { workoutId: string }
}) {
  const day = providerDays[1]
  const workout = day.workouts.find(
    (workout) => workout.workoutId === data.workoutId,
  )!
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
  const old = sessions.get(data.trainingDate)
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
    id: "preview-session",
    teamId: data.teamId,
    trainingDate: data.trainingDate,
    revision: (old?.revision ?? 0) + 1,
    items,
  }
  sessions.set(data.trainingDate, session)
  return session
}

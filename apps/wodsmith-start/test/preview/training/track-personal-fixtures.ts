export {getDirectLibraryEntryFn,saveDirectLibraryResultFn,getPersonalLibraryScalingLevelsFn,savePersonalLibraryResultFn} from "./log-fixtures"
import { previewAttempts } from "./log-fixtures"
export * from "./personal-fixtures"
import { previewSession, sessionSources } from "./session-ux-fixtures"
import { providerDays, previewContext } from "./track-fixtures"
import type {
  PersonalTrainingDay,
  PersonalTrainingSession,
  SavePersonalTrainingSessionInput,
  SavePersonalTrainingResultInput,
} from "@/lib/training/personal-types"
import { normalizeTrainingResult } from "@/server/training-validation"
import type { OwnTrainingResult } from "@/lib/training/types"
const results = new Map<string, OwnTrainingResult>()
let defaultTrackId = "ptrk_crossfit_dotcom"
export async function saveTrainingPreferenceFn({data}:{data:{defaultTrackId:string}}){defaultTrackId=data.defaultTrackId}
const sessions = new Map<string, PersonalTrainingSession>()
export async function getPersonalTrainingDayFn({
  data,
}: {
  data: { teamId: string; trainingDate: string; trackId?: string }
}): Promise<PersonalTrainingDay> {
  const selectedTrack = data.trackId ?? defaultTrackId
  const sourceSession = previewSession(selectedTrack, data.trainingDate)
  const day = selectedTrack === "ptrk_crossfit_dotcom" ? providerDays.find((day) => day.date === data.trainingDate) : undefined
  const session = sessions.get(`${data.teamId}:${data.trainingDate}`) ?? null
  return {
    defaultTrackId,
    selectedTrackId: selectedTrack,
    sourceSession,
    source: sourceSession ? {kind:"coach-session",session:sourceSession} : day ? { kind: "provider-day", day } : { kind: "unavailable" },
    personalSession: session,
    items: session?.items ?? [],
    results: [...results.values()].filter(
      (result) => result.sessionId === session?.id,
    ),
    libraryResults: Object.entries(previewAttempts()).filter(([,attempt])=>attempt.data.trainingDate === data.trainingDate).map(([id,attempt])=>({itemId:id,scoreId:id,workoutId:attempt.workout.id,displayScore:attempt.result.formatted,occurrence:{trackId:attempt.data.sourceTrackId,sourceDate:attempt.data.sourceDate}})),
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
    tiebreakScheme: workout.workoutId === "preview-load" ? "time" : null,
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
  if (data.mode === "append") data = {...data, items: [...(old?.items ?? []), ...data.items.filter(item => !old?.items.some(previous => previous.id === item.id))]}
  if (data.mode === "undo") data = {...data, items: (old?.items ?? []).filter(item => !data.items.some(removed => removed.id === item.id))}
  const items = await Promise.all(
    data.items.map(async (item) => {
      if (item.kind === "personal") return item
      if (item.kind === "source") {
        const previous = old?.items.find(previous => previous.id === item.id)
        if (previous?.kind === "source") return previous
        const source = sessionSources.get(item.sourceSessionId)
        const block = source?.published?.blocks.find(block => block.id === item.sourceBlockId)
        if (!source || !block) throw new Error("Source is unavailable")
        return {...item,block,trackId:source.trackId,trackName:source.trackId === "everyday" ? "Everyday" : "Recovery",sourceTrainingDate:source.trainingDate,sourceIsCurrent:true}
      }
      const workout = await getTrainingLibraryWorkoutFn({
        data: { workoutId: item.workoutId },
      })
      return { ...item, workout, provenance: workout.provenance, occurrence:item.sourceTrackId ? {trackId:item.sourceTrackId,sourceDate:item.sourceDate} : undefined }
    }),
  )
  const session = {
    id: `preview-session-${data.teamId}-${data.trainingDate}`,
    teamId: data.teamId,
    trainingDate: data.trainingDate,
    revision: (old?.revision ?? 0) + 1,
    compositionState: "customized" as const,
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
  const normalized = normalizeTrainingResult(item.block, {
    ...data,
    sessionId: session.id,
    blockId: item.id,
    publishedVersion: 1,
    scaling: "custom",
    modification: "",
    audience: "private",
  })
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
    ...normalized,
    scaling: "custom",
    modification: "",
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

export { getTrainingWorkoutOptionsFn as getPersonalTrainingWorkoutOptionsFn } from "./fixtures"

import { Effect } from "effect"
import { apiGet } from "./client"
import {
  CompetitionResponseSchema,
  HeatsResponseSchema,
  RegistrationsResponseSchema,
  WindowStatusSchema,
  WorkoutsResponseSchema,
  type Competition,
  type HeatsResponse,
  type Registration,
  type WindowStatus,
  type WorkoutsResponse,
} from "./schemas"

export function getCompetition(slug: string): Effect.Effect<Competition, unknown> {
  return apiGet(`/api/compete/competitions/${slug}`, CompetitionResponseSchema).pipe(
    Effect.map((res) => res.competition),
  )
}

export function getHeats(competitionId: string): Effect.Effect<HeatsResponse, unknown> {
  return apiGet(`/api/compete/competitions/${competitionId}/heats`, HeatsResponseSchema)
}

export function getWorkouts(competitionId: string): Effect.Effect<WorkoutsResponse, unknown> {
  return apiGet(`/api/compete/competitions/${competitionId}/workouts`, WorkoutsResponseSchema)
}

export function getLeaderboard(
  competitionId: string,
  divisionId?: string,
): Effect.Effect<unknown, unknown> {
  const query = divisionId ? `?divisionId=${divisionId}` : ""
  return Effect.tryPromise({
    try: async () => {
      const apiBase = import.meta.env.VITE_API_BASE_URL || ""
      const res = await fetch(
        `${apiBase}/api/compete/competitions/${competitionId}/leaderboard${query}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    catch: (error) => error,
  })
}

export function getRegistrations(
  token: string,
  competitionId?: string,
): Effect.Effect<ReadonlyArray<Registration>, unknown> {
  const query = competitionId ? `?competitionId=${competitionId}` : ""
  return apiGet(
    `/api/compete/registrations/me${query}`,
    RegistrationsResponseSchema,
    token,
  ).pipe(Effect.map((res) => res.registrations))
}

export function getWindowStatus(
  competitionId: string,
  trackWorkoutId: string,
): Effect.Effect<WindowStatus, unknown> {
  return apiGet(
    `/api/compete/scores/window-status?competitionId=${competitionId}&trackWorkoutId=${trackWorkoutId}`,
    WindowStatusSchema,
  )
}

import { Effect } from "effect"
import { apiPost } from "./client"
import {
  ScoreSubmitResponseSchema,
  VideoSubmitResponseSchema,
  type ScoreSubmitResponse,
  type VideoSubmitResponse,
} from "./schemas"

interface ScoreSubmission {
  competitionId: string
  trackWorkoutId: string
  score: string
  status: "scored" | "cap"
  secondaryScore?: string
  tiebreakScore?: string
}

interface VideoSubmission {
  trackWorkoutId: string
  competitionId: string
  videoUrl: string
  notes?: string
  score?: string
  scoreStatus?: "scored" | "cap"
  secondaryScore?: string
  tiebreakScore?: string
}

export function submitScore(
  submission: ScoreSubmission,
  token: string,
): Effect.Effect<ScoreSubmitResponse, unknown> {
  return apiPost("/api/compete/scores/submit", submission, ScoreSubmitResponseSchema, token)
}

export function submitVideo(
  submission: VideoSubmission,
  token: string,
): Effect.Effect<VideoSubmitResponse, unknown> {
  return apiPost("/api/compete/video/submit", submission, VideoSubmitResponseSchema, token)
}

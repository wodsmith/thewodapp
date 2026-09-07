import type {
  TrainingRichScoreInput,
  TrainingScoreDetailsSnapshot,
} from "@repo/wodsmith-db/schemas/training"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
export type TrainingScoreDetails = TrainingScoreDetailsSnapshot
export type TrainingWorkoutScoreInput = TrainingRichScoreInput

export type TrainingBlockKind =
  | "check"
  | "load"
  | "time"
  | "reps"
  | "note"
  | "workout"
export type TrainingScaling = "rx" | "scaled" | "custom"
export type TrainingAudience = "gym" | "private"

export interface TrainingBlock {
  id: string
  kind: TrainingBlockKind
  workout?: NormalizedWorkoutSave
  title: string
  prescription: string
  scalingGuidance: string
  coachGuidance: string
}

export interface TrainingContent {
  title: string
  coachNote: string
  isRestDay: boolean
  blocks: TrainingBlock[]
}

export interface TrainingTrack {
  id: string
  name: string
  description: string | null
}

export interface TrainingTeam {
  id: string
  name: string
  timezone: string
  isPersonal?: boolean
  canProgram: boolean
  tracks: TrainingTrack[]
}

export interface TrainingContext {
  userId: string
  activeTeamId: string | null
  teams: TrainingTeam[]
}

export interface TrainingSession {
  id: string
  teamId: string
  trackId: string
  trainingDate: string
  timezone: string
  revision: number
  publishedVersion: number
  draft: TrainingContent | null
  published: TrainingContent | null
}

export interface TrainingResult {
  id: string
  sessionId: string
  blockId: string
  publishedVersion: number
  userId: string
  userName: string
  trainingDate: string
  trackId: string
  block: TrainingBlock
  scoreValue: number | null
  displayScore: string
  details?: TrainingScoreDetails | null
  scaling: TrainingScaling
  modification: string
  audience: TrainingAudience
  unit: "lb" | "kg"
  completed: boolean
  cheerCount: number
  hasCheered: boolean
}

export interface OwnTrainingResult extends TrainingResult {
  notes: string
}

export interface TrainingProviderDay {
  id: string
  date: string
  url: string
  kind: string | null
  markdown: string | null
  workouts: Array<{
    workoutId: string
    name: string
    scheme: string
    description?: string
    importId?: string
    scoreType?: string | null
    roundsToScore?: number | null
    timeCap?: number | null
  }>
}

export type TrainingSource =
  | { kind: "coach-session"; session: TrainingSession }
  | { kind: "provider-day"; day: TrainingProviderDay }
  | { kind: "unavailable" }

export interface TrainingWeek {
  providerDays?: TrainingProviderDay[]
  sessions: TrainingSession[]
  myResults: OwnTrainingResult[]
  teamResults: TrainingResult[]
}

export interface SaveTrainingDraftInput {
  teamId: string
  trackId: string
  trainingDate: string
  timezone: string
  expectedRevision: number
  content: TrainingContent
}

export interface SaveTrainingResultInput extends TrainingRichScoreInput {
  sessionId: string
  blockId: string
  publishedVersion: number
  score: string
  scaling: TrainingScaling
  modification: string
  notes: string
  audience: TrainingAudience
  unit: "lb" | "kg"
  completed: boolean
}

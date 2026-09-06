import type { OwnTrainingResult, TrainingBlock, TrainingSession } from "./types"

export interface TrainingSourceReference {
  sourceSessionId: string
  sourceBlockId: string
  sourcePublishedVersion: number
}
export interface PersonalSourceItem extends TrainingSourceReference {
  id: string
  kind: "source"
  sourceIsCurrent?: boolean
  block: TrainingBlock
  trackId: string
  trackName: string
  sourceTrainingDate: string
}
export interface PersonalOwnedItem {
  id: string
  kind: "personal"
  block: TrainingBlock
  remixedFrom?: TrainingSourceReference
}
export interface PersonalLibraryItem {
  id: string
  kind: "library"
  workoutId: string
  workout: {
    name: string
    description: string
    scheme: string
    scoreType?: string | null
    timeCap?: number | null
    roundsToScore?: number | null
    repsPerRound?: number | null
    tiebreakScheme?: string | null
    scalingGroupId?: string | null
  }
}
export type PersonalTrainingItem =
  | PersonalSourceItem
  | PersonalOwnedItem
  | PersonalLibraryItem
export type PersonalTrainingItemInput =
  | ({ id: string; kind: "source" } & TrainingSourceReference)
  | PersonalOwnedItem
  | { id: string; kind: "library"; workoutId: string }

export interface PersonalTrainingSession {
  id: string
  teamId: string
  trainingDate: string
  revision: number
  items: PersonalTrainingItem[]
}
export interface PersonalTrainingDay {
  defaultTrackId: string | null
  selectedTrackId: string | null
  sourceSession: TrainingSession | null
  personalSession: PersonalTrainingSession | null
  items: PersonalTrainingItem[]
  results: OwnTrainingResult[]
  libraryResults: { itemId: string; scoreId: string }[]
}
export interface SavePersonalTrainingSessionInput {
  teamId: string
  trainingDate: string
  expectedRevision: number
  items: PersonalTrainingItemInput[]
}
export interface SavePersonalTrainingResultInput {
  personalSessionId: string
  itemId: string
  expectedRevision: number
  score: string
  notes: string
  unit: "lb" | "kg"
  completed: boolean
}

import type { WorkoutImportDraft } from "./schemas"

/** Plain Agents state/RPC contract. No token-stream or AIChatAgent protocol. */
export interface WorkoutImportAgentState {
  status:
    | "idle"
    | "reading"
    | "checking"
    | "ready"
    | "needs_input"
    | "failed"
    | "cancelled"
  draft: WorkoutImportDraft | null
  error: { code: string } | null
  runId: string | null
  requestId: string | null
}

export const initialWorkoutImportState: WorkoutImportAgentState = {
  status: "idle",
  draft: null,
  error: null,
  runId: null,
  requestId: null,
}

export interface WorkoutImportRetryInput {
  expectedRevision: number
  requestId: string
}
export interface WorkoutImportSessionResponse {
  importId: string
  agentName: string
  expiresAt: string
}
export interface WorkoutImportSourceResponse {
  imageId: string
  url: string
}

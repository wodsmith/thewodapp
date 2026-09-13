import { z } from "zod"

export const agentScopes = [
  "training:read",
  "training:write",
  "workouts:write",
  "workouts:delete",
  "results:write",
  "results:delete",
  "programming:read",
  "programming:write",
  "programming:publish",
] as const
export type AgentScope = (typeof agentScopes)[number]
export const agentScopeSchema = z.enum(agentScopes)
export const grantIdentitySchema = z
  .object({
    grantId: z.string().min(1),
    userId: z.string().min(1),
    clientId: z.string().min(1),
  })
  .strict()
export type GrantIdentity = z.infer<typeof grantIdentitySchema>
export interface AgentActor extends GrantIdentity {
  scopes: string[]
  allowedTeamIds: string[]
}
export interface AgentOperation {
  name: string
  description: string
  inputSchema: { type: "object"; [key: string]: unknown }
  outputSchema?: { type: "object"; [key: string]: unknown }
  annotations: {
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
    openWorldHint: boolean
  }
}
export type AgentOutcome =
  | { ok: true; data: Record<string, unknown> }
  | {
      ok: false
      error: {
        code:
          | "VALIDATION"
          | "CONFLICT"
          | "FORBIDDEN"
          | "NOT_AUTHORIZED"
          | "NOT_FOUND"
          | "UNAVAILABLE"
        message: string
      }
    }
export interface AgentService {
  authorize(token: string): Promise<boolean>
  listOperations(token: string): Promise<AgentOperation[]>
  execute(
    token: string,
    operation: string,
    input: Record<string, unknown>,
  ): Promise<AgentOutcome>
}
export const scopeLabels: Record<AgentScope, string> = {
  "training:read": "Read my training, sources, workouts and results",
  "training:write": "Create plans and change my personal sessions",
  "workouts:write": "Create and edit my workouts",
  "workouts:delete": "Delete my workouts",
  "results:write": "Log and correct my results",
  "results:delete": "Delete my results",
  "programming:read": "Read programming I manage",
  "programming:write": "Edit programming drafts I manage",
  "programming:publish": "Publish programming to subscribers",
}

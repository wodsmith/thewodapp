import { WorkerEntrypoint } from "cloudflare:workers"
import type {
  AgentOperation,
  AgentOutcome,
  AgentService,
} from "@repo/agent-auth"
import { getDb } from "../db"
import {
  executeAgentOperation,
  listAgentOperations,
} from "../server/training-agent"
import { hasCurrentWorkoutFeature } from "../server/workout-import/access"
import { assertLiveAgentGrant, resolveAgentActor } from "./grants"

import {
  executePlanningOperation,
  isPlanningOperation,
  listPlanningOperations,
} from "./planning-operations"

/** Only a Cloudflare service binding can invoke these methods. No public RPC route. */
export class AgentTrainingService
  extends WorkerEntrypoint<Env>
  implements AgentService
{
  async authorize(token: string) {
    return Boolean(await resolveAgentActor(token, this.env))
  }
  async listOperations(token: string): Promise<AgentOperation[]> {
    const actor = await resolveAgentActor(token, this.env)
    if (!actor) throw new Error("NOT_AUTHORIZED: Reconnect to WodSmith")
    return [
      ...listAgentOperations(actor).map((operation) => ({
        name: operation.name,
        description: operation.description,
        inputSchema: objectSchema(operation.inputSchema),
        outputSchema: objectSchema(operation.outputSchema),
        annotations: operation.annotations,
      })),
      ...listPlanningOperations(actor),
    ]
  }
  async execute(
    token: string,
    operation: string,
    input: Record<string, unknown>,
  ): Promise<AgentOutcome> {
    try {
      const actor = await resolveAgentActor(token, this.env)
      if (!actor)
        return {
          ok: false,
          error: { code: "NOT_AUTHORIZED", message: "Reconnect to WodSmith" },
        }
      const db = getDb()
      if (isPlanningOperation(operation))
        return executePlanningOperation(
          {
            db,
            actor,
            authorizeActor: assertLiveAgentGrant,
            hasFeature: (teamId, featureId, executor) =>
              hasCurrentWorkoutFeature(executor, teamId, featureId),
          },
          actor,
          operation,
          input,
        )
      return executeAgentOperation(
        {
          db,
          actor,
          hasFeature: (teamId, featureId, executor) =>
            hasCurrentWorkoutFeature(executor, teamId, featureId),
        },
        operation,
        input,
      )
    } catch {
      return {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message: "Training is temporarily unavailable. Try again.",
        },
      }
    }
  }
}
function objectSchema(
  value: Record<string, unknown>,
): AgentOperation["inputSchema"] {
  if (value.type !== "object")
    throw new Error("Training operations require object schemas")
  return { ...value, type: "object" }
}

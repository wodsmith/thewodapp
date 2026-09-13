import {
  assertTrainingActor,
  assertTrainingScope,
  type TrainingActor,
  type TrainingScope,
} from "@repo/wodsmith-training"
import { z } from "zod"
import { createPersonalTrainingService } from "./training-personal-service"
import {
  personalTrainingDaySchema,
  personalTrainingItemSchema,
  trainingLibraryListSchema,
  trainingLibraryWorkoutSchema,
} from "./training-personal-validation"
import { createTrainingService } from "./training-service"
import type { TrainingServiceDependencies } from "./training-service-contract"
import {
  trainingTrackInputSchema,
  trainingWeekInputSchema,
} from "./training-validation"

import {
  createOwnedWorkout,
  createOwnedWorkoutSchema,
  updateOwnedWorkout,
  updateOwnedWorkoutSchema,
  deleteOwnedWorkout,
  deleteOwnedWorkoutSchema,
  getAgentWorkout,
} from "./training-workout-mutations"
import {
  createOwnedResultSchema,
  updateOwnedResultSchema,
  deleteOwnedResultSchema,
  getOwnedResultSchema,
  getOwnedResult,
  saveOwnedResult,
  deleteOwnedResult,
} from "./training-result-mutations"
import {
  agentTrainingDraftSchema,
  agentTrainingPublishSchema,
  agentPersonalDaySchema,
  saveAgentTrainingDraft,
  publishAgentTrainingSession,
  saveAgentPersonalDay,
} from "./training-programming-mutations"
import {
  getTrainingMutationReceipt,
  trainingMutationReceiptSchema,
} from "./training-mutations"

export type AgentOperationOutcome =
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
export interface AgentOperationDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  requiredScopes: TrainingScope[]
  annotations: {
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
    openWorldHint: boolean
  }
}
const outputSchema = {
  type: "object",
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    data: { type: "object" },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  },
}
function readOperation<T>(
  name: string,
  description: string,
  schema: z.ZodType<T>,
  run: (
    deps: TrainingServiceDependencies,
    input: T,
  ) => Promise<Record<string, unknown>>,
) {
  return {
    name,
    description,
    schema,
    readOnly: true,
    destructive: false,
    requiredScopes: ["training:read"] as TrainingScope[],
    run: (deps: TrainingServiceDependencies, input: unknown) =>
      run(deps, schema.parse(input)),
  }
}
function mutationOperation<T>(
  name: string,
  description: string,
  schema: z.ZodType<T>,
  scopes: TrainingScope[],
  run: (
    deps: TrainingServiceDependencies,
    input: T,
  ) => Promise<Record<string, unknown>>,
  destructive = false,
) {
  return {
    ...readOperation(name, description, schema, run),
    requiredScopes: scopes,
    readOnly: false,
    destructive,
  }
}
const operations = [
  readOperation(
    "get_training_context",
    "Read current permitted workspaces and programming tracks.",
    z.object({}).strict(),
    async (deps) => ({
      context: await createTrainingService(deps).getTrainingContext(),
    }),
  ),
  readOperation(
    "get_training_week",
    "Read published programming and your own results for seven days. No leaderboard or other athletes' results.",
    trainingWeekInputSchema.omit({ mode: true }),
    async (deps, input) => {
      const { sessions, myResults, providerDays } = await createTrainingService(
        deps,
      ).getTrainingWeek({ ...input, mode: "athlete" })
      const personalService = createPersonalTrainingService(deps)
      const personalDays = []
      for (let offset = 0; offset < 7; offset++) {
        const date = new Date(`${input.startDate}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + offset)
        const trainingDate = date.toISOString().slice(0, 10)
        const day = await personalService.getPersonalTrainingDay({
          teamId: input.teamId,
          trackId: input.trackId,
          trainingDate,
        })
        personalDays.push({
          trainingDate,
          accessTeamId: input.teamId,
          state:
            day.personalSession &&
            day.personalSession.compositionState !== "result_only"
              ? "saved"
              : "projection",
          personalSession: day.personalSession,
          items: day.items,
          results: day.results,
          libraryResults: day.libraryResults,
        })
      }
      return { sessions, myResults, providerDays, personalDays }
    },
  ),
  {
    ...readOperation(
      "get_programming_week",
      "Read draft and published programming for an authorized programmer. Does not return other athletes' results.",
      trainingWeekInputSchema.omit({ mode: true }),
      async (deps, input) => ({
        sessions: (
          await createTrainingService(deps).getTrainingWeek({
            ...input,
            mode: "coach",
          })
        ).sessions,
      }),
    ),
    requiredScopes: ["training:read", "programming:read"] as TrainingScope[],
  },
  readOperation(
    "get_personal_training_day",
    "Read your saved composition and source day without creating a session. Workspace-scoped storage; cross-workspace day merging is unavailable.",
    personalTrainingDaySchema,
    async (deps, input) => ({
      day:
        await createPersonalTrainingService(deps).getPersonalTrainingDay(input),
    }),
  ),
  readOperation(
    "list_workouts",
    "Search accessible library workout definitions.",
    trainingLibraryListSchema,
    async (deps, input) => ({
      workouts:
        await createPersonalTrainingService(deps).listTrainingLibraryWorkouts(
          input,
        ),
    }),
  ),
  readOperation(
    "get_workout",
    "Read a canonical library definition and exact optional source occurrence.",
    trainingLibraryWorkoutSchema,
    getAgentWorkout,
  ),
  readOperation(
    "get_training_history",
    "Read your own published results for the selected track and your personal result history for the workspace. Each collection is bounded to 100 rows.",
    trainingTrackInputSchema,
    async (deps, input) => ({
      publishedHistoryScope: { teamId: input.teamId, trackId: input.trackId },
      personalHistoryScope: { teamId: input.teamId },
      results: await createTrainingService(deps).getTrainingHistory(input),
      personalResults:
        await createPersonalTrainingService(deps).getPersonalTrainingHistory(
          input,
        ),
    }),
  ),
  readOperation(
    "get_workout_definition_schema",
    "Discover complete canonical source, library and personal item inputs including scoring, movement and scaling references.",
    z.object({}).strict(),
    async () => ({ itemSchema: z.toJSONSchema(personalTrainingItemSchema) }),
  ),
  readOperation(
    "get_result",
    "Read one owned result with complete scoring details and an edit version.",
    getOwnedResultSchema,
    getOwnedResult,
  ),
  readOperation(
    "get_mutation_receipt",
    "Read your original mutation result and trusted client origin.",
    trainingMutationReceiptSchema,
    getTrainingMutationReceipt,
  ),
  mutationOperation(
    "create_workout",
    "Create a reusable workout in your personal library with complete scoring fields.",
    createOwnedWorkoutSchema,
    ["workouts:write"],
    createOwnedWorkout,
  ),
  mutationOperation(
    "update_workout",
    "Replace an owned library definition after checking the version returned by get_workout.",
    updateOwnedWorkoutSchema,
    ["workouts:write"],
    updateOwnedWorkout,
    true,
  ),
  mutationOperation(
    "delete_workout",
    "Archive an owned library definition from new selection while retaining its definition for history and existing programming.",
    deleteOwnedWorkoutSchema,
    ["workouts:delete"],
    deleteOwnedWorkout,
    true,
  ),
  mutationOperation(
    "create_result",
    "Create an owned result or direct library attempt. Fails if this occurrence already has a result; source audience must be explicit.",
    createOwnedResultSchema,
    ["training:read", "results:write"],
    (deps, input) => saveOwnedResult(deps, input, "create"),
  ),
  mutationOperation(
    "update_result",
    "Update an owned result with its current version, retaining canonical rounds, caps, units and scoring.",
    updateOwnedResultSchema,
    ["training:read", "results:write"],
    (deps, input) => saveOwnedResult(deps, input, "update"),
    true,
  ),
  mutationOperation(
    "delete_result",
    "Delete an owned training result and its linked personal score rounds. Keeps the day composition; competition and scheduled scores require their original context.",
    deleteOwnedResultSchema,
    ["results:delete"],
    deleteOwnedResult,
    true,
  ),
  mutationOperation(
    "save_personal_training_day",
    "Replace one reviewed personal day using its expected revision. Does not log results. Cross-workspace day conflicts require resolution in Training.",
    agentPersonalDaySchema,
    ["training:read", "training:write"],
    saveAgentPersonalDay,
    true,
  ),
  mutationOperation(
    "save_programming_draft",
    "Save programmer-owned draft content with expected revision and current programming permission.",
    agentTrainingDraftSchema,
    ["programming:write"],
    saveAgentTrainingDraft,
    true,
  ),
  mutationOperation(
    "publish_programming",
    "Publish a reviewed programming draft with expected revision and explicit publish scope.",
    agentTrainingPublishSchema,
    ["programming:publish"],
    publishAgentTrainingSession,
    true,
  ),
]

export function listAgentOperations(
  actor: TrainingActor,
): AgentOperationDefinition[] {
  assertTrainingActor(actor)
  return operations
    .filter((operation) =>
      operation.requiredScopes.every(
        (scope) => !actor.scopes || actor.scopes.includes(scope),
      ),
    )
    .map((operation) => ({
      name: operation.name,
      description: operation.description,
      inputSchema: z.toJSONSchema(operation.schema),
      outputSchema,
      requiredScopes: operation.requiredScopes,
      annotations: {
        readOnlyHint: operation.readOnly,
        destructiveHint: operation.destructive,
        idempotentHint: true,
        openWorldHint: false,
      },
    }))
}

export async function executeAgentOperation(
  dependencies: TrainingServiceDependencies,
  name: string,
  input: unknown,
): Promise<AgentOperationOutcome> {
  try {
    const operation = operations.find((operation) => operation.name === name)
    if (!operation)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Unknown training operation" },
      }
    for (const scope of operation.requiredScopes)
      assertTrainingScope(dependencies.actor, scope)
    return { ok: true, data: await operation.run(dependencies, input) }
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
      }
    const message = error instanceof Error ? error.message : ""
    const code = (
      [
        "VALIDATION",
        "CONFLICT",
        "FORBIDDEN",
        "NOT_AUTHORIZED",
        "NOT_FOUND",
      ] as const
    ).find((code) => message.startsWith(`${code}:`))
    return code
      ? {
          ok: false,
          error: { code, message: message.slice(code.length + 1).trim() },
        }
      : {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "Training could not complete this operation. Try again.",
          },
        }
  }
}

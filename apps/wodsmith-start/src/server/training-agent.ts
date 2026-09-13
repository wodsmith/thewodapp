import {
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
    requiredScopes: ["training:read"] as TrainingScope[],
    run: (deps: TrainingServiceDependencies, input: unknown) =>
      run(deps, schema.parse(input)),
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
          state: day.personalSession ? "saved" : "projection",
          personalSession: day.personalSession,
          items: day.items,
          results: day.results,
          libraryResults: day.libraryResults,
        })
      }
      return { sessions, myResults, providerDays, personalDays }
    },
  ),
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
    async (deps, input) => ({
      workout:
        await createPersonalTrainingService(deps).getTrainingLibraryWorkout(
          input,
        ),
    }),
  ),
  readOperation(
    "get_training_history",
    "Read your own published results for the selected track and your personal result history for the workspace. Each collection is bounded to 100 rows.",
    trainingTrackInputSchema,
    async (deps, input) => ({
      publishedHistoryScope: {teamId: input.teamId, trackId: input.trackId},
      personalHistoryScope: {teamId: input.teamId},
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
]

export function listAgentOperations(
  actor: TrainingActor,
): AgentOperationDefinition[] {
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
        readOnlyHint: true,
        destructiveHint: false,
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

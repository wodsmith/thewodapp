import type { AgentActor, AgentOperation, AgentOutcome } from "@repo/agent-auth"
import { z } from "zod"
import {
  createTrainingPlanningService,
  getSessionBlueprint,
  trainingPlanOperationSchemas as schemas,
  type TrainingPlanningDependencies,
} from "../server/training-plans"

const metadata = {
  get_session_blueprint: {
    description:
      "Read the versioned session-building guide and canonical planning structure.",
    scope: "training:read",
    read: true,
    destructive: false,
    idempotent: true,
  },
  create_training_plan: {
    description:
      "Save a portable weekly proposal. This does not create live personal sessions.",
    scope: "training:write",
    read: false,
    destructive: false,
    idempotent: false,
  },
  list_training_plans: {
    description:
      "Find your saved planning drafts and commits to resume across clients.",
    scope: "training:read",
    read: true,
    destructive: false,
    idempotent: true,
  },
  get_training_plan: {
    description: "Read a saved planning proposal and its current revision.",
    scope: "training:read",
    read: true,
    destructive: false,
    idempotent: true,
  },
  update_training_plan: {
    description: "Update your saved proposal using its expected revision.",
    scope: "training:write",
    read: false,
    destructive: true,
    idempotent: false,
  },
  delete_training_plan: {
    description:
      "Delete a planning draft using its expected revision; performed history is preserved.",
    scope: "training:write",
    read: false,
    destructive: true,
    idempotent: false,
  },
  preview_training_plan: {
    description:
      "Review a proposal against current source and session revisions. Keep its preview digest for commit.",
    scope: "training:read",
    read: true,
    destructive: false,
    idempotent: true,
  },
  commit_training_plan: {
    description:
      "Atomically save the reviewed week using its revision, preview digest and idempotency key. Retry a lost response with the same key and payload.",
    scope: "training:write",
    read: false,
    destructive: true,
    idempotent: true,
  },
} as const
export type PlanningOperation = keyof typeof metadata
export function isPlanningOperation(name: string): name is PlanningOperation {
  return Object.hasOwn(metadata, name)
}
export function listPlanningOperations(actor: AgentActor): AgentOperation[] {
  return (Object.keys(metadata) as PlanningOperation[])
    .filter((name) => actor.scopes.includes(metadata[name].scope))
    .map((name) => {
      const spec = metadata[name]
      return {
        name,
        description: spec.description,
        inputSchema: { ...z.toJSONSchema(schemas[name]), type: "object" },
        outputSchema: {
          type: "object",
          required: ["ok"],
          properties: {
            ok: { type: "boolean" },
            data: { type: "object" },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        annotations: {
          readOnlyHint: spec.read,
          destructiveHint: spec.destructive,
          idempotentHint: spec.idempotent,
          openWorldHint: false,
        },
      }
    })
}
export async function executePlanningOperation(
  deps: TrainingPlanningDependencies,
  actor: AgentActor,
  name: PlanningOperation,
  input: unknown,
): Promise<AgentOutcome> {
  try {
    const scope = metadata[name].scope
    if (!actor.scopes.includes(scope))
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: `The connection requires ${scope}`,
        },
      }
    if (!deps.authorizeActor)
      throw new Error(
        "FORBIDDEN: Planning requires current grant authorization",
      )
    await deps.authorizeActor(deps.db, actor, scope)
    const service = createTrainingPlanningService(deps)
    let data: Record<string, unknown>
    switch (name) {
      case "get_session_blueprint":
        data = {
          blueprint: getSessionBlueprint(schemas[name].parse(input).version),
        }
        break
      case "create_training_plan":
        data = await service.create(actor, schemas[name].parse(input))
        break
      case "list_training_plans":
        data = await service.list(actor, schemas[name].parse(input))
        break
      case "get_training_plan":
        data = await service.get(actor, schemas[name].parse(input))
        break
      case "update_training_plan":
        data = await service.update(actor, schemas[name].parse(input))
        break
      case "delete_training_plan":
        data = await service.delete(actor, schemas[name].parse(input))
        break
      case "preview_training_plan":
        data = await service.preview(actor, schemas[name].parse(input))
        break
      case "commit_training_plan":
        data = { ...(await service.commit(actor, schemas[name].parse(input))) }
        break
    }
    return { ok: true, data }
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
    const [prefix] = message.split(":", 1)
    const codes: Record<
      string,
      "VALIDATION" | "CONFLICT" | "FORBIDDEN" | "NOT_AUTHORIZED" | "NOT_FOUND"
    > = {
      VALIDATION: "VALIDATION",
      INVALID_INPUT: "VALIDATION",
      UNSUPPORTED_BLUEPRINT: "VALIDATION",
      MISSING_INPUTS: "VALIDATION",
      EMPTY_PLAN: "VALIDATION",
      CONFLICT: "CONFLICT",
      REVISION_CONFLICT: "CONFLICT",
      PLAN_COMMITTED: "CONFLICT",
      PREVIEW_STALE: "CONFLICT",
      IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT: "CONFLICT",
      FORBIDDEN: "FORBIDDEN",
      NOT_AUTHORIZED: "NOT_AUTHORIZED",
      NOT_FOUND: "NOT_FOUND",
    }
    const code =
      prefix && Object.hasOwn(codes, prefix) ? codes[prefix] : undefined
    return {
      ok: false,
      error: code
        ? { code, message }
        : {
            code: "UNAVAILABLE",
            message: "Planning is temporarily unavailable. Try again.",
          },
    }
  }
}

import {
  trainingMutationReceiptsTable,
  userTable,
} from "@repo/wodsmith-db/schema"
import {
  assertTrainingScope,
  assertTrainingTeam,
  type TrainingScope,
} from "@repo/wodsmith-training"
import { eq } from "drizzle-orm"
import { z } from "zod"
import type {
  TrainingServiceDependencies,
  TrainingTransaction,
} from "./training-service-contract"

export const mutationFields = {
  idempotencyKey: z.string().min(1).max(128),
  teamId: z.string().min(1).max(255),
}
export const expectedVersionSchema = z.string().regex(/^[a-f0-9]{64}$/)

function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`
  return JSON.stringify(value) ?? "null"
}
export async function trainingVersion(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}
export async function assertTrainingVersion(
  value: unknown,
  expected: string | null,
): Promise<void> {
  const actual = value === null ? null : await trainingVersion(value)
  if (actual !== expected)
    throw new Error(
      "CONFLICT: The saved record changed; read it again before editing",
    )
}

/** One SQL transaction for live authority, mutation and durable retry receipt. */
export async function runTrainingMutation<
  T extends { teamId: string; idempotencyKey: string },
>(
  dependencies: TrainingServiceDependencies,
  operation: string,
  scope: TrainingScope,
  input: T,
  authorize: (tx: TrainingTransaction) => Promise<void>,
  work: (tx: TrainingTransaction) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const { actor } = dependencies
  assertTrainingScope(actor, scope)
  assertTrainingTeam(actor, input.teamId)
  if (actor.grantId && !dependencies.authorizeActor)
    throw new Error("FORBIDDEN: Live grant validation is required")
  const receiptId = await trainingVersion([
    actor.userId,
    operation,
    input.idempotencyKey,
  ])
  const payloadHash = await trainingVersion(input)
  return dependencies.db.transaction(
    async (tx) => {
      const [user] = await tx
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.id, actor.userId))
        .for("update")
      if (!user) throw new Error("NOT_AUTHORIZED: Athlete is unavailable")
      await dependencies.authorizeActor?.(tx, actor, scope)
      await authorize(tx)
      const [receipt] = await tx
        .select()
        .from(trainingMutationReceiptsTable)
        .where(eq(trainingMutationReceiptsTable.id, receiptId))
        .for("update")
      if (receipt) {
        if (
          receipt.payloadHash !== payloadHash ||
          receipt.teamId !== input.teamId
        )
          throw new Error(
            "CONFLICT: This idempotency key was used for a different request",
          )
        return receipt.result
      }
      const changed = await work(tx)
      const origin = actor.grantId
        ? { kind: "agent", clientId: actor.clientId, grantId: actor.grantId }
        : { kind: "web" }
      const result = {
        ...changed,
        receipt: { id: receiptId, operation, origin },
      }
      // JSON round-trip gives the first response and retries identical wire values.
      const stored = JSON.parse(JSON.stringify(result)) as Record<
        string,
        unknown
      >
      await tx.insert(trainingMutationReceiptsTable).values({
        id: receiptId,
        userId: actor.userId,
        teamId: input.teamId,
        operation,
        payloadHash,
        result: stored,
        createdAt: new Date(),
      })
      return stored
    },
    { isolationLevel: "read committed" },
  )
}

export const trainingMutationReceiptSchema = z.object({
  teamId: z.string().min(1).max(255),
  receiptId: expectedVersionSchema,
})
export async function getTrainingMutationReceipt(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof trainingMutationReceiptSchema>,
) {
  assertTrainingScope(deps.actor, "training:read")
  const data = trainingMutationReceiptSchema.parse(input)
  const { createTrainingService } = await import("./training-service")
  await createTrainingService(deps).requireTrainingAccess(data.teamId)
  const [receipt] = await deps.db
    .select()
    .from(trainingMutationReceiptsTable)
    .where(eq(trainingMutationReceiptsTable.id, data.receiptId))
  if (
    !receipt ||
    receipt.userId !== deps.actor.userId ||
    receipt.teamId !== data.teamId
  )
    throw new Error("NOT_FOUND: Mutation receipt not found")
  if (
    receipt.operation === "save_programming_draft" ||
    receipt.operation === "publish_programming"
  ) {
    assertTrainingScope(deps.actor, "programming:read")
    const stored = z
      .object({
        session: z.object({ teamId: z.string(), trackId: z.string() }),
      })
      .safeParse(receipt.result)
    if (!stored.success || stored.data.session.teamId !== receipt.teamId)
      throw new Error("FORBIDDEN: Programming receipt is unavailable")
    await createTrainingService(deps).requireTrainingAccess(
      receipt.teamId,
      stored.data.session.trackId,
      true,
    )
  }
  return { result: receipt.result, createdAt: receipt.createdAt.toISOString() }
}

import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { eq } from "drizzle-orm"
import { type Database, getDb } from "@/db"
import {
  workoutImportReceiptsTable,
  workoutImportSessionsTable,
} from "@/db/schema"
import {
  type WorkoutImportDestination,
  type WorkoutImportDraft,
  type WorkoutImportProposal,
  type WorkoutImportSource,
  type WorkoutImportWorkout,
  workoutImportDraftSchema,
  workoutImportProposalSchema,
} from "@/lib/workout-import"
import {
  requireWorkoutImportAccess,
  type WorkoutImportDatabase,
} from "./access"

import { WorkoutImportSessionExpiredError } from "./session-errors"

export interface WorkoutImportSession {
  importId: string
  userId: string
  teamId: string
  destination: WorkoutImportDestination
  revision: number
  proposal: WorkoutImportProposal | null
  draft: WorkoutImportDraft | null
  expiresAt: string
}

export async function loadWorkoutImportSessionForUpdate(
  db: WorkoutImportDatabase,
  userId: string,
  importId: string,
): Promise<WorkoutImportSession> {
  const [row] = await db
    .select()
    .from(workoutImportSessionsTable)
    .where(eq(workoutImportSessionsTable.id, importId))
    .for("update")
  if (!row || row.userId !== userId)
    throw new Error("Workout import session not found")
  const draft = row.proposal
    ? workoutImportDraftSchema.parse(row.proposal)
    : null
  const proposal = draft
    ? {
        workout: draft.workout,
        extractedText: draft.extractedText,
        unresolved: draft.unresolved,
        warnings: draft.warnings,
      }
    : null
  return {
    importId: row.id,
    userId: row.userId,
    teamId: row.teamId,
    destination: row.trackId
      ? { kind: "track", trackId: row.trackId }
      : { kind: "personal" },
    revision: row.revision,
    proposal,
    draft,
    expiresAt: row.expiresAt.toISOString(),
  }
}

export async function authorizeWorkoutImportSession(
  db: WorkoutImportDatabase,
  session: WorkoutImportSession,
): Promise<void> {
  const scope = await requireWorkoutImportAccess(
    { userId: session.userId, destination: session.destination },
    db,
  )
  if (scope.teamId !== session.teamId)
    throw new Error("Workout import destination changed")
  if (Date.parse(session.expiresAt) <= Date.now())
    throw new WorkoutImportSessionExpiredError()
}

export async function createWorkoutImportSession(
  input: { userId: string; destination: WorkoutImportDestination },
  db: Database = getDb(),
): Promise<WorkoutImportSession> {
  return db.transaction(
    async (tx) => {
      const scope = await requireWorkoutImportAccess(input, tx)
      const session: WorkoutImportSession = {
        ...scope,
        importId: `wimp_${createId()}`,
        revision: 0,
        proposal: null,
        draft: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
      await tx.insert(workoutImportSessionsTable).values({
        id: session.importId,
        userId: scope.userId,
        teamId: scope.teamId,
        trackId:
          scope.destination.kind === "track" ? scope.destination.trackId : null,
        revision: 0,
        expiresAt: new Date(session.expiresAt),
      })
      return session
    },
    { isolationLevel: "read committed" },
  )
}

export async function requireWorkoutImportSession(
  input: { userId: string; importId: string },
  db: Database = getDb(),
): Promise<WorkoutImportSession> {
  return db.transaction(
    async (tx) => {
      const session = await loadWorkoutImportSessionForUpdate(
        tx,
        input.userId,
        input.importId,
      )
      await authorizeWorkoutImportSession(tx, session)
      return session
    },
    { isolationLevel: "read committed" },
  )
}

export async function publishWorkoutImportRevision(
  input: {
    userId: string
    importId: string
    expectedRevision: number
    proposal: WorkoutImportProposal
    source: WorkoutImportSource
    requestId: string
    changedFields: (keyof WorkoutImportWorkout)[]
  },
  db: Database = getDb(),
): Promise<WorkoutImportSession> {
  const proposal = workoutImportProposalSchema.parse(input.proposal)
  if (
    new Set(proposal.unresolved.map((q) => q.id)).size !==
    proposal.unresolved.length
  )
    throw new Error("Question IDs must be unique")
  return db.transaction(
    async (tx) => {
      const session = await loadWorkoutImportSessionForUpdate(
        tx,
        input.userId,
        input.importId,
      )
      await authorizeWorkoutImportSession(tx, session)
      const receipt = await tx.query.workoutImportReceiptsTable.findFirst({
        where: (t, { eq }) => eq(t.importId, input.importId),
      })
      if (receipt) throw new Error("Workout import already saved")
      if (session.revision !== input.expectedRevision)
        throw new Error("Workout import revision changed")
      const draft = workoutImportDraftSchema.parse({
        ...proposal,
        schemaVersion: 1,
        importId: session.importId,
        revision: session.revision + 1,
        requestId: input.requestId,
        source: input.source,
        changedFields: input.changedFields,
        status: proposal.unresolved.length ? "needs_input" : "ready",
      })
      await authorizeWorkoutImportSession(tx, session)
      await tx
        .update(workoutImportSessionsTable)
        .set({ revision: session.revision + 1, proposal: draft })
        .where(eq(workoutImportSessionsTable.id, input.importId))
      return { ...session, revision: session.revision + 1, proposal, draft }
    },
    { isolationLevel: "read committed" },
  )
}

/** Cancellation/cleanup needs ownership, never a renewed entitlement. */
export async function cleanupWorkoutImportSession(
  input: { userId: string; importId: string },
  db: Database = getDb(),
): Promise<void> {
  await db.transaction(
    async (tx) => {
      await loadWorkoutImportSessionForUpdate(tx, input.userId, input.importId)
      const receipt = await tx.query.workoutImportReceiptsTable.findFirst({
        where: eq(workoutImportReceiptsTable.importId, input.importId),
      })
      // A late cancel must preserve retries after a successful but lost response.
      if (receipt) return
      await tx
        .update(workoutImportSessionsTable)
        .set({ proposal: null, expiresAt: new Date(0) })
        .where(eq(workoutImportSessionsTable.id, input.importId))
    },
    { isolationLevel: "read committed" },
  )
}

export async function loadOwnedWorkoutImportSession(
  input: { userId: string; importId: string },
  db: Database = getDb(),
): Promise<WorkoutImportSession> {
  return db.transaction((tx) =>
    loadWorkoutImportSessionForUpdate(tx, input.userId, input.importId),
  )
}

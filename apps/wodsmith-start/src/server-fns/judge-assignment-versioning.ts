// @lat: [[crew#Judge Assignment Version Publishing]]

import { and, desc, eq, sql } from "drizzle-orm"
import type { getDb } from "@/db"
import {
  judgeAssignmentVersionsTable,
  judgeHeatAssignmentsTable,
} from "@/db/schema"
import {
  createHeatVolunteerId,
  createJudgeAssignmentVersionId,
} from "@/db/schemas/common"
import { getFirstExecuteValue } from "./db-execute"

type DbClient = ReturnType<typeof getDb>
type TransactionCallback = Parameters<DbClient["transaction"]>[0]
type TransactionClient = Parameters<TransactionCallback>[0]
type JudgeAssignmentVersionRow =
  typeof judgeAssignmentVersionsTable.$inferSelect
type JudgeHeatAssignmentRow = typeof judgeHeatAssignmentsTable.$inferSelect
type JudgeHeatAssignmentInsert = typeof judgeHeatAssignmentsTable.$inferInsert

type AdvisoryLockDb = {
  execute(query: unknown): Promise<unknown>
}

export type ClonedJudgeAssignmentForRevision = JudgeHeatAssignmentInsert & {
  id: string
  sourceAssignmentId: string | null
}

export interface PublishedJudgeAssignmentRevision {
  version: JudgeAssignmentVersionRow
  resultAssignmentIds: string[]
}

export type MaterializedJudgeAssignmentForVersion = Pick<
  JudgeHeatAssignmentInsert,
  "heatId" | "membershipId" | "rotationId" | "laneNumber" | "position"
>

export interface PublishMaterializedJudgeAssignmentsVersionParams {
  trackWorkoutId: string
  publishedBy: string
  notes?: string | null
}

export function getNextJudgeAssignmentVersionNumber(
  versions: Pick<JudgeAssignmentVersionRow, "version">[],
) {
  const currentMax = versions.reduce(
    (max, version) => Math.max(max, version.version),
    0,
  )
  return currentMax + 1
}

export function cloneJudgeAssignmentsForRevision(
  activeAssignments: JudgeHeatAssignmentRow[],
  versionId: string,
  createId: () => string = createHeatVolunteerId,
): ClonedJudgeAssignmentForRevision[] {
  return activeAssignments.map((assignment) => ({
    id: createId(),
    sourceAssignmentId: assignment.id,
    heatId: assignment.heatId,
    membershipId: assignment.membershipId,
    rotationId: assignment.rotationId,
    versionId,
    laneNumber: assignment.laneNumber,
    position: assignment.position,
    instructions: assignment.instructions,
    isManualOverride: assignment.isManualOverride,
  }))
}

export function findClonedJudgeAssignmentOrThrow(
  assignments: ClonedJudgeAssignmentForRevision[],
  sourceAssignmentId: string,
) {
  const assignment = assignments.find(
    (candidate) => candidate.sourceAssignmentId === sourceAssignmentId,
  )
  if (!assignment) {
    throw new Error("Judge assignment not found in the active version")
  }
  return assignment
}

export function toJudgeHeatAssignmentInserts(
  assignments: ClonedJudgeAssignmentForRevision[],
): JudgeHeatAssignmentInsert[] {
  return assignments.map(
    ({ sourceAssignmentId: _sourceAssignmentId, ...row }) => row,
  )
}

export async function withJudgeAssignmentVersionLock<T>(
  db: AdvisoryLockDb,
  trackWorkoutId: string,
  callback: () => Promise<T>,
) {
  let acquired = false
  let callbackFailed = false
  const lockName = await createJudgeAssignmentVersionLockName(trackWorkoutId)

  try {
    const result = await db.execute(
      sql`SELECT GET_LOCK(${lockName}, 5) FROM dual`,
    )
    acquired = Number(getFirstExecuteValue(result) ?? 0) === 1
    if (!acquired) {
      throw new Error("Judge assignment version could not be published")
    }

    try {
      return await callback()
    } catch (error) {
      callbackFailed = true
      throw error
    }
  } finally {
    if (acquired) {
      try {
        await db.execute(sql`SELECT RELEASE_LOCK(${lockName}) FROM dual`)
      } catch (releaseError) {
        if (callbackFailed) {
          console.warn(
            "Failed to release judge assignment version lock after callback error",
            releaseError,
          )
        } else {
          console.warn(
            "Failed to release judge assignment version lock",
            releaseError,
          )
        }
      }
    }
  }
}

export async function publishMaterializedJudgeAssignmentsVersion(
  db: DbClient,
  params: PublishMaterializedJudgeAssignmentsVersionParams,
  materializeAssignments: (
    tx: TransactionClient,
  ) => Promise<MaterializedJudgeAssignmentForVersion[]>,
) {
  return withJudgeAssignmentVersionLock(db, params.trackWorkoutId, async () =>
    db.transaction(async (tx) => {
      const versions = await tx.query.judgeAssignmentVersionsTable.findMany({
        where: eq(
          judgeAssignmentVersionsTable.trackWorkoutId,
          params.trackWorkoutId,
        ),
        orderBy: desc(judgeAssignmentVersionsTable.version),
      })
      const nextVersion = getNextJudgeAssignmentVersionNumber(versions)
      const newVersionId = createJudgeAssignmentVersionId()
      const materializedAssignments = await materializeAssignments(tx)

      await tx
        .update(judgeAssignmentVersionsTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          eq(
            judgeAssignmentVersionsTable.trackWorkoutId,
            params.trackWorkoutId,
          ),
        )

      await tx.insert(judgeAssignmentVersionsTable).values({
        id: newVersionId,
        trackWorkoutId: params.trackWorkoutId,
        version: nextVersion,
        publishedBy: params.publishedBy,
        notes: params.notes ?? null,
        isActive: true,
      })

      const version = await tx.query.judgeAssignmentVersionsTable.findFirst({
        where: eq(judgeAssignmentVersionsTable.id, newVersionId),
      })

      if (!version) {
        throw new Error("Failed to create version")
      }

      if (materializedAssignments.length > 0) {
        await tx.insert(judgeHeatAssignmentsTable).values(
          materializedAssignments.map((assignment) => ({
            heatId: assignment.heatId,
            membershipId: assignment.membershipId,
            rotationId: assignment.rotationId,
            laneNumber: assignment.laneNumber,
            position: assignment.position,
            versionId: version.id,
            isManualOverride: false,
          })),
        )
      }

      return version
    }),
  )
}

export async function createPublishedJudgeAssignmentRevision(
  db: DbClient,
  trackWorkoutId: string,
  editClonedAssignments: (
    assignments: ClonedJudgeAssignmentForRevision[],
    versionId: string,
  ) => {
    assignments: ClonedJudgeAssignmentForRevision[]
    resultAssignmentIds?: string[]
  },
): Promise<PublishedJudgeAssignmentRevision | null> {
  return withJudgeAssignmentVersionLock(db, trackWorkoutId, async () =>
    db.transaction(async (tx) => {
      const activeVersion =
        await tx.query.judgeAssignmentVersionsTable.findFirst({
          where: and(
            eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId),
            eq(judgeAssignmentVersionsTable.isActive, true),
          ),
        })

      if (!activeVersion) {
        return null
      }

      const versions = await tx.query.judgeAssignmentVersionsTable.findMany({
        where: eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId),
        orderBy: desc(judgeAssignmentVersionsTable.version),
      })
      const nextVersion = getNextJudgeAssignmentVersionNumber(versions)
      const newVersionId = createJudgeAssignmentVersionId()
      const activeAssignments =
        await tx.query.judgeHeatAssignmentsTable.findMany({
          where: eq(judgeHeatAssignmentsTable.versionId, activeVersion.id),
        })
      const clonedAssignments = cloneJudgeAssignmentsForRevision(
        activeAssignments,
        newVersionId,
      )
      const edited = editClonedAssignments(clonedAssignments, newVersionId)
      const timestamp = new Date()

      await tx
        .update(judgeAssignmentVersionsTable)
        .set({ isActive: false, updatedAt: timestamp })
        .where(eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId))

      await tx.insert(judgeAssignmentVersionsTable).values({
        id: newVersionId,
        trackWorkoutId,
        version: nextVersion,
        publishedBy: null,
        notes: "Manual judge assignment edit",
        isActive: true,
      })

      if (edited.assignments.length > 0) {
        await tx
          .insert(judgeHeatAssignmentsTable)
          .values(toJudgeHeatAssignmentInserts(edited.assignments))
      }

      const version = await tx.query.judgeAssignmentVersionsTable.findFirst({
        where: eq(judgeAssignmentVersionsTable.id, newVersionId),
      })
      if (!version) {
        throw new Error("Failed to create judge assignment version")
      }

      return {
        version,
        resultAssignmentIds: edited.resultAssignmentIds ?? [],
      }
    }),
  )
}

async function createJudgeAssignmentVersionLockName(trackWorkoutId: string) {
  const encoded = new TextEncoder().encode(
    `judge-assignment-version:${trackWorkoutId}`,
  )
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
  return `jav:${hex.slice(0, 60)}`
}

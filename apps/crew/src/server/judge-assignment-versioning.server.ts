// @lat: [[crew#Judge Assignment Version Publishing]]
// @lat: [[crew#Judge Rotations]]
import { and, desc, eq } from "drizzle-orm"
import type { getDb } from "../db"
import {
  judgeAssignmentVersionsTable,
  judgeHeatAssignmentsTable,
  trackWorkoutsTable,
} from "../db/schema"
import {
  createHeatVolunteerId,
  createJudgeAssignmentVersionId,
} from "../db/schemas/common"

type DbClient = ReturnType<typeof getDb>
type TransactionCallback = Parameters<DbClient["transaction"]>[0]
type TransactionClient = Parameters<TransactionCallback>[0]
type JudgeAssignmentVersionRow =
  typeof judgeAssignmentVersionsTable.$inferSelect
type JudgeHeatAssignmentRow = typeof judgeHeatAssignmentsTable.$inferSelect
type JudgeHeatAssignmentInsert = typeof judgeHeatAssignmentsTable.$inferInsert

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
  | "heatId"
  | "membershipId"
  | "invitationId"
  | "rotationId"
  | "laneNumber"
  | "position"
>

export interface PublishMaterializedJudgeAssignmentsVersionParams {
  trackWorkoutId: string
  publishedBy?: string | null
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

export async function publishMaterializedJudgeAssignmentsVersion(
  db: DbClient,
  params: PublishMaterializedJudgeAssignmentsVersionParams,
  materializeAssignments: (
    tx: TransactionClient,
  ) => Promise<MaterializedJudgeAssignmentForVersion[]>,
) {
  return db.transaction(async (tx) => {
    await lockJudgeAssignmentVersionScope(tx, params.trackWorkoutId)

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
    const timestamp = new Date()

    await tx
      .update(judgeAssignmentVersionsTable)
      .set({ isActive: false, updatedAt: timestamp })
      .where(
        eq(judgeAssignmentVersionsTable.trackWorkoutId, params.trackWorkoutId),
      )

    await tx.insert(judgeAssignmentVersionsTable).values({
      id: newVersionId,
      trackWorkoutId: params.trackWorkoutId,
      version: nextVersion,
      publishedBy: params.publishedBy ?? null,
      notes: params.notes ?? null,
      isActive: true,
    })

    const version = await tx.query.judgeAssignmentVersionsTable.findFirst({
      where: eq(judgeAssignmentVersionsTable.id, newVersionId),
    })

    if (!version) {
      throw new Error("Failed to create judge assignment version")
    }

    if (materializedAssignments.length > 0) {
      await tx.insert(judgeHeatAssignmentsTable).values(
        materializedAssignments.map((assignment) => ({
          heatId: assignment.heatId,
          membershipId: assignment.membershipId,
          invitationId: assignment.invitationId,
          rotationId: assignment.rotationId,
          laneNumber: assignment.laneNumber,
          position: assignment.position,
          versionId: version.id,
          isManualOverride: false,
        })),
      )
    }

    return version
  })
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
  return db.transaction(async (tx) => {
    await lockJudgeAssignmentVersionScope(tx, trackWorkoutId)

    const activeVersion = await tx.query.judgeAssignmentVersionsTable.findFirst(
      {
        where: and(
          eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId),
          eq(judgeAssignmentVersionsTable.isActive, true),
        ),
      },
    )

    if (!activeVersion) {
      return null
    }

    const versions = await tx.query.judgeAssignmentVersionsTable.findMany({
      where: eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId),
      orderBy: desc(judgeAssignmentVersionsTable.version),
    })
    const nextVersion = getNextJudgeAssignmentVersionNumber(versions)
    const newVersionId = createJudgeAssignmentVersionId()
    const activeAssignments = await tx.query.judgeHeatAssignmentsTable.findMany(
      {
        where: eq(judgeHeatAssignmentsTable.versionId, activeVersion.id),
      },
    )
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
  })
}

async function lockJudgeAssignmentVersionScope(
  tx: TransactionClient,
  trackWorkoutId: string,
) {
  const [workout] = await tx
    .select({ id: trackWorkoutsTable.id })
    .from(trackWorkoutsTable)
    .where(eq(trackWorkoutsTable.id, trackWorkoutId))
    .for("update")
    .limit(1)

  if (!workout) {
    throw new Error("Judge assignment version workout not found")
  }
}

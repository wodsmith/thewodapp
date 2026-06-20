// @lat: [[crew#Judge Rotations]]
// @lat: [[crew#Judge Assignment Version Publishing]]
import { FakeDrizzleDb } from "@repo/test-utils"
import { describe, expect, it } from "vitest"
import {
  cloneJudgeAssignmentsForRevision,
  findClonedJudgeAssignmentOrThrow,
  getNextJudgeAssignmentVersionNumber,
  publishMaterializedJudgeAssignmentsVersion,
  toJudgeHeatAssignmentInserts,
} from "./judge-assignment-versioning.server"

describe("Crew judge assignment versioning", () => {
  it("allocates the next version from the maximum existing version", () => {
    expect(
      getNextJudgeAssignmentVersionNumber([
        { version: 1 },
        { version: 4 },
        { version: 2 },
      ]),
    ).toBe(5)
  })

  it("tracks source assignment ids when cloning an active version", () => {
    const cloned = cloneJudgeAssignmentsForRevision(
      [
        {
          id: "hvol_source",
          heatId: "cheat_1",
          membershipId: "tmem_judge",
          rotationId: "jrot_1",
          versionId: "jver_old",
          laneNumber: 2,
          position: "judge",
          instructions: "Stay right",
          isManualOverride: false,
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
          updatedAt: new Date("2026-06-20T00:00:00.000Z"),
          updateCounter: null,
        },
      ],
      "jver_new",
      () => "hvol_clone",
    )

    expect(cloned).toEqual([
      expect.objectContaining({
        id: "hvol_clone",
        sourceAssignmentId: "hvol_source",
        versionId: "jver_new",
        heatId: "cheat_1",
        membershipId: "tmem_judge",
      }),
    ])
    expect(toJudgeHeatAssignmentInserts(cloned)).toEqual([
      expect.not.objectContaining({ sourceAssignmentId: "hvol_source" }),
    ])
  })

  it("fails loudly when an edit references a stale assignment id", () => {
    expect(() =>
      findClonedJudgeAssignmentOrThrow(
        [
          {
            id: "hvol_clone",
            sourceAssignmentId: "hvol_active",
            heatId: "cheat_1",
            membershipId: "tmem_judge",
            rotationId: "jrot_1",
            versionId: "jver_new",
            laneNumber: 1,
            position: "judge",
            instructions: null,
            isManualOverride: false,
          },
        ],
        "hvol_stale",
      ),
    ).toThrow("Judge assignment not found in the active version")
  })

  it("uses a transaction-scoped row lock when publishing a new version", async () => {
    const db = new FakeDrizzleDb()
    const timestamp = new Date("2026-06-20T00:00:00.000Z")
    db.registerTable("judgeAssignmentVersionsTable")
    db.setMockReturnValue([{ id: "tw_event1", version: 0 }])
    db.setMockSingleValue({
      id: "jver_new",
      trackWorkoutId: "tw_event1",
      version: 1,
      publishedAt: timestamp,
      publishedBy: null,
      notes: null,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      updateCounter: null,
    })

    await publishMaterializedJudgeAssignmentsVersion(
      db as Parameters<typeof publishMaterializedJudgeAssignmentsVersion>[0],
      { trackWorkoutId: "tw_event1" },
      async () => [],
    )

    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.getChainMock().for).toHaveBeenCalledWith("update")
  })
})

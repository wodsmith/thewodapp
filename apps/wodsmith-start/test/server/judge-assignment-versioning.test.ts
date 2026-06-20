import { describe, expect, it, vi } from "vitest"
import {
  cloneJudgeAssignmentsForRevision,
  findClonedJudgeAssignmentOrThrow,
  getNextJudgeAssignmentVersionNumber,
  toJudgeHeatAssignmentInserts,
  withJudgeAssignmentVersionLock,
} from "@/server-fns/judge-assignment-versioning"

// @lat: [[crew#Judge Assignment Version Publishing]]
describe("judge assignment version publishing helpers", () => {
  it("allocates the next version from the current max version defensively", () => {
    expect(getNextJudgeAssignmentVersionNumber([])).toBe(1)
    expect(
      getNextJudgeAssignmentVersionNumber([
        { version: 4 },
        { version: 9 },
        { version: 5 },
      ]),
    ).toBe(10)
    expect(
      getNextJudgeAssignmentVersionNumber([{ version: 5 }, { version: 4 }]),
    ).toBe(6)
  })

  it("clones active assignments into a new version without reusing row ids", () => {
    const ids = ["hvol_clone1", "hvol_clone2"]
    const assignments = cloneJudgeAssignmentsForRevision(
      [
        {
          id: "hvol_original1",
          heatId: "cheat_1",
          membershipId: "tmem_1",
          rotationId: "jrot_1",
          versionId: "jver_old",
          laneNumber: 1,
          position: "judge",
          instructions: "Lane 1",
          isManualOverride: false,
          updateCounter: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "hvol_original2",
          heatId: "cheat_2",
          membershipId: "tmem_2",
          rotationId: null,
          versionId: "jver_old",
          laneNumber: 2,
          position: "head_judge",
          instructions: null,
          isManualOverride: true,
          updateCounter: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      "jver_new",
      () => ids.shift() ?? "hvol_extra",
    )

    expect(assignments).toMatchObject([
      {
        id: "hvol_clone1",
        sourceAssignmentId: "hvol_original1",
        versionId: "jver_new",
        heatId: "cheat_1",
        membershipId: "tmem_1",
      },
      {
        id: "hvol_clone2",
        sourceAssignmentId: "hvol_original2",
        versionId: "jver_new",
        heatId: "cheat_2",
        membershipId: "tmem_2",
      },
    ])
    expect(toJudgeHeatAssignmentInserts(assignments)[0]).not.toHaveProperty(
      "sourceAssignmentId",
    )
  })

  it("fails loudly when an edit references an assignment outside the active version", () => {
    const assignments = cloneJudgeAssignmentsForRevision(
      [
        {
          id: "hvol_active",
          heatId: "cheat_1",
          membershipId: "tmem_1",
          rotationId: null,
          versionId: "jver_old",
          laneNumber: 1,
          position: "judge",
          instructions: null,
          isManualOverride: false,
          updateCounter: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      "jver_new",
      () => "hvol_clone",
    )

    expect(() =>
      findClonedJudgeAssignmentOrThrow(assignments, "hvol_stale"),
    ).toThrow("Judge assignment not found in the active version")
  })

  it("serializes version publication with a per-event advisory lock", async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([[{ lockAcquired: 1 }]])
        .mockResolvedValueOnce([[{ released: 1 }]]),
    }

    await expect(
      withJudgeAssignmentVersionLock(db, "tw_event1", async () => "published"),
    ).resolves.toBe("published")

    expect(db.execute).toHaveBeenCalledTimes(2)
  })

  it("does not mask a successful publish when lock release fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([[{ lockAcquired: 1 }]])
        .mockRejectedValueOnce(new Error("release failed")),
    }

    await expect(
      withJudgeAssignmentVersionLock(db, "tw_event1", async () => "published"),
    ).resolves.toBe("published")

    expect(warn).toHaveBeenCalledWith(
      "Failed to release judge assignment version lock",
      expect.any(Error),
    )
    warn.mockRestore()
  })

  it("preserves callback errors when lock release also fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([[{ lockAcquired: 1 }]])
        .mockRejectedValueOnce(new Error("release failed")),
    }

    await expect(
      withJudgeAssignmentVersionLock(db, "tw_event1", async () => {
        throw new Error("publish failed")
      }),
    ).rejects.toThrow("publish failed")

    expect(warn).toHaveBeenCalledWith(
      "Failed to release judge assignment version lock after callback error",
      expect.any(Error),
    )
    warn.mockRestore()
  })

  it("does not run the callback when the advisory lock cannot be acquired", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([[{ lockAcquired: 0 }]]),
    }
    const callback = vi.fn()

    await expect(
      withJudgeAssignmentVersionLock(db, "tw_event1", callback),
    ).rejects.toThrow("Judge assignment version could not be published")

    expect(callback).not.toHaveBeenCalled()
    expect(db.execute).toHaveBeenCalledTimes(1)
  })
})

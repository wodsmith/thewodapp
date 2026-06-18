import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDb = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }))

import { findPriorAppliedImport } from "@/server/organizer-file-import/context"

beforeEach(() => {
  mockDb.reset()
})

describe("findPriorAppliedImport", () => {
  it("returns the prior applied import when the checksum matches", async () => {
    const appliedAt = new Date("2026-06-01T00:00:00Z")
    mockDb.setMockReturnValue([{ appliedAt, originalFilename: "roster.csv" }])

    const prior = await findPriorAppliedImport("comp_1", "abc123", "aimp_current")

    expect(prior).toEqual({ appliedAt, originalFilename: "roster.csv" })
  })

  it("returns null when nothing matches", async () => {
    mockDb.setMockReturnValue([])

    expect(
      await findPriorAppliedImport("comp_1", "abc123", "aimp_current"),
    ).toBeNull()
  })

  it("maps missing fields to null", async () => {
    mockDb.setMockReturnValue([{ appliedAt: null, originalFilename: null }])

    expect(
      await findPriorAppliedImport("comp_1", "abc123", "aimp_current"),
    ).toEqual({ appliedAt: null, originalFilename: null })
  })
})

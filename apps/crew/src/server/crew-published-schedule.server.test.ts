// @lat: [[crew#Published Volunteer Schedule]]
import { getTableName } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CrewEventSettings } from "../db/schemas/crew-event-settings"
import type { CrewPublishedSchedule } from "../lib/crew/published-schedule"

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  requireEvent: vi.fn(),
  requireAccess: vi.fn(),
  loadInput: vi.fn(),
}))
vi.mock("../db", () => ({ getDb: mocks.getDb }))
vi.mock("./crew-department-lead.server", () => ({
  requireCrewDepartmentLeadFullAccess: mocks.requireAccess,
}))
vi.mock("../server-fns/crew-staffing-fns.server", () => ({
  requireCrewStaffingEvent: mocks.requireEvent,
  loadCrewStaffingMatrixInput: mocks.loadInput,
}))

import {
  getCrewPublicSchedule,
  getCrewPublishedScheduleManager,
  publishCrewSchedule,
  unpublishCrewSchedule,
} from "./crew-published-schedule.server"

const event = {
  id: "event1",
  name: "Test Event",
  slug: "test-event",
  organizingTeamId: "organizer1",
  competitionTeamId: "crew1",
  timezone: "America/Denver",
  startDate: "2026-10-10",
  endDate: "2026-10-10",
}
let settings: Pick<
  CrewEventSettings,
  "crewOnly" | "lifecycle" | "crewBillingState" | "crewBillingPlanId"
>
let snapshot: CrewPublishedSchedule | null
let draftTitle: string
let calls: string[]
let identityInvitations: {
  id: string
  email: string
  acceptedBy: string | null
  status: string
}[]
let identityMemberships: {
  id: string
  userId: string
  user: { email: string }
}[]

function database() {
  const db = {
    query: {
      teamInvitationTable: { findMany: async () => identityInvitations },
      teamMembershipTable: { findMany: async () => identityMemberships },
    },
    select() {
      let tableName = ""
      const query = {
        from(table: Parameters<typeof getTableName>[0]) {
          tableName = getTableName(table)
          return query
        },
        innerJoin() {
          return query
        },
        where() {
          return query
        },
        for() {
          calls.push("lock")
          return query
        },
        async limit() {
          if (tableName === "crew_event_settings")
            return [{ ...settings, settings: '{"other":"preserved"}' }]
          if (tableName === "crew_published_schedules")
            return snapshot ? [{ snapshot }] : []
          if (tableName === "competitions")
            return snapshot ? [{ settings, snapshot }] : []
          throw new Error(`Unexpected table ${tableName}`)
        },
      }
      return query
    },
    insert() {
      calls.push("insert")
      return {
        values(data: { snapshot: CrewPublishedSchedule }) {
          return {
            async onDuplicateKeyUpdate() {
              snapshot = structuredClone(data.snapshot)
            },
          }
        },
      }
    },
    delete() {
      return {
        async where() {
          calls.push("delete")
          snapshot = null
        },
      }
    },
    async transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
      calls.push("transaction")
      return fn(db)
    },
  }
  return db
}

beforeEach(() => {
  settings = {
    crewOnly: true,
    lifecycle: "ready",
    crewBillingState: "paid",
    crewBillingPlanId: "crew_basic",
  }
  snapshot = null
  draftTitle = "Morning shift"
  calls = []
  identityInvitations = []
  identityMemberships = []
  mocks.getDb.mockReturnValue(database())
  mocks.requireEvent.mockResolvedValue(event)
  mocks.requireAccess.mockResolvedValue(undefined)
  mocks.loadInput.mockImplementation(async () => ({
    input: {
      event,
      roster: [
        {
          membershipId: "tinv_one",
          name: "Test Volunteer",
          email: "private@example.com",
          roleTypes: ["judge"],
        },
      ],
      shifts: [
        {
          id: "shift1",
          name: draftTitle,
          roleType: "judge",
          capacity: 1,
          startTime: "2026-10-10T14:00:00Z",
          endTime: "2026-10-10T15:00:00Z",
          assignments: [{ id: "assignment1", membershipId: "tinv_one" }],
        },
      ],
    },
  }))
})

describe("Crew schedule publication boundary", () => {
  it("publishes invitation duties under the claimed membership without exposing linkage data", async () => {
    const { input } = await mocks.loadInput()
    input.roster[0].membershipId = "membership_claimed"
    input.heats = [
      {
        id: "heat1",
        trackWorkoutId: "workout1",
        heatNumber: 2,
        scheduledTime: "2026-10-10T16:00:00Z",
        durationMinutes: 10,
      },
    ]
    input.judgeAssignments = [
      {
        id: "judge1",
        heatId: "heat1",
        membershipId: "tinv_one",
        laneNumber: 3,
      },
    ]
    mocks.loadInput.mockResolvedValue({ input })
    identityInvitations = [
      {
        id: "tinv_one",
        email: "private@example.com",
        acceptedBy: "claimed_user",
        status: "accepted",
      },
    ]
    identityMemberships = [
      {
        id: "membership_claimed",
        userId: "claimed_user",
        user: { email: "private@example.com" },
      },
    ]
    const manager = await publishCrewSchedule({ eventId: event.id })
    expect(manager.previewError).toBeNull()
    const publicResult = await getCrewPublicSchedule({ slug: event.slug })
    expect(publicResult.schedule?.volunteers).toHaveLength(1)
    expect(
      publicResult.schedule?.volunteers[0].assignments.map((duty) => duty.kind),
    ).toEqual(["shift", "judge"])
    expect(JSON.stringify(publicResult)).not.toMatch(
      /private@example|claimed_user|membership_claimed|tinv_one/,
    )
  })

  it("requires organizer access before reading a draft or publishing", async () => {
    mocks.requireAccess.mockRejectedValue(new Error("FORBIDDEN"))
    await expect(
      getCrewPublishedScheduleManager({ eventId: event.id }),
    ).rejects.toThrow("FORBIDDEN")
    await expect(publishCrewSchedule({ eventId: event.id })).rejects.toThrow(
      "FORBIDDEN",
    )
    expect(mocks.loadInput).not.toHaveBeenCalled()
    expect(calls).not.toContain("insert")
  })

  it("allows free draft preview but rejects unpaid publishing under a settings lock", async () => {
    settings.crewBillingState = "unpaid"
    expect(
      await getCrewPublishedScheduleManager({ eventId: event.id }),
    ).toMatchObject({ hasAccess: false, published: null })
    await expect(publishCrewSchedule({ eventId: event.id })).rejects.toThrow(
      "Purchase event access",
    )
    expect(calls).toEqual(["transaction", "lock"])
    expect(snapshot).toBeNull()
  })

  it("serves only the saved release until an explicit republish, then removes it on unpublish", async () => {
    await publishCrewSchedule({ eventId: event.id })
    expect(calls.slice(0, 3)).toEqual(["transaction", "lock", "insert"])
    const initialId = snapshot?.volunteers[0].id
    expect(initialId).toMatch(/^[a-f0-9]{32}$/)
    draftTitle = "Changed draft"
    mocks.loadInput.mockClear()
    const current = await getCrewPublicSchedule({ slug: event.slug })
    expect(current.schedule?.volunteers[0].assignments[0].title).toBe(
      "Morning shift",
    )
    expect(mocks.loadInput).not.toHaveBeenCalled()
    expect(
      await getCrewPublishedScheduleManager({ eventId: event.id }),
    ).toMatchObject({ draftChanged: true })
    await publishCrewSchedule({ eventId: event.id })
    expect(snapshot?.volunteers[0].id).toBe(initialId)
    expect(snapshot?.volunteers[0].assignments[0].title).toBe("Changed draft")
    await unpublishCrewSchedule({ eventId: event.id })
    expect(await getCrewPublicSchedule({ slug: event.slug })).toEqual({
      schedule: null,
    })
    expect(calls.slice(-3)).toEqual(["transaction", "lock", "delete"])
  })

  it.each(["unpaid", "pending", "refunded"] as const)(
    "hides an existing public release when billing becomes %s",
    async (billingState) => {
      await publishCrewSchedule({ eventId: event.id })
      settings.crewBillingState = billingState
      expect(await getCrewPublicSchedule({ slug: event.slug })).toEqual({
        schedule: null,
      })
      // Unpublishing is still available after a refund or lost entitlement.
      await expect(
        unpublishCrewSchedule({ eventId: event.id }),
      ).resolves.toMatchObject({ published: null })
    },
  )

  it("allows comped events and hides archived, converted and mismatched-slug releases", async () => {
    settings.crewBillingState = "comped"
    await publishCrewSchedule({ eventId: event.id })
    expect(
      (await getCrewPublicSchedule({ slug: event.slug })).schedule,
    ).not.toBeNull()
    expect(await getCrewPublicSchedule({ slug: "another-event" })).toEqual({
      schedule: null,
    })
    settings.lifecycle = "archived"
    expect(await getCrewPublicSchedule({ slug: event.slug })).toEqual({
      schedule: null,
    })
    settings.lifecycle = "ready"
    settings.crewOnly = false
    expect(await getCrewPublicSchedule({ slug: event.slug })).toEqual({
      schedule: null,
    })
  })

  it("rejects an oversized replacement without losing the existing public release", async () => {
    await publishCrewSchedule({ eventId: event.id })
    const saved = JSON.stringify(snapshot)
    mocks.loadInput.mockResolvedValue({
      input: {
        event,
        roster: Array.from({ length: 5000 }, (_, index) => ({
          membershipId: `tinv_${index}`,
          name: "A".repeat(500),
          roleTypes: ["judge"],
        })),
      },
    })
    await expect(publishCrewSchedule({ eventId: event.id })).rejects.toThrow(
      "too large to publish",
    )
    expect(JSON.stringify(snapshot)).toBe(saved)
  })

  it("serves no schedule when a saved release fails the public schema", async () => {
    await publishCrewSchedule({ eventId: event.id })
    snapshot = { ...snapshot, version: 999 } as unknown as CrewPublishedSchedule
    expect(await getCrewPublicSchedule({ slug: event.slug })).toEqual({
      schedule: null,
    })
  })

  it("keeps publication status available when draft preparation fails without exposing error details", async () => {
    await publishCrewSchedule({ eventId: event.id })
    const saved = structuredClone(snapshot)
    mocks.loadInput.mockRejectedValue(
      new Error("Database failure with private@example.com"),
    )

    const manager = await getCrewPublishedScheduleManager({ eventId: event.id })
    expect(manager).toMatchObject({
      hasAccess: true,
      sharePath: "/e/test-event/schedule",
      published: saved,
      preview: null,
      previewError: expect.stringContaining("Review the volunteer roster"),
      draftChanged: false,
    })
    expect(JSON.stringify(manager)).not.toContain("private@example.com")
    expect(JSON.stringify(manager)).not.toContain("Database failure")
    expect(
      (await getCrewPublicSchedule({ slug: event.slug })).schedule,
    ).toEqual(saved)
  })

  it("unpublishes successfully despite an invalid draft and recovers its preview after repair", async () => {
    await publishCrewSchedule({ eventId: event.id })
    const saved = JSON.stringify(snapshot)
    draftTitle = "Invalid title ".repeat(100)
    expect(
      await getCrewPublishedScheduleManager({ eventId: event.id }),
    ).toMatchObject({
      preview: null,
      previewError: expect.any(String),
    })
    await expect(publishCrewSchedule({ eventId: event.id })).rejects.toThrow()
    expect(JSON.stringify(snapshot)).toBe(saved)

    expect(await unpublishCrewSchedule({ eventId: event.id })).toMatchObject({
      published: null,
      preview: null,
      previewError: expect.any(String),
    })
    expect(await getCrewPublicSchedule({ slug: event.slug })).toEqual({
      schedule: null,
    })

    draftTitle = "Repaired morning shift"
    expect(
      await getCrewPublishedScheduleManager({ eventId: event.id }),
    ).toMatchObject({
      published: null,
      preview: {
        volunteers: [{ assignments: [{ title: "Repaired morning shift" }] }],
      },
      previewError: null,
      draftChanged: true,
    })
  })
})

import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, expect, it, vi } from "vitest"
const db = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
  }),
}))
import { getVolunteerScheduleDataFn } from "@/server-fns/volunteer-schedule-fns"
import {
  competitionDivisionsTable,
  competitionJudgeRotationsTable,
  volunteerShiftAssignmentsTable,
  trackWorkoutsTable,
  workouts,
  competitionHeatsTable,
  competitionHeatAssignmentsTable,
} from "@/db/schema"
import { eventJudgingSheetsTable } from "@/db/schemas/judging-sheets"

const nativeDateTimeFormat = Intl.DateTimeFormat
beforeEach(() => {
  db.reset()
  db.registerTable("competitionsTable")
  db.query.competitionsTable.findFirst.mockResolvedValue({
    timezone: "America/Los_Angeles",
  })
  // Force the server's default zone to differ from the event's zone.
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    (locale, options) =>
      new nativeDateTimeFormat(locale, { timeZone: "Asia/Tokyo", ...options }),
  )
})

// @lat: [[organizer-dashboard#Volunteers#Volunteer schedule server timezone]]
it("formats rotation windows in the competition timezone across midnight", async () => {
  const dataByTable = new Map<unknown, unknown[]>([
    [competitionDivisionsTable, []],
    [
      competitionJudgeRotationsTable,
      [
        {
          id: "rotation",
          trackWorkoutId: "event",
          startingHeat: 1,
          heatsCount: 2,
          startingLane: 1,
        },
      ],
    ],
    [volunteerShiftAssignmentsTable, []],
    [trackWorkoutsTable, [{ id: "event", workoutId: "workout" }]],
    [workouts, [{ id: "workout", name: "Event", scheme: "time" }]],
    [eventJudgingSheetsTable, []],
    [
      competitionHeatsTable,
      [
        {
          id: "h1",
          trackWorkoutId: "event",
          heatNumber: 1,
          scheduledTime: new Date("2026-09-06T06:30:00Z"),
          durationMinutes: 10,
          divisionId: null,
        },
        {
          id: "h2",
          trackWorkoutId: "event",
          heatNumber: 2,
          scheduledTime: new Date("2026-09-06T07:30:00Z"),
          durationMinutes: 10,
          divisionId: null,
        },
      ],
    ],
    [competitionHeatAssignmentsTable, []],
  ])
  db.getChainMock().from.mockImplementation((table) => {
    db.setMockReturnValue(dataByTable.get(table) ?? [])
    return db.getChainMock()
  })
  const result = await getVolunteerScheduleDataFn({
    data: { competitionId: "competition", membershipId: "membership" },
  })
  expect(result.events[0]?.rotations[0]?.timeWindow).toBe(
    "Sat, Sep 5 11:30 PM - Sun, Sep 6 12:40 AM",
  )
  expect(result.events[0]?.rotations[0]?.estimatedDuration).toBe(70)
})

import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const db = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => ({
    userId: "volunteer",
    user: { role: "admin" },
  }),
}))
vi.mock("@/utils/team-auth", () => ({ hasTeamPermission: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
  }),
}))

import { searchCompetitionRegistrationsFn } from "@/server-fns/check-in-fns"

beforeEach(() => {
  db.reset()
  for (const table of [
    "competitionsTable",
    "competitionRegistrationsTable",
    "waiversTable",
  ])
    db.registerTable(table)
  db.query.competitionsTable.findFirst.mockResolvedValue({
    id: "competition",
    competitionType: "in-person",
  })
  db.query.waiversTable.findMany.mockResolvedValue([
    { id: "required", required: true },
    { id: "optional", required: false },
  ])
})

function registrations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `registration-${i}`,
    userId: `user-${i}`,
    captainUserId: `user-${i}`,
    teamName: null,
    teamMemberId: `membership-${i}`,
    divisionId: "division",
    division: { label: "RX" },
    status: "active",
    checkedInAt: i < 60 ? null : new Date("2026-09-05T12:00:00Z"),
    checkedInBy: null,
    registeredAt: new Date("2026-09-01T12:00:00Z"),
    athleteTeam: null,
    user: {
      id: `user-${i}`,
      firstName: i % 2 === 0 ? "Alex" : "Sam",
      lastName: String(i).padStart(3, "0"),
      email: `user-${i}@example.com`,
      avatar: null,
    },
  }))
}

function seed(count = 120) {
  db.query.competitionRegistrationsTable.findMany.mockResolvedValue(
    registrations(count),
  )
  db.setMockReturnValue(
    Array.from({ length: Math.min(100, count) }, (_, i) => ({
      userId: `user-${i}`,
      waiverId: "required",
      signedAt: new Date("2026-09-01T12:00:00Z"),
    })),
  )
}

describe("check-in search summaries", () => {
  // @lat: [[registration#Day-of Check-In#Complete check-in summary]]
  it("counts checked-in registrations and missing waivers beyond the 50-row cap", async () => {
    seed()
    const result = await searchCompetitionRegistrationsFn({
      data: { competitionId: "competition" },
    })
    expect(result.registrations).toHaveLength(50)
    expect(result.registrations.every((reg) => reg.checkedInAt === null)).toBe(
      true,
    )
    expect(result.summary).toEqual({
      total: 120,
      checkedIn: 60,
      pending: 60,
      waiversMissing: 20,
      percent: 50,
    })
  })

  // @lat: [[registration#Day-of Check-In#Filtered check-in summary]]
  it("counts all query matches before truncation and ignores optional waivers", async () => {
    seed()
    const result = await searchCompetitionRegistrationsFn({
      data: { competitionId: "competition", query: "  ALEX " },
    })
    expect(result.registrations).toHaveLength(50)
    expect(result.summary).toEqual({
      total: 60,
      checkedIn: 30,
      pending: 30,
      waiversMissing: 10,
      percent: 50,
    })
    expect(
      result.registrations.every((reg) => reg.members[0]?.firstName === "Alex"),
    ).toBe(true)
  })

  // @lat: [[registration#Day-of Check-In#Empty check-in summary]]
  it.each([0, 120])(
    "returns zero counts for no matches (registrations=%s)",
    async (count) => {
      seed(count)
      const result = await searchCompetitionRegistrationsFn({
        data: { competitionId: "competition", query: "no such athlete" },
      })
      expect(result.registrations).toEqual([])
      expect(result.summary).toEqual({
        total: 0,
        checkedIn: 0,
        pending: 0,
        waiversMissing: 0,
        percent: 0,
      })
    },
  )

  // @lat: [[registration#Day-of Check-In#Team check-in waiver summary]]
  it("counts a team once when multiple teammates lack required waivers", async () => {
    const [reg] = registrations(1)
    db.query.competitionRegistrationsTable.findMany.mockResolvedValue([
      {
        ...reg,
        athleteTeam: {
          memberships: [0, 1].map((i) => ({
            id: `m-${i}`,
            userId: `u-${i}`,
            user: {
              id: `u-${i}`,
              firstName: "Partner",
              lastName: String(i),
              email: null,
              avatar: null,
            },
          })),
        },
      },
    ])
    db.setMockReturnValue([])
    const result = await searchCompetitionRegistrationsFn({
      data: { competitionId: "competition" },
    })
    expect(result.summary.waiversMissing).toBe(1)
  })
})

// @lat: [[crew#Published Volunteer Schedule]]
import { describe, expect, it } from "vitest"
import {
  buildCrewPublishedSchedule,
  crewPublishedScheduleContent,
  crewPublishedScheduleSchema,
  resolveCrewPublishedScheduleIdentities,
} from "./published-schedule"
import type { CrewStaffingMatrixInput } from "./staffing"

const event = {
  name: "Fall Throwdown",
  slug: "fall-throwdown",
  timezone: "America/Denver",
  startDate: "2026-10-10",
  endDate: "2026-10-11",
}
const publishedAt = new Date("2026-10-01T12:00:00.000Z")

function fixture(): CrewStaffingMatrixInput {
  return {
    event: { id: "event1" },
    roster: [
      {
        membershipId: "tinv_imported",
        name: "Alex Smith",
        email: "alex@example.com",
        roleTypes: ["judge"],
        isAccountless: true,
      },
      {
        membershipId: "tmem_existing",
        name: "Alex Smith",
        email: "other@example.com",
        roleTypes: ["equipment"],
      },
    ],
    shifts: [
      {
        id: "shift1",
        name: "Morning check-in",
        roleType: "check_in",
        capacity: 2,
        startTime: "2026-10-10T13:00:00Z",
        endTime: "2026-10-10T14:00:00Z",
        location: "Lobby",
        assignments: [
          {
            id: "assignment1",
            membershipId: "tinv_imported",
            confirmation: {
              type: "volunteer_shift",
              status: "pending",
              responseNote: "Private medical note",
            },
          },
        ],
      },
    ],
    venues: [{ id: "floor1", name: "Main floor", laneCount: 8 }],
    workouts: [{ id: "workout1", name: "Final event" }],
    heats: [
      {
        id: "heat1",
        trackWorkoutId: "workout1",
        heatNumber: 4,
        venueId: "floor1",
        scheduledTime: "2026-10-11T16:00:00Z",
        durationMinutes: 15,
      },
    ],
    judgeAssignments: [
      {
        id: "judge1",
        heatId: "heat1",
        membershipId: "tinv_imported",
        laneNumber: 3,
        position: "judge",
      },
    ],
  }
}

function build(input = fixture(), time = publishedAt) {
  return buildCrewPublishedSchedule({
    event,
    input,
    publishedAt: time,
    publicId: (source) =>
      `opaque${source.length}${[...source].reduce((sum, c) => sum + c.charCodeAt(0), 0)}`,
  })
}

describe("published volunteer schedule", () => {
  it("retains both invitation shifts and judge duties after a volunteer claims an account", () => {
    const input = fixture()
    input.roster![0].membershipId = "tmem_claimed"
    input.roster![0].isAccountless = false
    const before = JSON.stringify(input)
    const resolved = resolveCrewPublishedScheduleIdentities({
      input,
      invitations: [
        {
          id: "tinv_imported",
          email: "alex@example.com",
          acceptedBy: "user_claimed",
          status: "accepted",
        },
      ],
      memberships: [
        {
          id: "tmem_claimed",
          userId: "user_claimed",
          email: "alex@example.com",
        },
      ],
    })
    const { volunteers } = build(resolved)
    expect(volunteers).toHaveLength(2)
    expect(
      volunteers
        .find((person) => person.assignments.length)
        ?.assignments.map((duty) => duty.kind),
    ).toEqual(["shift", "judge"])
    expect(
      volunteers.filter((person) => person.assignments.length === 0),
    ).toHaveLength(1)
    expect(JSON.stringify(input)).toBe(before)
    expect(JSON.stringify(volunteers)).not.toContain("user_claimed")
  })

  it("uses acceptedBy over email and consolidates the retained invitation after an email change", () => {
    const input = fixture()
    input.roster!.push({
      ...input.roster![0],
      membershipId: "tmem_claimed",
      email: "changed@example.com",
      isAccountless: false,
    })
    const resolved = resolveCrewPublishedScheduleIdentities({
      input,
      invitations: [
        {
          id: "tinv_imported",
          email: "alex@example.com",
          acceptedBy: "user_claimed",
          status: "accepted",
        },
      ],
      memberships: [
        {
          id: "tmem_claimed",
          userId: "user_claimed",
          email: "changed@example.com",
        },
        {
          id: "tmem_existing",
          userId: "another_user",
          email: "alex@example.com",
        },
      ],
    })
    expect(resolved.roster).toHaveLength(2)
    expect(resolved.shifts![0].assignments[0].membershipId).toBe("tmem_claimed")
    expect(resolved.judgeAssignments![0].membershipId).toBe("tmem_claimed")
    expect(
      build(resolved).volunteers.filter((person) => person.assignments.length),
    ).toHaveLength(1)
  })

  it("bridges an unambiguous legacy email match without matching duplicate names", () => {
    const input = fixture()
    input.roster![0].membershipId = "tmem_claimed"
    const resolved = resolveCrewPublishedScheduleIdentities({
      input,
      invitations: [
        {
          id: "tinv_imported",
          email: " ALEX@EXAMPLE.COM ",
          acceptedBy: null,
          status: "accepted",
        },
      ],
      memberships: [
        {
          id: "tmem_claimed",
          userId: "user_claimed",
          email: "alex@example.com",
        },
        {
          id: "tmem_existing",
          userId: "another_user",
          email: "other@example.com",
        },
      ],
    })
    expect(build(resolved).volunteers).toHaveLength(2)
    expect(resolved.shifts![0].assignments[0].membershipId).toBe("tmem_claimed")
  })

  it.each(["invitations", "memberships"] as const)(
    "does not merge ambiguous shared-email %s",
    (duplicateKind) => {
      const input = fixture()
      const invitation = {
        id: "tinv_imported",
        email: "alex@example.com",
        acceptedBy: null,
        status: "accepted",
      }
      const member = {
        id: "tmem_existing",
        userId: "user_existing",
        email: "alex@example.com",
      }
      const resolved = resolveCrewPublishedScheduleIdentities({
        input,
        invitations:
          duplicateKind === "invitations"
            ? [invitation, { ...invitation, id: "tinv_other" }]
            : [invitation],
        memberships:
          duplicateKind === "memberships"
            ? [member, { ...member, id: "tmem_other", userId: "user_other" }]
            : [member],
      })
      expect(resolved.shifts![0].assignments[0].membershipId).toBe(
        "tinv_imported",
      )
      expect(resolved.judgeAssignments![0].membershipId).toBe("tinv_imported")
      expect(build(resolved).volunteers).toHaveLength(2)
    },
  )

  it("does not revive duties of a cancelled invitation hidden by same-email membership", () => {
    const input = fixture()
    input.roster!.shift()
    const resolved = resolveCrewPublishedScheduleIdentities({
      input,
      invitations: [
        {
          id: "tinv_imported",
          email: "other@example.com",
          acceptedBy: "user_existing",
          status: "cancelled",
        },
      ],
      memberships: [
        {
          id: "tmem_existing",
          userId: "user_existing",
          email: "other@example.com",
        },
      ],
    })
    expect(build(resolved).volunteers[0].assignments).toEqual([])
  })

  it("combines imported volunteers' shifts with judge heat and lane duties across days", () => {
    const schedule = build()
    const person = schedule.volunteers.find((row) => row.assignments.length > 0)
    expect(person?.assignments).toEqual([
      expect.objectContaining({
        kind: "shift",
        title: "Morning check-in",
        startTime: "2026-10-10T13:00:00.000Z",
        location: "Lobby",
      }),
      expect.objectContaining({
        kind: "judge",
        title: "Final event",
        heatNumber: 4,
        laneNumber: 3,
        location: "Main floor",
        startTime: "2026-10-11T16:00:00.000Z",
        endTime: "2026-10-11T16:15:00.000Z",
      }),
    ])
  })

  it("keeps duplicate names distinct, including an unscheduled roster member", () => {
    const { volunteers } = build()
    expect(volunteers.map((person) => person.name)).toEqual([
      "Alex Smith",
      "Alex Smith",
    ])
    expect(new Set(volunteers.map((person) => person.id)).size).toBe(2)
    expect(volunteers.some((person) => person.assignments.length === 0)).toBe(
      true,
    )
  })

  it("omits contacts, confirmation notes, source identity and token capabilities", () => {
    const text = JSON.stringify(build())
    for (const secret of [
      "alex@example.com",
      "other@example.com",
      "Private medical note",
      "pending",
      "tinv_imported",
      "tmem_existing",
      "confirmation",
      "token",
      "email",
      "phone",
    ]) {
      expect(text).not.toContain(secret)
    }
  })

  it("does not expose email when legacy roster hydration uses it as the name", () => {
    const input = fixture()
    if (input.roster) input.roster[0].name = "alex@example.com"
    expect(
      build(input).volunteers.some((person) => person.name === "Volunteer"),
    ).toBe(true)
    expect(JSON.stringify(build(input))).not.toContain("alex@example.com")
  })

  it("keeps a release unchanged after draft mutation and detects republished content", () => {
    const input = fixture()
    const released = build(input)
    const original = JSON.stringify(released)
    if (input.shifts) input.shifts[0].name = "Updated check-in"
    expect(JSON.stringify(released)).toBe(original)
    expect(crewPublishedScheduleContent(build(input))).not.toBe(
      crewPublishedScheduleContent(released),
    )
    expect(
      crewPublishedScheduleContent(
        build(fixture(), new Date("2026-10-02T12:00:00Z")),
      ),
    ).toBe(crewPublishedScheduleContent(released))
  })

  it("allows unscheduled heat times without inventing dates", () => {
    const input = fixture()
    if (input.heats) input.heats[0].scheduledTime = null
    const judge = build(input)
      .volunteers.flatMap((person) => person.assignments)
      .find((row) => row.kind === "judge")
    expect(judge).toMatchObject({
      startTime: null,
      endTime: null,
      heatNumber: 4,
      laneNumber: 3,
    })
  })

  it.each(["cancelled", "declined", "no_show"] as const)(
    "omits %s duties from public shifts and judge assignments",
    (status) => {
      const input = fixture()
      if (input.shifts?.[0].assignments[0].confirmation) {
        input.shifts[0].assignments[0].confirmation.status = status
      }
      if (input.judgeAssignments) {
        input.judgeAssignments[0].confirmation = { type: "judge_heat", status }
      }
      expect(
        build(input).volunteers.every(
          (person) => person.assignments.length === 0,
        ),
      ).toBe(true)
    },
  )

  it("omits inactive roster volunteers even when stale assignments remain", () => {
    const input = fixture()
    if (input.roster) input.roster[0].isActive = false
    const schedule = build(input)
    expect(schedule.volunteers).toHaveLength(1)
    expect(schedule.volunteers[0].assignments).toEqual([])
  })

  it("falls back to a valid timezone for legacy invalid event data", () => {
    const schedule = buildCrewPublishedSchedule({
      event: { ...event, timezone: "Broken/Zone" },
      input: fixture(),
      publishedAt,
      publicId: (source) => `id${source.length}`,
    })
    expect(schedule.event.timezone).toBe("America/Denver")
  })

  it("rejects orphan duties instead of silently omitting part of a volunteer's schedule", () => {
    const input = fixture()
    input.roster = []
    expect(() => build(input)).toThrow("missing from the roster")
  })

  it("strips unexpected stored properties before public delivery and rejects invalid versions", () => {
    const schedule = build()
    const parsed = crewPublishedScheduleSchema.parse({
      ...schedule,
      settings: "private",
      volunteers: schedule.volunteers.map((person) => ({
        ...person,
        email: "secret@example.com",
        token: "private-token",
      })),
    })
    expect(JSON.stringify(parsed)).not.toContain("private")
    expect(JSON.stringify(parsed)).not.toContain("secret@example.com")
    expect(
      crewPublishedScheduleSchema.safeParse({ ...schedule, version: 2 })
        .success,
    ).toBe(false)
  })
})

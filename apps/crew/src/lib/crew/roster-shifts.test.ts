import { describe, expect, it } from "vitest"
import {
  buildCrewRoster,
  normalizeCrewShiftTimes,
  summarizeCrewRoster,
  validateShiftAssignment,
} from "./roster-shifts"

describe("Crew roster helpers", () => {
  it("maps volunteer invitations and memberships to roster statuses", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")
    const roster = buildCrewRoster(
      [
        {
          id: "tinv_pending",
          email: "pending@example.com",
          expiresAt: "2026-06-20T12:00:00.000Z",
          status: "pending",
          metadata: JSON.stringify({
            signupName: "Pending Person",
            volunteerRoleTypes: ["judge"],
          }),
        },
        {
          id: "tinv_accepted",
          email: "accepted@example.com",
          status: "accepted",
          metadata: JSON.stringify({
            signupName: "Accepted Person",
            volunteerRoleTypes: ["medical"],
          }),
        },
        {
          id: "tinv_expired",
          email: "expired@example.com",
          expiresAt: "2026-06-18T12:00:00.000Z",
          status: "pending",
          metadata: null,
        },
      ],
      [
        {
          id: "tmem_active",
          isActive: true,
          user: {
            firstName: "Active",
            lastName: "Person",
            email: "active@example.com",
          },
          metadata: JSON.stringify({ volunteerRoleTypes: ["staff"] }),
        },
        {
          id: "tmem_inactive",
          isActive: false,
          user: {
            firstName: "Inactive",
            lastName: "Person",
            email: "inactive@example.com",
          },
          metadata: JSON.stringify({ volunteerRoleTypes: ["check_in"] }),
        },
      ],
      now,
    )

    expect(
      roster.map((volunteer) => [volunteer.email, volunteer.status]),
    ).toEqual([
      ["active@example.com", "active"],
      ["accepted@example.com", "accepted"],
      ["pending@example.com", "pending"],
      ["inactive@example.com", "inactive"],
      ["expired@example.com", "expired"],
    ])
    expect(summarizeCrewRoster(roster)).toMatchObject({
      total: 5,
      active: 1,
      accepted: 1,
      pending: 1,
      inactive: 1,
      expired: 1,
      assignable: 1,
    })
  })

  it("deduplicates invitation rows when an active membership exists for the email", () => {
    const roster = buildCrewRoster(
      [
        {
          id: "tinv_duplicate",
          email: "same@example.com",
          status: "accepted",
          metadata: JSON.stringify({ signupName: "Old Invite" }),
        },
      ],
      [
        {
          id: "tmem_same",
          isActive: true,
          user: {
            firstName: "Roster",
            lastName: "Member",
            email: "same@example.com",
          },
          metadata: JSON.stringify({ volunteerRoleTypes: ["general"] }),
        },
      ],
    )

    expect(roster).toHaveLength(1)
    expect(roster[0]?.source).toBe("team_membership")
    expect(roster[0]?.status).toBe("active")
  })
})

describe("Crew shift helpers", () => {
  it("validates duplicate, capacity, role, and active assignment cases", () => {
    expect(
      validateShiftAssignment({
        shiftRoleType: "medical",
        capacity: 2,
        currentAssignmentMembershipIds: [],
        volunteer: {
          membershipId: "tmem_1",
          roleTypes: ["general"],
          isActive: true,
        },
      }),
    ).toEqual({ ok: true })

    expect(
      validateShiftAssignment({
        shiftRoleType: "medical",
        capacity: 2,
        currentAssignmentMembershipIds: ["tmem_1"],
        volunteer: {
          membershipId: "tmem_1",
          roleTypes: ["medical"],
          isActive: true,
        },
      }),
    ).toMatchObject({ ok: false, reason: "duplicate" })

    expect(
      validateShiftAssignment({
        shiftRoleType: "medical",
        capacity: 1,
        currentAssignmentMembershipIds: ["tmem_other"],
        volunteer: {
          membershipId: "tmem_1",
          roleTypes: ["medical"],
          isActive: true,
        },
      }),
    ).toMatchObject({ ok: false, reason: "capacity" })

    expect(
      validateShiftAssignment({
        shiftRoleType: "medical",
        capacity: 2,
        currentAssignmentMembershipIds: [],
        volunteer: {
          membershipId: "tmem_1",
          roleTypes: ["judge"],
          isActive: true,
        },
      }),
    ).toMatchObject({ ok: false, reason: "role_mismatch" })

    expect(
      validateShiftAssignment({
        shiftRoleType: "medical",
        capacity: 2,
        currentAssignmentMembershipIds: [],
        volunteer: {
          membershipId: "tmem_1",
          roleTypes: ["medical"],
          isActive: false,
        },
      }),
    ).toMatchObject({ ok: false, reason: "inactive_volunteer" })
  })

  it("normalizes shift date and time in the event timezone", () => {
    const normalized = normalizeCrewShiftTimes({
      date: "2026-07-04",
      startTime: "09:00",
      endTime: "11:30",
      timezone: "America/Denver",
    })

    expect(normalized.startTime.toISOString()).toBe("2026-07-04T15:00:00.000Z")
    expect(normalized.endTime.toISOString()).toBe("2026-07-04T17:30:00.000Z")
  })

  it("rejects shifts that end before they start", () => {
    expect(() =>
      normalizeCrewShiftTimes({
        date: "2026-07-04",
        startTime: "12:00",
        endTime: "11:30",
        timezone: "America/Denver",
      }),
    ).toThrow("Shift end time must be after the start time.")
  })
})

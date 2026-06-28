// @lat: [[crew#Manual Volunteer Intake]]
import { describe, expect, it } from "vitest"
import { INVITATION_STATUS } from "../../db/schemas/teams"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_INVITE_SOURCE,
  VOLUNTEER_ROLE_TYPES,
} from "../../db/schemas/volunteers"
import {
  buildManualVolunteerMetadata,
  parseManualVolunteerEmailPaste,
  planManualVolunteerIntake,
} from "./manual-volunteer-intake"

describe("parseManualVolunteerEmailPaste", () => {
  it("normalizes newline and comma separated emails", () => {
    const result = parseManualVolunteerEmailPaste(
      " ADA@example.com\nbob@example.com, Cara@Example.COM ",
    )

    expect(result.valid.map((row) => row.email)).toEqual([
      "ada@example.com",
      "bob@example.com",
      "cara@example.com",
    ])
    expect(result.skipped).toEqual([])
    expect(result.invalid).toEqual([])
  })

  it("skips duplicate emails inside the paste", () => {
    const result = parseManualVolunteerEmailPaste(
      "ada@example.com, ADA@example.com\nbob@example.com",
    )

    expect(result.valid.map((row) => row.email)).toEqual([
      "ada@example.com",
      "bob@example.com",
    ])
    expect(result.skipped).toEqual([
      {
        rowNumber: 2,
        email: "ada@example.com",
        reason: "duplicate_in_paste",
      },
    ])
  })

  it("reports invalid rows and batch limit rows", () => {
    const result = parseManualVolunteerEmailPaste(
      "ada@example.com,not-an-email,bob@example.com,bob@example.com",
      1,
    )

    expect(result.valid.map((row) => row.email)).toEqual(["ada@example.com"])
    expect(result.invalid).toEqual([
      {
        rowNumber: 2,
        value: "not-an-email",
        reason: "invalid_email",
      },
      {
        rowNumber: 3,
        value: "bob@example.com",
        reason: "batch_limit",
      },
      {
        rowNumber: 4,
        value: "bob@example.com",
        reason: "batch_limit",
      },
    ])
    expect(result.skipped).toEqual([])
  })
})

describe("buildManualVolunteerMetadata", () => {
  it("defaults missing volunteer roles through the roster role helper", () => {
    const metadata = buildManualVolunteerMetadata(
      {
        email: " ADA@example.com ",
        name: "Ada Lovelace",
        phone: "555-0100",
        availability: VOLUNTEER_AVAILABILITY.MORNING,
        availabilityNotes: "Before lunch",
        notes: "Can lead check-in",
      },
      new Date("2026-06-19T12:00:00.000Z"),
    )

    expect(metadata).toMatchObject({
      volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.GENERAL],
      availability: VOLUNTEER_AVAILABILITY.MORNING,
      availabilityNotes: "Before lunch",
      internalNotes: "Can lead check-in",
      status: "pending",
      inviteSource: VOLUNTEER_INVITE_SOURCE.DIRECT,
      signupEmail: "ada@example.com",
      signupName: "Ada Lovelace",
      signupPhone: "555-0100",
      crewSignupSource: "manual_operator",
      manualCreatedAt: "2026-06-19T12:00:00.000Z",
    })
  })

  it("omits signupEmail when email is absent but keeps the name", () => {
    const metadata = buildManualVolunteerMetadata({
      name: "Grace Hopper",
    })

    expect(metadata.signupName).toBe("Grace Hopper")
    expect(metadata).not.toHaveProperty("signupEmail")
  })

  it("omits signupEmail when email is only whitespace", () => {
    const metadata = buildManualVolunteerMetadata({
      email: "   ",
      name: "Grace Hopper",
    })

    expect(metadata).not.toHaveProperty("signupEmail")
  })
})

describe("planManualVolunteerIntake", () => {
  it("creates a pending invitation when no roster row exists", () => {
    expect(
      planManualVolunteerIntake("ada@example.com", {
        existingInvitations: [],
        existingMemberships: [],
      }),
    ).toEqual({ action: "create_invitation", targetId: null })
  })

  it("skips existing invitations and memberships by normalized email", () => {
    expect(
      planManualVolunteerIntake("ADA@example.com", {
        existingInvitations: [
          {
            id: "tinv_pending",
            email: "ada@example.com",
            status: INVITATION_STATUS.PENDING,
          },
        ],
        existingMemberships: [],
      }),
    ).toMatchObject({
      action: "skip",
      targetId: "tinv_pending",
      reason: "pending_invitation",
    })

    expect(
      planManualVolunteerIntake("ada@example.com", {
        existingInvitations: [],
        existingMemberships: [
          {
            id: "tmem_active",
            email: "ADA@example.com",
            isActive: true,
          },
        ],
      }),
    ).toMatchObject({
      action: "skip",
      targetId: "tmem_active",
      reason: "active_membership",
    })
  })

  it("uses metadata signup emails for duplicate checks", () => {
    const plan = planManualVolunteerIntake("ada@example.com", {
      existingInvitations: [],
      existingMemberships: [
        {
          id: "tmem_metadata",
          email: "account@example.com",
          isActive: true,
          metadata: JSON.stringify({ signupEmail: "ADA@example.com" }),
        },
      ],
    })

    expect(plan).toMatchObject({
      action: "skip",
      targetId: "tmem_metadata",
      reason: "active_membership",
    })
  })

  it("does not dedup email-less volunteers against each other", () => {
    expect(
      planManualVolunteerIntake("", {
        existingInvitations: [
          {
            id: "tinv_no_email",
            email: "",
            status: INVITATION_STATUS.PENDING,
          },
        ],
        existingMemberships: [
          {
            id: "tmem_no_email",
            email: "",
            isActive: true,
          },
        ],
      }),
    ).toEqual({ action: "create_invitation", targetId: null })
  })
})

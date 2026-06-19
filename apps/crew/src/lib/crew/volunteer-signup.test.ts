import { describe, expect, it } from "vitest"
import { INVITATION_STATUS } from "../../db/schemas/teams"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_INVITE_SOURCE,
  VOLUNTEER_ROLE_TYPES,
} from "../../db/schemas/volunteers"
import {
  buildCrewVolunteerSignupMetadata,
  crewVolunteerSignupInputSchema,
  getCrewVolunteerTokenState,
  planCrewVolunteerSignup,
  validateCrewVolunteerSignupRequirements,
} from "./volunteer-signup"

const baseSignupInput = {
  eventSlug: "spring-throwdown",
  signupName: "Ada Lovelace",
  signupEmail: "ADA@EXAMPLE.COM",
  signupPhone: "555-0100",
  credentials: "L1 judge",
  availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
  availabilityNotes: "Can help wherever needed",
  roleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
  answers: [{ questionId: "q_required", answer: "Medium" }],
  waiverIds: ["waiv_123"],
}

describe("crewVolunteerSignupInputSchema", () => {
  it("normalizes volunteer email addresses", () => {
    const parsed = crewVolunteerSignupInputSchema.parse(baseSignupInput)

    expect(parsed.signupEmail).toBe("ada@example.com")
  })
})

describe("validateCrewVolunteerSignupRequirements", () => {
  it("requires required question answers and volunteer waivers", () => {
    const errors = validateCrewVolunteerSignupRequirements(
      { answers: [], waiverIds: [] },
      {
        questions: [
          { id: "q_required", label: "T-shirt size", required: true },
          { id: "q_optional", label: "Anything else?", required: false },
        ],
        requiredWaiverIds: ["waiv_123"],
      },
    )

    expect(errors).toEqual([
      'Please answer the required question: "T-shirt size"',
      "Please agree to all required waivers before volunteering",
    ])
  })
})

describe("planCrewVolunteerSignup", () => {
  it("updates an existing pending invitation using a normalized email match", () => {
    const plan = planCrewVolunteerSignup(
      { signupEmail: "ADA@example.com" },
      {
        existingInvitations: [
          {
            id: "tinv_1",
            email: "ada@example.com",
            status: INVITATION_STATUS.PENDING,
          },
        ],
        existingMemberships: [],
      },
    )

    expect(plan).toEqual({
      action: "update_invitation",
      targetId: "tinv_1",
    })
  })

  it("rejects accepted invitations and active memberships", () => {
    expect(
      planCrewVolunteerSignup(
        { signupEmail: "ada@example.com" },
        {
          existingInvitations: [
            {
              id: "tinv_1",
              email: "ada@example.com",
              status: INVITATION_STATUS.ACCEPTED,
            },
          ],
          existingMemberships: [],
        },
      ),
    ).toMatchObject({
      action: "reject",
      reason: "accepted_invitation",
    })

    expect(
      planCrewVolunteerSignup(
        { signupEmail: "ada@example.com" },
        {
          existingInvitations: [],
          existingMemberships: [
            {
              id: "tmem_1",
              email: "ADA@example.com",
              isActive: true,
            },
          ],
        },
      ),
    ).toMatchObject({
      action: "reject",
      reason: "active_membership",
    })
  })

  it("prioritizes accepted invitations over earlier pending invitations", () => {
    const plan = planCrewVolunteerSignup(
      { signupEmail: "ada@example.com" },
      {
        existingInvitations: [
          {
            id: "tinv_pending",
            email: "ada@example.com",
            status: INVITATION_STATUS.PENDING,
          },
          {
            id: "tinv_accepted",
            email: "ADA@example.com",
            status: INVITATION_STATUS.ACCEPTED,
          },
        ],
        existingMemberships: [],
      },
    )

    expect(plan).toMatchObject({
      action: "reject",
      targetId: "tinv_accepted",
      reason: "accepted_invitation",
    })
  })
})

describe("buildCrewVolunteerSignupMetadata", () => {
  it("stores pending no-password applications in volunteer metadata shape", () => {
    const metadata = buildCrewVolunteerSignupMetadata(
      crewVolunteerSignupInputSchema.parse(baseSignupInput),
      new Date("2026-06-19T12:00:00.000Z"),
    )

    expect(metadata).toMatchObject({
      volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
      credentials: "L1 judge",
      availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
      status: "pending",
      inviteSource: VOLUNTEER_INVITE_SOURCE.APPLICATION,
      signupEmail: "ada@example.com",
      signupName: "Ada Lovelace",
      signupPhone: "555-0100",
      signupWaiverIds: ["waiv_123"],
      signupWaiverAgreedAt: "2026-06-19T12:00:00.000Z",
      signupSubmittedAt: "2026-06-19T12:00:00.000Z",
      crewSignupSource: "public_no_password",
    })
  })
})

describe("getCrewVolunteerTokenState", () => {
  it("accepts valid tokens and rejects expired or cancelled tokens", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")

    expect(
      getCrewVolunteerTokenState(
        {
          token: "tok_live",
          expiresAt: new Date("2026-06-20T12:00:00.000Z"),
          status: INVITATION_STATUS.PENDING,
        },
        now,
      ),
    ).toBe("valid")

    expect(
      getCrewVolunteerTokenState(
        {
          token: "tok_expired",
          expiresAt: new Date("2026-06-18T12:00:00.000Z"),
          status: INVITATION_STATUS.PENDING,
        },
        now,
      ),
    ).toBe("expired")

    expect(
      getCrewVolunteerTokenState(
        {
          token: "tok_cancelled",
          expiresAt: new Date("2026-06-20T12:00:00.000Z"),
          status: INVITATION_STATUS.CANCELLED,
        },
        now,
      ),
    ).toBe("bad")
  })
})

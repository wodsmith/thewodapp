// @lat: [[crew#Roster Shifts Assignments]]
// @lat: [[crew#Roster Volunteer Editing]]
import { describe, expect, it } from "vitest"
import {
  buildCrewRoster,
  buildCrewRosterVolunteerMetadataUpdate,
  findCrewRosterVolunteerEmailCollision,
  getCrewRosterAssigneeId,
  getCrewRosterRoleTypes,
  isCrewRosterVolunteerStaffable,
  normalizeCrewShiftTimes,
  parseCrewRosterMetadata,
  shouldUpdateCrewRosterInvitationEmail,
  summarizeCrewRoster,
  validateShiftAssignment,
  validateShiftCapacityUpdate,
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
      // Active membership + accepted + pending invitations are all staffable;
      // inactive memberships and expired invitations are not.
      assignable: 3,
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

  it("keeps email-less invitations in the roster without deduping them together", () => {
    const roster = buildCrewRoster(
      [
        {
          id: "tinv_no_email_a",
          email: "",
          status: "pending",
          metadata: JSON.stringify({ signupName: "No Email A" }),
        },
        {
          id: "tinv_no_email_b",
          email: "",
          status: "pending",
          metadata: JSON.stringify({ signupName: "No Email B" }),
        },
      ],
      [
        {
          id: "tmem_no_email",
          isActive: true,
          user: { firstName: "Member", lastName: "NoEmail", email: "" },
          metadata: JSON.stringify({
            signupName: "Member NoEmail",
            volunteerRoleTypes: ["general"],
          }),
        },
      ],
    )

    expect(roster).toHaveLength(3)
    expect(roster.map((volunteer) => volunteer.name).sort()).toEqual([
      "Member NoEmail",
      "No Email A",
      "No Email B",
    ])
    expect(roster.every((volunteer) => volunteer.email === "")).toBe(true)
  })

  it("defaults missing volunteer role metadata to general for roster and assignment paths", () => {
    expect(getCrewRosterRoleTypes(undefined)).toEqual(["general"])
    expect(getCrewRosterRoleTypes([])).toEqual(["general"])

    expect(
      validateShiftAssignment({
        shiftRoleType: "general",
        capacity: 1,
        currentAssignmentMembershipIds: [],
        volunteer: {
          membershipId: "tmem_missing_roles",
          roleTypes: getCrewRosterRoleTypes(undefined),
          isActive: true,
        },
      }),
    ).toEqual({ ok: true })
  })

  it("falls back to invitation email when metadata signup email is blank", () => {
    const roster = buildCrewRoster(
      [
        {
          id: "tinv_blank_email",
          email: "invite@example.com",
          status: "pending",
          metadata: JSON.stringify({
            signupEmail: "   ",
            signupName: "Invite Person",
          }),
        },
      ],
      [],
    )

    expect(roster[0]?.email).toBe("invite@example.com")
  })

  it("falls back to membership user email when metadata signup email is blank", () => {
    const roster = buildCrewRoster(
      [],
      [
        {
          id: "tmem_blank_email",
          isActive: true,
          user: {
            firstName: "Member",
            lastName: "Person",
            email: "member@example.com",
          },
          metadata: JSON.stringify({ signupEmail: " " }),
        },
      ],
    )

    expect(roster[0]?.email).toBe("member@example.com")
  })

  it("merges imported roster metadata without losing import audit details", () => {
    const metadata = buildCrewRosterVolunteerMetadataUpdate(
      JSON.stringify({
        crewImportId: "cimp_1",
        crewSignupSource: "competition_corner",
        inviteSource: "direct",
        status: "approved",
        signupEmail: "old@example.com",
        signupName: "Old Name",
      }),
      {
        email: " ADA@Example.com ",
        name: "Ada Lovelace",
        phone: " 555-0100 ",
        roleTypes: ["judge", "judge", "medical"],
        availability: "morning",
        availabilityNotes: "Before lunch",
        credentials: "L1",
        notes: "Can lead a lane",
      },
    )

    expect(metadata).toMatchObject({
      crewImportId: "cimp_1",
      crewSignupSource: "competition_corner",
      inviteSource: "direct",
      status: "approved",
      signupEmail: "ada@example.com",
      signupName: "Ada Lovelace",
      signupPhone: "555-0100",
      volunteerRoleTypes: ["judge", "medical"],
      availability: "morning",
      availabilityNotes: "Before lunch",
      credentials: "L1",
      internalNotes: "Can lead a lane",
    })
  })

  it("clears editable fields while preserving manual source metadata", () => {
    const metadata = buildCrewRosterVolunteerMetadataUpdate(
      JSON.stringify({
        crewSignupSource: "manual_operator",
        manualCreatedAt: "2026-06-19T12:00:00.000Z",
        signupEmail: "old@example.com",
        signupPhone: "555-0000",
        credentials: "Old credential",
        internalNotes: "Old note",
      }),
      {
        email: "updated@example.com",
        name: "",
        phone: "",
        roleTypes: [],
        availability: "",
        availabilityNotes: "",
        credentials: "",
        notes: "",
      },
    )

    expect(metadata).toMatchObject({
      crewSignupSource: "manual_operator",
      manualCreatedAt: "2026-06-19T12:00:00.000Z",
      signupEmail: "updated@example.com",
      volunteerRoleTypes: ["general"],
    })
    expect(metadata).not.toHaveProperty("signupPhone")
    expect(metadata).not.toHaveProperty("credentials")
    expect(metadata).not.toHaveProperty("internalNotes")
  })

  it("detects duplicate edit emails across memberships and invitations", () => {
    expect(
      findCrewRosterVolunteerEmailCollision({
        source: "team_membership",
        sourceId: "tmem_current",
        email: "ada@example.com",
        invitations: [
          {
            id: "tinv_pending",
            email: "pending@example.com",
            metadata: JSON.stringify({ signupEmail: "Ada@Example.com" }),
          },
        ],
        memberships: [
          {
            id: "tmem_current",
            email: "ada@example.com",
            isActive: true,
            metadata: null,
          },
        ],
      }),
    ).toMatchObject({
      source: "team_invitation",
      sourceId: "tinv_pending",
      email: "ada@example.com",
    })
  })

  it("ignores non-string metadata emails when checking edit collisions", () => {
    const collision = findCrewRosterVolunteerEmailCollision({
      source: "team_membership",
      sourceId: "tmem_current",
      email: "ada@example.com",
      invitations: [
        {
          id: "tinv_corrupt",
          email: "pending@example.com",
          status: "pending",
          metadata: JSON.stringify({ signupEmail: 42 }),
        },
      ],
      memberships: [
        {
          id: "tmem_current",
          email: "ada@example.com",
          isActive: true,
          metadata: JSON.stringify({ signupEmail: { value: "ada" } }),
        },
      ],
    })

    expect(collision).toBeNull()
  })

  it("does not treat accepted invitations hidden by a membership as edit collisions", () => {
    expect(
      findCrewRosterVolunteerEmailCollision({
        source: "team_membership",
        sourceId: "tmem_current",
        email: "ada@example.com",
        invitations: [
          {
            id: "tinv_accepted",
            email: "ada@example.com",
            status: "accepted",
            acceptedAt: "2026-06-19T12:00:00.000Z",
            metadata: null,
          },
        ],
        memberships: [
          {
            id: "tmem_current",
            email: "ada@example.com",
            isActive: true,
            metadata: null,
          },
        ],
      }),
    ).toBeNull()
  })

  it("lets membership edits change roster email metadata without changing account email", () => {
    const metadata = buildCrewRosterVolunteerMetadataUpdate(null, {
      email: "ops@example.com",
      name: "Ops Volunteer",
      roleTypes: ["staff"],
    })
    const roster = buildCrewRoster(
      [],
      [
        {
          id: "tmem_member",
          isActive: true,
          user: {
            firstName: "Account",
            lastName: "Owner",
            email: "account@example.com",
          },
          metadata: JSON.stringify(metadata),
        },
      ],
    )

    expect(roster[0]?.email).toBe("ops@example.com")
    expect(roster[0]?.name).toBe("Ops Volunteer")
  })

  it("only updates the backing invitation email while a roster invitation is pending", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")

    expect(
      shouldUpdateCrewRosterInvitationEmail(
        {
          id: "tinv_pending",
          email: "pending@example.com",
          status: "pending",
          expiresAt: "2026-06-20T12:00:00.000Z",
        },
        now,
      ),
    ).toBe(true)
    expect(
      shouldUpdateCrewRosterInvitationEmail(
        {
          id: "tinv_accepted",
          email: "accepted@example.com",
          status: "accepted",
          acceptedAt: "2026-06-19T12:00:00.000Z",
        },
        now,
      ),
    ).toBe(false)
    expect(
      shouldUpdateCrewRosterInvitationEmail(
        {
          id: "tinv_expired",
          email: "expired@example.com",
          status: "pending",
          expiresAt: "2026-06-18T12:00:00.000Z",
        },
        now,
      ),
    ).toBe(false)
  })

  it("normalizes edited pending invitation metadata for roster display", () => {
    const metadata = buildCrewRosterVolunteerMetadataUpdate(null, {
      email: "pending+new@example.com",
      name: "Pending Volunteer",
      roleTypes: ["check_in"],
    })
    const parsed = parseCrewRosterMetadata(JSON.stringify(metadata))
    const roster = buildCrewRoster(
      [
        {
          id: "tinv_pending",
          email: parsed.signupEmail ?? "",
          status: "pending",
          metadata: JSON.stringify(metadata),
        },
      ],
      [],
    )

    expect(roster[0]).toMatchObject({
      source: "team_invitation",
      email: "pending+new@example.com",
      name: "Pending Volunteer",
      roleTypes: ["check_in"],
    })
  })
})

describe("Crew roster staffability", () => {
  function rosterVolunteer(
    overrides: Partial<
      Pick<
        ReturnType<typeof buildCrewRoster>[number],
        "membershipId" | "invitationId" | "status" | "roleTypes"
      >
    >,
  ) {
    return {
      membershipId: null,
      invitationId: null,
      status: "pending" as const,
      roleTypes: ["general"] as ReturnType<
        typeof buildCrewRoster
      >[number]["roleTypes"],
      ...overrides,
    }
  }

  it("derives the canonical assignee id from membership or invitation", () => {
    expect(
      getCrewRosterAssigneeId({
        membershipId: "tmem_1",
        invitationId: null,
      }),
    ).toBe("tmem_1")
    expect(
      getCrewRosterAssigneeId({
        membershipId: null,
        invitationId: "tinv_1",
      }),
    ).toBe("tinv_1")
    expect(
      getCrewRosterAssigneeId({ membershipId: null, invitationId: null }),
    ).toBeNull()
  })

  it("treats invitation-based imported volunteers as staffable", () => {
    // Regression: imported volunteers are stored as invitations with a null
    // membershipId and status "pending"/"accepted". They must be staffable.
    expect(
      isCrewRosterVolunteerStaffable(
        rosterVolunteer({ invitationId: "tinv_imported", status: "pending" }),
      ),
    ).toBe(true)
    expect(
      isCrewRosterVolunteerStaffable(
        rosterVolunteer({ invitationId: "tinv_imported", status: "accepted" }),
      ),
    ).toBe(true)
    expect(
      isCrewRosterVolunteerStaffable(
        rosterVolunteer({ membershipId: "tmem_active", status: "active" }),
      ),
    ).toBe(true)
  })

  it("excludes expired invitations and inactive memberships from staffing", () => {
    expect(
      isCrewRosterVolunteerStaffable(
        rosterVolunteer({ invitationId: "tinv_lapsed", status: "expired" }),
      ),
    ).toBe(false)
    expect(
      isCrewRosterVolunteerStaffable(
        rosterVolunteer({ membershipId: "tmem_off", status: "inactive" }),
      ),
    ).toBe(false)
  })

  it("counts invitation-based volunteers as assignable in the roster summary", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")
    const roster = buildCrewRoster(
      [
        {
          id: "tinv_imported_general",
          email: "imported@example.com",
          status: "pending",
          expiresAt: "2026-12-31T12:00:00.000Z",
          metadata: JSON.stringify({
            signupName: "Imported General",
            crewImportId: "cimp_1",
            volunteerRoleTypes: ["general"],
          }),
        },
      ],
      [],
      now,
    )

    expect(roster[0]).toMatchObject({
      source: "team_invitation",
      membershipId: null,
      invitationId: "tinv_imported_general",
      imported: true,
    })
    expect(summarizeCrewRoster(roster)).toMatchObject({
      total: 1,
      pending: 1,
      assignable: 1,
    })
  })

  it("validates an invitation-based general volunteer for a general shift", () => {
    const volunteer = buildCrewRoster(
      [
        {
          id: "tinv_general",
          email: "general@example.com",
          status: "pending",
          expiresAt: "2026-12-31T12:00:00.000Z",
          metadata: JSON.stringify({
            signupName: "General Volunteer",
            crewImportId: "cimp_1",
          }),
        },
      ],
      [],
    )[0]

    expect(volunteer).toBeDefined()
    if (!volunteer) return
    const assigneeId = getCrewRosterAssigneeId(volunteer)
    expect(assigneeId).toBe("tinv_general")

    expect(
      validateShiftAssignment({
        shiftRoleType: "medical",
        capacity: 2,
        currentAssignmentMembershipIds: [],
        volunteer: {
          membershipId: assigneeId ?? "",
          roleTypes: volunteer.roleTypes,
          isActive: isCrewRosterVolunteerStaffable(volunteer),
        },
      }),
    ).toEqual({ ok: true })
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

  it("rejects capacity updates below current assignment count", () => {
    expect(validateShiftCapacityUpdate(2, 3)).toMatchObject({
      ok: false,
      reason: "below_assigned_count",
    })
    expect(validateShiftCapacityUpdate(3, 3)).toEqual({ ok: true })
    expect(validateShiftCapacityUpdate(4, 3)).toEqual({ ok: true })
  })
})

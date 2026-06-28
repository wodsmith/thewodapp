// @lat: [[crew#Volunteer Self Service]]
import { describe, expect, it } from "vitest"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  type CrewAssignmentConfirmationStatus,
} from "../../db/schemas/crew-imports"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_TYPES,
} from "../../db/schemas/volunteers"
import {
  buildCrewVolunteerSelfServiceGoogleCalendarUrl,
  buildCrewVolunteerSelfServiceIcs,
  buildCrewVolunteerSelfServiceIcsFilename,
  buildCrewVolunteerSelfServiceSchedule,
  resolveCrewVolunteerSelfServiceContactUpdate,
  type CrewVolunteerSelfServiceAssignmentRecord,
} from "./volunteer-self-service"

describe("Crew volunteer self-service schedule", () => {
  it("keeps token access isolated to the volunteer membership schedule", () => {
    const schedule = buildCrewVolunteerSelfServiceSchedule({
      assigneeId: "tmem_ada",
      tokenAssignmentId: "vsha_token",
      assignments: [
        assignment({
          id: "vsha_other",
          assigneeId: "tmem_other",
          startTime: "2026-06-20T14:00:00.000Z",
        }),
        assignment({
          id: "vsha_later",
          assigneeId: "tmem_ada",
          startTime: "2026-06-20T18:00:00.000Z",
        }),
        assignment({
          id: "vsha_token",
          assigneeId: "tmem_ada",
          startTime: "2026-06-20T15:00:00.000Z",
          confirmationStatus: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
        }),
        assignment({
          id: "vsha_token",
          assigneeId: "tmem_ada",
          startTime: "2026-06-20T15:00:00.000Z",
          confirmationStatus: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
        }),
      ],
    })

    expect(schedule.map((item) => item.id)).toEqual([
      "vsha_token",
      "vsha_later",
    ])
    expect(schedule.find((item) => item.id === "vsha_token")).toMatchObject({
      isTokenAssignment: true,
      confirmation: {
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
      },
    })
    expect(schedule.some((item) => item.id === "vsha_other")).toBe(false)
  })
})

describe("Crew volunteer self-service contact updates", () => {
  it("updates contact metadata without losing staffing or import audit fields", () => {
    const result = resolveCrewVolunteerSelfServiceContactUpdate(
      JSON.stringify({
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
        crewImportId: "cimp_123",
        crewSignupSource: "import",
        internalNotes: "Keep at north floor",
        signupEmail: "old@example.com",
      }),
      {
        email: " ADA@Example.com ",
        name: " Ada Lovelace ",
        phone: " 555-0100 ",
        availability: VOLUNTEER_AVAILABILITY.AFTERNOON,
        availabilityNotes: " After 1pm ",
        credentials: " L1 Judge ",
      },
    )

    expect(result.changed).toBe(true)
    expect(result.metadata).toMatchObject({
      signupEmail: "ada@example.com",
      signupName: "Ada Lovelace",
      signupPhone: "555-0100",
      availability: VOLUNTEER_AVAILABILITY.AFTERNOON,
      availabilityNotes: "After 1pm",
      credentials: "L1 Judge",
      volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
      crewImportId: "cimp_123",
      crewSignupSource: "import",
      internalNotes: "Keep at north floor",
    })
  })

  it("treats repeated contact saves as idempotent no-ops", () => {
    const first = resolveCrewVolunteerSelfServiceContactUpdate(null, {
      email: "ada@example.com",
      name: "Ada Lovelace",
      phone: "555-0100",
    })
    const second = resolveCrewVolunteerSelfServiceContactUpdate(
      JSON.stringify(first.metadata),
      {
        email: " ada@example.com ",
        name: " Ada Lovelace ",
        phone: " 555-0100 ",
      },
    )

    expect(first.changed).toBe(true)
    expect(second.changed).toBe(false)
  })
})

describe("Crew volunteer self-service calendar helpers", () => {
  it("builds deterministic iCal, Google Calendar, and filename outputs", () => {
    const [item] = buildCrewVolunteerSelfServiceSchedule({
      assigneeId: "tmem_ada",
      tokenAssignmentId: "vsha_token",
      assignments: [
        assignment({
          id: "vsha_token",
          assigneeId: "tmem_ada",
          name: "Morning Check-In",
          roleLabel: "Check-In",
          startTime: "2026-06-20T15:00:00.000Z",
          endTime: "2026-06-20T17:00:00.000Z",
          location: "North Floor",
          notes: "Bring clipboard",
        }),
      ],
    })

    expect(item).toBeDefined()
    const ics = buildCrewVolunteerSelfServiceIcs({
      eventName: "Friday, Night",
      assignments: item ? [item] : [],
      generatedAt: new Date("2026-06-20T12:00:00.000Z"),
    })
    const googleUrl = item
      ? buildCrewVolunteerSelfServiceGoogleCalendarUrl({
          eventName: "Friday Night",
          assignment: item,
        })
      : ""
    const google = new URL(googleUrl)

    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("DTSTART:20260620T150000Z")
    expect(ics).toContain("SUMMARY:Friday\\, Night: Morning Check-In")
    expect(ics).toContain("DESCRIPTION:Role: Check-In\\nNotes: Bring clipboard")
    expect(google.searchParams.get("text")).toBe(
      "Friday Night: Morning Check-In",
    )
    expect(google.searchParams.get("location")).toBe("North Floor")
    expect(buildCrewVolunteerSelfServiceIcsFilename("Friday Night!")).toBe(
      "friday-night-schedule.ics",
    )
  })
})

function assignment(
  overrides: Partial<CrewVolunteerSelfServiceAssignmentRecord> & {
    confirmationStatus?: CrewAssignmentConfirmationStatus
  },
): CrewVolunteerSelfServiceAssignmentRecord {
  return {
    id: overrides.id ?? "vsha_default",
    assigneeId: overrides.assigneeId ?? "tmem_ada",
    shiftId: overrides.shiftId ?? "vshf_default",
    name: overrides.name ?? "Check-In",
    roleType: overrides.roleType ?? VOLUNTEER_ROLE_TYPES.CHECK_IN,
    roleLabel: overrides.roleLabel ?? "Check-In",
    startTime: overrides.startTime ?? "2026-06-20T15:00:00.000Z",
    endTime: overrides.endTime ?? "2026-06-20T17:00:00.000Z",
    location: overrides.location ?? "North Floor",
    notes: overrides.notes ?? null,
    confirmation: {
      id: `caconf_${overrides.id ?? "default"}`,
      status:
        overrides.confirmationStatus ??
        CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      sentAt: null,
      respondedAt: null,
      expiresAt: "2026-06-27T12:00:00.000Z",
      responseNote: null,
    },
  }
}

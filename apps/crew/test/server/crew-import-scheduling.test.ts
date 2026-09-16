// @lat: [[crew#Import Apply]]
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
import { crewDepartmentLeadsTable } from "@/db/schemas/crew-self-serve-presets"
import { INVITATION_STATUS, TEAM_PERMISSIONS, teamInvitationTable } from "@/db/schemas/teams"
import { volunteerShiftAssignmentsTable, volunteerShiftsTable } from "@/db/schemas/volunteers"
import { buildVolunteerApplyPlan } from "@/lib/crew/imports/apply"
import { volunteerRegistrationExportPreset } from "@/lib/crew/imports/builtin-presets"
import { buildCrewImportPreview } from "@/lib/crew/imports/preview"
import { buildCrewRoster } from "@/lib/crew/roster-shifts"
import { assignCrewVolunteerToShift } from "@/server/crew-roster-shift.server"

const mocks = vi.hoisted(() => ({
  db: null as unknown,
  session: vi.fn(),
  confirmation: vi.fn(),
}))
vi.mock("@/db", () => ({ getDb: () => mocks.db }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: mocks.session }))
vi.mock("@/server/crew-confirmation.server", () => ({
  ensureCrewShiftAssignmentConfirmation: mocks.confirmation,
  cancelCrewShiftAssignmentConfirmations: vi.fn(),
  loadCrewShiftAssignmentConfirmationMap: vi.fn(),
  summarizeCrewShiftAssignmentConfirmations: vi.fn(),
}))

const event = {
  id: "comp_registration_export",
  name: "October Throwdown",
  slug: "october-throwdown",
  organizingTeamId: "team_organizer",
  competitionTeamId: "team_event",
  startDate: "2026-10-10",
  endDate: "2026-10-11",
  timezone: "America/Boise",
}
const shift = {
  id: "vshift_judges",
  competitionId: event.id,
  name: "Morning judges",
  roleType: "judge",
  capacity: 2,
  startTime: new Date("2026-10-10T14:00:00Z"),
  endTime: new Date("2026-10-10T18:00:00Z"),
  location: "Main floor",
}
const availability = "Saturday Oct 10, 8:00 AM–12:00 PM; Sunday Oct 11, 1:00 PM–5:00 PM"
// Representative volunteer registration export, including all preset headers and
// a quoted, multi-day Shifts cell. Names and contact details are synthetic.
const csv = [
  volunteerRegistrationExportPreset.headers.join(","),
  ["volunteer-9001", "Casey", "Volunteer", "CASEY@example.com", "1", "5551234567", "31", "1995-01-01", "", "M", "M", "9", "Prefers morning", "", "", "2026-09-01", availability, "Judge", "Check-in", ""].map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
].join("\n")

function importedInvitation() {
  const preview = buildCrewImportPreview({
    kind: "volunteers",
    file: { filename: "volunteer-registration-export.csv", mimeType: "text/csv", data: Uint8Array.from(new TextEncoder().encode(csv)) },
    columnMapping: volunteerRegistrationExportPreset.columnMapping,
    context: { roleLabels: ["Judge", "Check-in"], divisions: [], workouts: [], heats: [] },
  })
  expect(preview.errorCount).toBe(0)
  const plan = buildVolunteerApplyPlan(preview.rows, {
    importId: "cimp_registration_export",
    existingInvitations: [],
    existingMemberships: [],
  })
  expect(plan.rows[0]?.operation).toBe("create_invitation")
  return {
    preview,
    invitation: {
      id: "tinv_registration_export",
      teamId: event.competitionTeamId,
      email: plan.rows[0]!.email,
      metadata: plan.rows[0]!.metadata,
      status: INVITATION_STATUS.PENDING as string,
      acceptedAt: null,
      // Legacy production imports used a 30-day invitation expiry.
      createdAt: new Date("2026-09-01T12:00:00Z"),
      expiresAt: new Date("2026-10-01T12:00:00Z"),
    },
  }
}

function databaseFor(invitation: ReturnType<typeof importedInvitation>["invitation"]) {
  const writes = vi.fn().mockResolvedValue(undefined)
  const transaction = vi.fn(async (callback: (db: unknown) => unknown) => callback(db))
  const db = {
    transaction,
    insert: vi.fn(() => ({ values: writes })),
    select: vi.fn(() => {
      let rows: unknown[] = []
      const chain: Record<string, unknown> = {
        from: (table: unknown) => {
          if (table === crewEventSettingsTable) rows = [event]
          if (table === volunteerShiftsTable) rows = [shift]
          if (table === teamInvitationTable) rows = [invitation]
          if (table === volunteerShiftAssignmentsTable || table === crewDepartmentLeadsTable) rows = []
          return chain
        },
        then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
      }
      for (const method of ["innerJoin", "leftJoin", "where", "for", "limit", "orderBy"]) chain[method] = () => chain
      return chain
    }),
  }
  mocks.db = db
  return { ...db, writes }
}

describe("Volunteer registration import to accountless shift scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Day 35 after import, and still before the competition.
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"))
    mocks.session.mockResolvedValue({
      userId: "user_organizer",
      user: { role: "user", email: "organizer@example.com" },
      teams: [{ id: event.organizingTeamId, permissions: [TEAM_PERMISSIONS.MANAGE_COMPETITIONS] }],
    })
    mocks.confirmation.mockResolvedValue({ id: "confirmation_registration_export", action: "created", token: null })
  })
  afterEach(() => vi.useRealTimers())

  it("preserves dated availability, reimports by email, and assigns a legacy import after day 30", async () => {
    const { preview, invitation } = importedInvitation()
    const [volunteer] = buildCrewRoster([invitation], [])
    expect(volunteer).toMatchObject({ name: "Casey Volunteer", email: "casey@example.com", availability: null, availabilityNotes: availability, imported: true, status: "pending" })
    const reimport = buildVolunteerApplyPlan(preview.rows, {
      importId: "cimp_registration_export_again",
      existingInvitations: [invitation],
      existingMemberships: [],
    })
    expect(reimport.rows[0]).toMatchObject({ operation: "update_invitation", targetId: invitation.id })

    const db = databaseFor(invitation)
    await expect(assignCrewVolunteerToShift({ eventId: event.id, shiftId: shift.id, assigneeId: invitation.id })).resolves.toMatchObject({ action: "assigned" })
    expect(db.writes).toHaveBeenCalledWith(expect.objectContaining({ shiftId: shift.id, invitationId: invitation.id, membershipId: null }))
    expect(mocks.confirmation).toHaveBeenCalledWith(expect.objectContaining({ invitationId: invitation.id, membershipId: null, email: "casey@example.com" }))
    // No invitation acceptance, expiry renewal, or account creation is needed.
    expect(invitation.expiresAt.toISOString()).toBe("2026-10-01T12:00:00.000Z")
    expect(invitation.acceptedAt).toBeNull()
  })

  it.each([null, { userId: "unrelated", user: { role: "user", email: "other@example.com" }, teams: [] }])("still requires organizer authorization", async (session) => {
    const { invitation } = importedInvitation()
    const db = databaseFor(invitation)
    mocks.session.mockResolvedValue(session)
    await expect(assignCrewVolunteerToShift({ eventId: event.id, shiftId: shift.id, assigneeId: invitation.id })).rejects.toThrow(/NOT_AUTHORIZED|FORBIDDEN/)
    expect(db.transaction).not.toHaveBeenCalled()
    expect(db.writes).not.toHaveBeenCalled()
  })

  it.each(["cancelled", "ordinary expired signup"])("does not staff a %s invitation", async (kind) => {
    const { invitation } = importedInvitation()
    if (kind === "cancelled") {
      invitation.status = INVITATION_STATUS.CANCELLED
      invitation.expiresAt = new Date("2027-01-01T00:00:00Z")
    }
    else invitation.metadata = JSON.stringify({ volunteerRoleTypes: ["judge"], inviteSource: "volunteer_signup" })
    const db = databaseFor(invitation)
    await expect(assignCrewVolunteerToShift({ eventId: event.id, shiftId: shift.id, assigneeId: invitation.id })).rejects.toThrow()
    expect(db.writes).not.toHaveBeenCalled()
    expect(mocks.confirmation).not.toHaveBeenCalled()
  })
})

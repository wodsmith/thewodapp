// @lat: [[crew#Shift Board Pilot Ops]]
import { describe, expect, it } from "vitest"
import type { CrewRosterVolunteer } from "./roster-shifts"
import {
  buildCrewShiftBoardPilotOps,
  filterCrewShiftBoardPilotShifts,
  type CrewShiftPilotOpsShift,
} from "./shift-board-pilot-ops"
import { buildCrewStaffingMatrix } from "./staffing"

describe("Crew shift board pilot ops helpers", () => {
  it("derives shift-level gap, confirmation, availability, and status signals", () => {
    const roster = [
      rosterVolunteer({
        membershipId: "tmem_imported_judge",
        name: "Imported Judge",
        roleTypes: ["judge"],
        availability: "morning",
        credentials: "L1 Judge",
        imported: true,
      }),
      rosterVolunteer({
        membershipId: "tmem_medical",
        name: "Medical Lead",
        roleTypes: ["medical"],
        availability: "all_day",
        credentials: "EMT",
      }),
      rosterVolunteer({
        membershipId: "tmem_equipment",
        name: "Equipment Lead",
        roleTypes: ["equipment"],
        availability: "all_day",
        credentials: "Rigging",
      }),
    ]
    const shifts = [
      shift({
        id: "vshf_open",
        roleType: "judge",
        capacity: 2,
        startTime: "2026-07-04T20:00:00.000Z",
        endTime: "2026-07-04T22:00:00.000Z",
        assignments: [
          {
            id: "vsha_pending",
            membershipId: "tmem_imported_judge",
            confirmation: { status: "pending" },
          },
        ],
      }),
      shift({
        id: "vshf_response",
        roleType: "medical",
        capacity: 1,
        assignments: [
          {
            id: "vsha_medical",
            membershipId: "tmem_medical",
            confirmation: { status: "pending" },
          },
        ],
      }),
      shift({
        id: "vshf_ready",
        roleType: "equipment",
        capacity: 1,
        assignments: [
          {
            id: "vsha_equipment",
            membershipId: "tmem_equipment",
            confirmation: { status: "confirmed" },
          },
        ],
      }),
    ]
    const matrix = buildCrewStaffingMatrix({
      event: {
        id: "comp_pilot",
        timezone: "America/Denver",
      },
      roster: toStaffingRoster(roster),
      shifts: toStaffingShifts(shifts),
    })

    const pilotOps = buildCrewShiftBoardPilotOps({
      shifts,
      roster,
      matrix,
    })

    expect(pilotOps.summary).toMatchObject({
      totalShifts: 3,
      readyShifts: 1,
      responsesNeededShiftCount: 1,
      blockedShiftCount: 1,
      openSlots: 1,
      importedRosterCount: 1,
      importedAssignmentCount: 1,
      credentialedAssignableCount: 3,
    })
    expect(pilotOps.shiftsById.vshf_open).toMatchObject({
      status: "blocked",
      importedAssignmentCount: 1,
      confirmationCounts: { pending: 1 },
    })
    expect(
      pilotOps.shiftsById.vshf_open?.warnings.map((warning) => warning.kind),
    ).toEqual(["open_capacity", "confirmation_gap", "outside_availability"])
    expect(pilotOps.shiftsById.vshf_response?.status).toBe("responses_needed")
    expect(pilotOps.shiftsById.vshf_ready?.status).toBe("ready")
  })

  it("filters shifts by role, status, assignment source, and credentials", () => {
    const roster = [
      rosterVolunteer({
        membershipId: "tmem_imported_judge",
        name: "Imported Judge",
        roleTypes: ["judge"],
        credentials: "L1 Judge",
        imported: true,
      }),
      rosterVolunteer({
        membershipId: "tmem_medical",
        name: "Medical Lead",
        roleTypes: ["medical"],
        credentials: "EMT",
      }),
    ]
    const shifts = [
      shift({
        id: "vshf_imported",
        roleType: "judge",
        capacity: 1,
        assignments: [
          {
            id: "vsha_imported",
            membershipId: "tmem_imported_judge",
            confirmation: { status: "confirmed" },
          },
        ],
      }),
      shift({
        id: "vshf_medical",
        roleType: "medical",
        capacity: 1,
        assignments: [
          {
            id: "vsha_medical",
            membershipId: "tmem_medical",
            confirmation: { status: "pending" },
          },
        ],
      }),
    ]
    const matrix = buildCrewStaffingMatrix({
      event: {
        id: "comp_pilot",
        timezone: "America/Denver",
      },
      roster: toStaffingRoster(roster),
      shifts: toStaffingShifts(shifts),
    })
    const pilotOps = buildCrewShiftBoardPilotOps({
      shifts,
      roster,
      matrix,
    })

    expect(
      filterCrewShiftBoardPilotShifts({
        shifts,
        roster,
        pilotOps,
        filters: {
          roleType: "medical",
          status: "all",
          source: "all",
          credentialQuery: "",
        },
      }).map((filteredShift) => filteredShift.id),
    ).toEqual(["vshf_medical"])

    expect(
      filterCrewShiftBoardPilotShifts({
        shifts,
        roster,
        pilotOps,
        filters: {
          roleType: "all",
          status: "ready",
          source: "imported_assignments",
          credentialQuery: "judge",
        },
      }).map((filteredShift) => filteredShift.id),
    ).toEqual(["vshf_imported"])

    expect(
      filterCrewShiftBoardPilotShifts({
        shifts,
        roster,
        pilotOps,
        filters: {
          roleType: "all",
          status: "responses_needed",
          source: "direct_assignments",
          credentialQuery: "emt",
        },
      }).map((filteredShift) => filteredShift.id),
    ).toEqual(["vshf_medical"])
  })

  it("keeps mixed-source shifts in the direct assignment filter", () => {
    const roster = [
      rosterVolunteer({
        membershipId: "tmem_imported_judge",
        name: "Imported Judge",
        roleTypes: ["judge"],
        imported: true,
      }),
      rosterVolunteer({
        membershipId: "tmem_direct_judge",
        name: "Direct Judge",
        roleTypes: ["judge"],
      }),
    ]
    const shifts = [
      shift({
        id: "vshf_imported_only",
        roleType: "judge",
        capacity: 1,
        assignments: [
          {
            id: "vsha_imported",
            membershipId: "tmem_imported_judge",
            confirmation: { status: "confirmed" },
          },
        ],
      }),
      shift({
        id: "vshf_mixed",
        roleType: "judge",
        capacity: 2,
        assignments: [
          {
            id: "vsha_mixed_imported",
            membershipId: "tmem_imported_judge",
            confirmation: { status: "confirmed" },
          },
          {
            id: "vsha_mixed_direct",
            membershipId: "tmem_direct_judge",
            confirmation: { status: "confirmed" },
          },
        ],
      }),
    ]
    const matrix = buildCrewStaffingMatrix({
      event: {
        id: "comp_pilot",
        timezone: "America/Denver",
      },
      roster: toStaffingRoster(roster),
      shifts: toStaffingShifts(shifts),
    })
    const pilotOps = buildCrewShiftBoardPilotOps({
      shifts,
      roster,
      matrix,
    })

    expect(
      filterCrewShiftBoardPilotShifts({
        shifts,
        roster,
        pilotOps,
        filters: {
          roleType: "all",
          status: "all",
          source: "direct_assignments",
          credentialQuery: "",
        },
      }).map((filteredShift) => filteredShift.id),
    ).toEqual(["vshf_mixed"])
  })
})

function rosterVolunteer(
  overrides: Partial<CrewRosterVolunteer> & {
    membershipId: string
    name: string
  },
): CrewRosterVolunteer {
  return {
    id: `membership:${overrides.membershipId}`,
    source: "team_membership",
    sourceId: overrides.membershipId,
    membershipId: overrides.membershipId,
    invitationId: null,
    email: `${overrides.membershipId}@example.com`,
    name: overrides.name,
    phone: null,
    status: "active",
    roleTypes: overrides.roleTypes ?? ["general"],
    availability: overrides.availability ?? "all_day",
    availabilityNotes: null,
    credentials: overrides.credentials ?? null,
    notes: null,
    imported: overrides.imported ?? false,
    signupSource: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  }
}

function shift(
  overrides: Omit<Partial<CrewShiftPilotOpsShift>, "assignments" | "roleType"> &
    Pick<CrewShiftPilotOpsShift, "id" | "roleType" | "capacity"> & {
      assignments?: CrewShiftPilotOpsShift["assignments"]
      startTime?: string
      endTime?: string
    },
): CrewShiftPilotOpsShift & { startTime: string; endTime: string } {
  const assignments = overrides.assignments ?? []
  return {
    name: overrides.id,
    assignedCount: assignments.length,
    openSlots: Math.max(overrides.capacity - assignments.length, 0),
    startTime: overrides.startTime ?? "2026-07-04T15:00:00.000Z",
    endTime: overrides.endTime ?? "2026-07-04T17:00:00.000Z",
    ...overrides,
    assignments,
  }
}

function toStaffingRoster(roster: CrewRosterVolunteer[]) {
  return roster.map((volunteer) => ({
    membershipId: volunteer.membershipId ?? "",
    name: volunteer.name,
    email: volunteer.email,
    roleTypes: volunteer.roleTypes,
    availability: volunteer.availability,
    credentials: volunteer.credentials,
    isActive: volunteer.status === "active",
  }))
}

function toStaffingShifts(
  shifts: Array<
    CrewShiftPilotOpsShift & { startTime: string; endTime: string }
  >,
) {
  return shifts.map((crewShift) => ({
    id: crewShift.id,
    name: crewShift.name,
    roleType: crewShift.roleType,
    startTime: crewShift.startTime,
    endTime: crewShift.endTime,
    capacity: crewShift.capacity,
    assignments: crewShift.assignments,
  }))
}

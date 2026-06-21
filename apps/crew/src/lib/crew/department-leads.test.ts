// @lat: [[crew#Department Leads]]
import { describe, expect, it } from "vitest"
import {
  assertCrewDepartmentLeadCanManageRosterTarget,
  assertCrewDepartmentLeadCanManageShift,
  buildCrewDepartmentLeadScopePayload,
  crewDepartmentLeadCanManageShift,
  filterCrewDepartmentLeadRoster,
  filterCrewDepartmentLeadShifts,
  getCrewDepartmentLeadFloorFromScope,
  normalizeCrewDepartmentLeadScope,
  parseCrewDepartmentLeadDateTimeLocal,
  type CrewDepartmentLeadAccess,
} from "./department-leads"

describe("Crew department lead scope helpers", () => {
  const judgeNorthMorningScope = normalizeCrewDepartmentLeadScope({
    id: "cdlead_judge_north",
    roleType: "judge",
    startsAt: "2026-07-01T14:00:00.000Z",
    endsAt: "2026-07-01T18:00:00.000Z",
    scope: { floors: ["North Floor"] },
  })
  const access: CrewDepartmentLeadAccess = {
    kind: "department_lead",
    scopes: [judgeNorthMorningScope],
  }

  it("matches shifts by role, floor, and overlapping time window", () => {
    expect(
      crewDepartmentLeadCanManageShift(judgeNorthMorningScope, {
        id: "vshf_match",
        roleType: "judge",
        location: " north floor ",
        startTime: "2026-07-01T15:00:00.000Z",
        endTime: "2026-07-01T16:00:00.000Z",
      }),
    ).toBe(true)

    expect(
      crewDepartmentLeadCanManageShift(judgeNorthMorningScope, {
        id: "vshf_wrong_role",
        roleType: "medical",
        location: "North Floor",
        startTime: "2026-07-01T15:00:00.000Z",
        endTime: "2026-07-01T16:00:00.000Z",
      }),
    ).toBe(false)

    expect(
      crewDepartmentLeadCanManageShift(judgeNorthMorningScope, {
        id: "vshf_wrong_floor",
        roleType: "judge",
        location: "South Floor",
        startTime: "2026-07-01T15:00:00.000Z",
        endTime: "2026-07-01T16:00:00.000Z",
      }),
    ).toBe(false)

    expect(
      crewDepartmentLeadCanManageShift(judgeNorthMorningScope, {
        id: "vshf_after_window",
        roleType: "judge",
        location: "North Floor",
        startTime: "2026-07-01T18:00:00.000Z",
        endTime: "2026-07-01T19:00:00.000Z",
      }),
    ).toBe(false)
  })

  it("filters shift and roster reads without leaking the full roster", () => {
    const visibleShift = {
      id: "vshf_visible",
      roleType: "judge" as const,
      location: "North Floor",
      startTime: new Date("2026-07-01T15:00:00.000Z"),
      endTime: new Date("2026-07-01T16:00:00.000Z"),
      assignments: [{ membershipId: "tmem_assigned_medical" }],
    }
    const hiddenShift = {
      id: "vshf_hidden",
      roleType: "judge" as const,
      location: "South Floor",
      startTime: new Date("2026-07-01T15:00:00.000Z"),
      endTime: new Date("2026-07-01T16:00:00.000Z"),
      assignments: [{ membershipId: "tmem_hidden" }],
    }
    const scopedShifts = filterCrewDepartmentLeadShifts(
      [visibleShift, hiddenShift],
      access,
    )
    const scopedRoster = filterCrewDepartmentLeadRoster(
      [
        { membershipId: "tmem_judge", roleTypes: ["judge" as const] },
        {
          membershipId: "tmem_assigned_medical",
          roleTypes: ["medical" as const],
        },
        { membershipId: "tmem_hidden", roleTypes: ["medical" as const] },
      ],
      access,
      scopedShifts,
    )

    expect(scopedShifts.map((shift) => shift.id)).toEqual(["vshf_visible"])
    expect(scopedRoster.map((volunteer) => volunteer.membershipId)).toEqual([
      "tmem_judge",
      "tmem_assigned_medical",
    ])
  })

  it("denies out-of-scope shift and roster mutations", () => {
    expect(() =>
      assertCrewDepartmentLeadCanManageShift(access, {
        id: "vshf_wrong_time",
        roleType: "judge",
        location: "North Floor",
        startTime: "2026-07-01T19:00:00.000Z",
        endTime: "2026-07-01T20:00:00.000Z",
      }),
    ).toThrow("Department lead scope")

    expect(() =>
      assertCrewDepartmentLeadCanManageRosterTarget(access, {
        membershipId: "tmem_medical",
        roleTypes: ["medical"],
      }),
    ).toThrow("Department lead scope")
  })

  it("writes canonical floor scope and reads legacy floor shapes", () => {
    expect(buildCrewDepartmentLeadScopePayload(" North Floor ")).toEqual({
      floorNames: ["North Floor"],
    })
    expect(getCrewDepartmentLeadFloorFromScope({ floorNames: ["North"] })).toBe(
      "North",
    )
    expect(getCrewDepartmentLeadFloorFromScope({ floors: ["Legacy"] })).toBe(
      "Legacy",
    )
    expect(getCrewDepartmentLeadFloorFromScope({ locations: ["Lane 1"] })).toBe(
      "Lane 1",
    )
  })

  it("parses department lead datetime-local values in the event timezone", () => {
    expect(
      parseCrewDepartmentLeadDateTimeLocal(
        "2026-07-01T09:30",
        "America/Denver",
      )?.toISOString(),
    ).toBe("2026-07-01T15:30:00.000Z")
    expect(
      parseCrewDepartmentLeadDateTimeLocal(
        "2026-07-01T09:30:00.000Z",
        "America/Denver",
      )?.toISOString(),
    ).toBe("2026-07-01T09:30:00.000Z")
  })
})

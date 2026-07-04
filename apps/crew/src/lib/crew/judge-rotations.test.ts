// @lat: [[crew#Judge Rotations]]
import { describe, expect, it } from "vitest"
import {
  LANE_SHIFT_PATTERN,
  VOLUNTEER_ROLE_TYPES,
} from "@/db/schemas/volunteers"
import {
  expandCrewJudgeRotationDrafts,
  getCrewJudgeHeatLaneCount,
  hasCrewJudgeRotationErrors,
  isCrewJudgeEligible,
  summarizeCrewJudgeCoverage,
  validateCrewJudgeRotationDrafts,
} from "./judge-rotations"
import { buildCrewRoster, getCrewRosterAssigneeId } from "./roster-shifts"

const heats = [
  { heatNumber: 1, laneCount: 3 },
  { heatNumber: 2, laneCount: 3 },
  { heatNumber: 3, laneCount: 3 },
]

describe("Crew judge rotation helpers", () => {
  it("expands shift-right rotations across consecutive heats", () => {
    expect(
      expandCrewJudgeRotationDrafts({
        heats,
        rotations: [
          {
            membershipId: "tmem_judge_1",
            startingHeat: 1,
            startingLane: 2,
            heatsCount: 3,
            laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
          },
        ],
      }),
    ).toEqual([
      {
        rotationId: "draft-0",
        membershipId: "tmem_judge_1",
        heatNumber: 1,
        laneNumber: 2,
      },
      {
        rotationId: "draft-0",
        membershipId: "tmem_judge_1",
        heatNumber: 2,
        laneNumber: 3,
      },
      {
        rotationId: "draft-0",
        membershipId: "tmem_judge_1",
        heatNumber: 3,
        laneNumber: 1,
      },
    ])
  })

  it("rejects duplicate same-judge heat coverage in a replacement plan", () => {
    const issues = validateCrewJudgeRotationDrafts({
      heats,
      rotations: [
        {
          membershipId: "tmem_judge_1",
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 2,
          laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
        },
        {
          membershipId: "tmem_judge_1",
          startingHeat: 2,
          startingLane: 2,
          heatsCount: 1,
          laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
        },
      ],
    })

    expect(hasCrewJudgeRotationErrors(issues)).toBe(true)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "duplicate_judge_heat",
          heatNumber: 2,
        }),
      ]),
    )
  })

  it("rejects lanes already occupied by another judge rotation", () => {
    const issues = validateCrewJudgeRotationDrafts({
      heats,
      occupiedSlots: [
        {
          rotationId: "jrot_existing",
          membershipId: "tmem_other_judge",
          heatNumber: 1,
          laneNumber: 1,
        },
      ],
      rotations: [
        {
          membershipId: "tmem_judge_1",
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 1,
          laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
        },
      ],
    })

    expect(hasCrewJudgeRotationErrors(issues)).toBe(true)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "occupied_lane",
          heatNumber: 1,
          laneNumber: 1,
        }),
      ]),
    )
  })

  it("derives heat lane capacity from occupied lanes when they exceed the venue lane count", () => {
    expect(
      getCrewJudgeHeatLaneCount({
        venueLaneCount: 3,
        occupiedLanes: [1, 5],
      }),
    ).toBe(5)
  })

  it("summarizes coverage gaps and overlaps deterministically", () => {
    const summary = summarizeCrewJudgeCoverage({
      heats: [{ heatNumber: 1, laneCount: 2 }],
      rotations: [
        {
          id: "jrot_a",
          membershipId: "tmem_judge_1",
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 1,
          laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
        },
        {
          id: "jrot_b",
          membershipId: "tmem_judge_2",
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 1,
          laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
        },
      ],
    })

    expect(summary).toMatchObject({
      totalSlots: 2,
      coveredSlots: 1,
      coveragePercent: 50,
      gaps: [{ heatNumber: 1, laneNumber: 2 }],
    })
    expect(summary.overlaps).toEqual([
      {
        heatNumber: 1,
        laneNumber: 1,
        judges: [
          { membershipId: "tmem_judge_1", rotationId: "jrot_a" },
          { membershipId: "tmem_judge_2", rotationId: "jrot_b" },
        ],
      },
    ])
  })
})

describe("isCrewJudgeEligible", () => {
  it("includes judge and head judge roles", () => {
    expect(isCrewJudgeEligible([VOLUNTEER_ROLE_TYPES.JUDGE])).toBe(true)
    expect(isCrewJudgeEligible([VOLUNTEER_ROLE_TYPES.HEAD_JUDGE])).toBe(true)
  })

  it("includes general volunteers so imported batches can be staffed as judges", () => {
    // Organizers import volunteers with the General role intending to seat them
    // as judges; excluding General would leave the judge roster empty.
    expect(isCrewJudgeEligible([VOLUNTEER_ROLE_TYPES.GENERAL])).toBe(true)
  })

  it("excludes non-judge specialist roles", () => {
    expect(isCrewJudgeEligible([VOLUNTEER_ROLE_TYPES.MEDICAL])).toBe(false)
    expect(isCrewJudgeEligible([VOLUNTEER_ROLE_TYPES.CHECK_IN])).toBe(false)
    expect(isCrewJudgeEligible([])).toBe(false)
  })
})

describe("imported (invitation-based) judge eligibility", () => {
  it("surfaces an imported General volunteer as a judge-eligible roster entry keyed by invitation id", () => {
    // Repro for the empty judge grid: an organizer imports a batch of General
    // volunteers (stored as team_invitation rows, no user account). They must
    // appear in the judge roster and be keyed by their invitation id.
    const roster = buildCrewRoster(
      [
        {
          id: "tinv_imported_general",
          email: "imported@example.com",
          status: "pending",
          metadata: JSON.stringify({
            volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.GENERAL],
            signupName: "Imported Judge",
            crewImportId: "import_1",
          }),
        },
      ],
      [],
    )

    expect(roster).toHaveLength(1)
    const volunteer = roster[0]
    if (!volunteer) throw new Error("expected imported volunteer")

    // Cause #1: General is judge-eligible.
    expect(isCrewJudgeEligible(volunteer.roleTypes)).toBe(true)
    // Cause #2: the invitation has no membership; it is keyed by invitation id.
    expect(volunteer.membershipId).toBeNull()
    expect(getCrewRosterAssigneeId(volunteer)).toBe("tinv_imported_general")
  })
})

// @lat: [[crew#Judge Rotations]]
import { describe, expect, it } from "vitest"
import { LANE_SHIFT_PATTERN } from "@/db/schemas/volunteers"
import {
  assertCrewJudgeRotationReplacementAllowed,
  expandCrewJudgeRotationDrafts,
  getCrewJudgeHeatLaneCount,
  hasCrewJudgeRotationErrors,
  summarizeCrewJudgeCoverage,
  validateCrewJudgeRotationDrafts,
} from "./judge-rotations"

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

  it("blocks draft rotation replacement when assignments already reference the rotations", () => {
    expect(() =>
      assertCrewJudgeRotationReplacementAllowed({
        assignmentReferenceCount: 1,
      }),
    ).toThrow(
      "These rotations are already attached to judge assignments. Publish a new judge schedule revision instead of replacing draft rotations.",
    )

    expect(() =>
      assertCrewJudgeRotationReplacementAllowed({
        assignmentReferenceCount: 0,
      }),
    ).not.toThrow()
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

import { describe, expect, it } from "vitest"
import { LANE_SHIFT_PATTERN } from "@/db/schemas/volunteers"
import {
  autoFillWorkout,
  fillHeatWithAvailableJudges,
  gridCellsToRotationRows,
  type JudgeGridCell,
  rotationsToGridCells,
} from "@/routes/events/$eventId/-components/judges/judge-grid-utils"

type Rotation = Parameters<typeof rotationsToGridCells>[0][number]
type Heat = Parameters<typeof rotationsToGridCells>[1][number]

function heat(heatNumber: number, laneCount: number): Heat {
  return {
    id: `cheat_${heatNumber}`,
    trackWorkoutId: "tw_1",
    heatNumber,
    scheduledTime: null,
    durationMinutes: null,
    venueName: null,
    laneCount,
    occupiedLanes: [],
  }
}

function rotation(overrides: Partial<Rotation>): Rotation {
  return {
    id: "jrot_1",
    competitionId: "comp_1",
    trackWorkoutId: "tw_1",
    membershipId: "tmem_1",
    startingHeat: 1,
    startingLane: 1,
    heatsCount: 1,
    laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: null,
    ...overrides,
  }
}

describe("rotationsToGridCells", () => {
  // @lat: [[crew#Judge Rotations#Judge Assignments Grid]]
  it("expands a single-heat rotation into one grid cell", () => {
    const cells = rotationsToGridCells(
      [rotation({ startingHeat: 2, startingLane: 3, heatsCount: 1 })],
      [heat(1, 6), heat(2, 6), heat(3, 6)],
    )
    expect(cells).toEqual<JudgeGridCell[]>([
      { membershipId: "tmem_1", heatNumber: 2, laneNumber: 3 },
    ])
  })

  it("expands a multi-heat stay rotation across consecutive heats", () => {
    const cells = rotationsToGridCells(
      [rotation({ startingHeat: 1, startingLane: 2, heatsCount: 3 })],
      [heat(1, 6), heat(2, 6), heat(3, 6)],
    )
    expect(cells).toEqual<JudgeGridCell[]>([
      { membershipId: "tmem_1", heatNumber: 1, laneNumber: 2 },
      { membershipId: "tmem_1", heatNumber: 2, laneNumber: 2 },
      { membershipId: "tmem_1", heatNumber: 3, laneNumber: 2 },
    ])
  })

  it("applies the shift-right lane pattern when expanding", () => {
    const cells = rotationsToGridCells(
      [
        rotation({
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 3,
          laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
        }),
      ],
      [heat(1, 4), heat(2, 4), heat(3, 4)],
    )
    expect(cells.map((cell) => cell.laneNumber)).toEqual([1, 2, 3])
  })
})

describe("gridCellsToRotationRows", () => {
  // @lat: [[crew#Judge Rotations#Judge Assignments Grid]]
  it("converts each grid cell into a one-heat rotation row, sorted", () => {
    const cells: JudgeGridCell[] = [
      { membershipId: "tmem_1", heatNumber: 3, laneNumber: 2 },
      { membershipId: "tmem_1", heatNumber: 1, laneNumber: 5 },
      { membershipId: "tmem_1", heatNumber: 1, laneNumber: 1 },
    ]
    expect(gridCellsToRotationRows(cells)).toEqual([
      { startingHeat: 1, startingLane: 1, heatsCount: 1, notes: null },
      { startingHeat: 1, startingLane: 5, heatsCount: 1, notes: null },
      { startingHeat: 3, startingLane: 2, heatsCount: 1, notes: null },
    ])
  })

  it("round-trips placements through rotations and back to cells", () => {
    const heats = [heat(1, 6), heat(2, 6)]
    const cells: JudgeGridCell[] = [
      { membershipId: "tmem_1", heatNumber: 1, laneNumber: 4 },
      { membershipId: "tmem_1", heatNumber: 2, laneNumber: 1 },
    ]
    const rows = gridCellsToRotationRows(cells)
    const rebuilt = rotationsToGridCells(
      rows.map((row, index) =>
        rotation({
          id: `jrot_${index}`,
          startingHeat: row.startingHeat,
          startingLane: row.startingLane,
          heatsCount: row.heatsCount,
        }),
      ),
      heats,
    )
    expect(rebuilt).toEqual(cells)
  })
})

describe("fillHeatWithAvailableJudges", () => {
  // @lat: [[crew#Judge Rotations#Judge Assignments Grid]]
  it("seats available judges into the heat's open lanes, least-assigned first", () => {
    const result = fillHeatWithAvailableJudges({
      cells: [{ membershipId: "tmem_1", heatNumber: 1, laneNumber: 1 }],
      heat: heat(1, 3),
      judgeOrder: ["tmem_2", "tmem_3", "tmem_4"],
    })
    expect(result.touched).toEqual(["tmem_2", "tmem_3"])
    expect(result.cells).toEqual<JudgeGridCell[]>([
      { membershipId: "tmem_1", heatNumber: 1, laneNumber: 1 },
      { membershipId: "tmem_2", heatNumber: 1, laneNumber: 2 },
      { membershipId: "tmem_3", heatNumber: 1, laneNumber: 3 },
    ])
  })

  it("does not duplicate a judge already in the heat", () => {
    const result = fillHeatWithAvailableJudges({
      cells: [{ membershipId: "tmem_1", heatNumber: 1, laneNumber: 1 }],
      heat: heat(1, 2),
      judgeOrder: ["tmem_1", "tmem_2"],
    })
    expect(result.touched).toEqual(["tmem_2"])
    expect(
      result.cells.filter((cell) => cell.membershipId === "tmem_1"),
    ).toHaveLength(1)
  })

  it("returns no changes when the heat is full", () => {
    const result = fillHeatWithAvailableJudges({
      cells: [
        { membershipId: "tmem_1", heatNumber: 1, laneNumber: 1 },
        { membershipId: "tmem_2", heatNumber: 1, laneNumber: 2 },
      ],
      heat: heat(1, 2),
      judgeOrder: ["tmem_3"],
    })
    expect(result.touched).toEqual([])
  })
})

describe("autoFillWorkout", () => {
  // @lat: [[crew#Judge Rotations#Judge Assignments Grid]]
  it("fills every open lane across all heats", () => {
    const heats = [heat(1, 2), heat(2, 2)]
    const result = autoFillWorkout({
      cells: [],
      heats,
      judgeOrder: ["tmem_1", "tmem_2", "tmem_3"],
    })
    // 2 heats x 2 lanes = 4 open slots, all seated.
    expect(result.cells).toHaveLength(4)
    for (const heatObj of heats) {
      const seated = result.cells.filter(
        (cell) => cell.heatNumber === heatObj.heatNumber,
      )
      expect(seated.map((cell) => cell.laneNumber).sort()).toEqual([1, 2])
    }
  })

  it("preserves existing placements and only fills the gaps", () => {
    const result = autoFillWorkout({
      cells: [{ membershipId: "tmem_9", heatNumber: 1, laneNumber: 1 }],
      heats: [heat(1, 2)],
      judgeOrder: ["tmem_1", "tmem_2"],
    })
    expect(
      result.cells.find(
        (cell) => cell.heatNumber === 1 && cell.laneNumber === 1,
      )?.membershipId,
    ).toBe("tmem_9")
    expect(result.cells).toHaveLength(2)
  })

  it("does not seat the same judge twice in one heat", () => {
    const result = autoFillWorkout({
      cells: [],
      heats: [heat(1, 3)],
      judgeOrder: ["tmem_1"],
    })
    // Only one judge available, so only one lane gets filled.
    expect(result.cells).toHaveLength(1)
    expect(result.touched).toEqual(["tmem_1"])
  })
})

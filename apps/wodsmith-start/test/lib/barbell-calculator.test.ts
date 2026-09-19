import { describe, expect, it } from "vitest"
import {
  calculatePlates,
  calculateWarmupLoad,
  getBarWeight,
  weightFromPounds,
  weightToPounds,
} from "@/lib/barbell-calculator"

describe("barbell load arithmetic", () => {
  // @lat: [[calculators#Calculator Tests#Plate inventory arithmetic]]
  it.each([
    {
      target: 135,
      bar: 45,
      unit: "lb" as const,
      plates: [45],
      loaded: 135,
      difference: 0,
    },
    {
      target: 136,
      bar: 45,
      unit: "lb" as const,
      plates: [45],
      loaded: 135,
      difference: -1,
    },
    {
      target: 20,
      bar: 45,
      unit: "lb" as const,
      plates: [],
      loaded: 45,
      difference: 25,
    },
    {
      target: 0,
      bar: 35,
      unit: "lb" as const,
      plates: [],
      loaded: 35,
      difference: 35,
    },
    {
      target: 135,
      bar: 35,
      unit: "lb" as const,
      plates: [45, 5],
      loaded: 135,
      difference: 0,
    },
    {
      target: 100,
      bar: 20,
      unit: "kg" as const,
      plates: [25, 15],
      loaded: 100,
      difference: 0,
    },
    {
      target: 102.5,
      bar: 20,
      unit: "kg" as const,
      plates: [25, 15, 1.25],
      loaded: 102.5,
      difference: 0,
    },
    {
      target: 101,
      bar: 15,
      unit: "kg" as const,
      plates: [25, 15, 2.5],
      loaded: 100,
      difference: -1,
    },
    {
      target: 10,
      bar: 15,
      unit: "kg" as const,
      plates: [],
      loaded: 15,
      difference: 5,
    },
  ])(
    "accounts for both sides of $target $unit with a $bar bar",
    ({ target, bar, unit, plates, loaded, difference }) => {
      const result = calculatePlates(target, bar, unit)
      expect(result.plates).toEqual(plates)
      expect(result.loadedWeight).toBe(loaded)
      expect(result.loadedWeight).toBe(
        bar + 2 * result.plates.reduce((sum, plate) => sum + plate, 0),
      )
      expect(result.difference).toBe(difference)
      expect(result.belowBar).toBe(target < bar)
    },
  )

  // @lat: [[calculators#Calculator Tests#Conversion precision and standard bars]]
  it("round trips physical targets and uses the selected standard bar inventory", () => {
    expect(weightToPounds(100, "kg")).toBeCloseTo(220.462442, 6)
    expect(weightFromPounds(weightToPounds(102.5, "kg"), "kg")).toBeCloseTo(
      102.5,
      10,
    )
    expect(weightToPounds(135, "lb")).toBe(135)
    expect(weightFromPounds(135, "lb")).toBe(135)
    expect(getBarWeight(45, "kg")).toBe(20)
    expect(getBarWeight(35, "kg")).toBe(15)
    expect(getBarWeight(45, "lb")).toBe(45)
    expect(getBarWeight(35, "lb")).toBe(35)
    expect(calculatePlates(99.999999999, 20, "kg").difference).toBe(0)
    expect(calculatePlates(99.999999999, 20, "kg").loadedWeight).toBe(100)
  })

  // @lat: [[calculators#Calculator Tests#Warm-up rounding arithmetic]]
  it("rounds warm-up requests to paired plate increments and exposes the bare-bar minimum", () => {
    const percentages = [0.4, 0.55, 0.7, 0.8, 0.9]
    expect(
      percentages.map(
        (p) => calculateWarmupLoad(135, p, 45, "lb").loadedWeight,
      ),
    ).toEqual([55, 75, 95, 110, 120])
    expect(
      percentages.map(
        (p) => calculateWarmupLoad(100, p, 20, "kg").loadedWeight,
      ),
    ).toEqual([40, 55, 70, 80, 90])
    expect(calculateWarmupLoad(101, 0.8, 15, "kg").loadedWeight).toBe(80)
    expect(calculateWarmupLoad(135, 0.1, 45, "lb")).toMatchObject({
      requestedWeight: 15,
      loadedWeight: 45,
      difference: 30,
      belowBar: true,
    })
  })
})

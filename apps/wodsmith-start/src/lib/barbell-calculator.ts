export type WeightUnit = "lb" | "kg"
export type BarOption = 45 | 35

export const LB_TO_KG = 0.453592
export const MAX_TARGET_WEIGHT_LB = 10_000
const PLATES = {
  lb: [45, 35, 25, 15, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
}

export function weightFromPounds(weight: number, unit: WeightUnit): number {
  return unit === "kg" ? weight * LB_TO_KG : weight
}

export function weightToPounds(weight: number, unit: WeightUnit): number {
  return unit === "kg" ? weight / LB_TO_KG : weight
}

export function formatWeight(weight: number): string {
  return Number(weight.toFixed(6)).toString()
}

export function getBarWeight(bar: BarOption, unit: WeightUnit): number {
  return unit === "kg" ? (bar === 45 ? 20 : 15) : bar
}

export type BarbellLoad = {
  requestedWeight: number
  barWeight: number
  plates: number[]
  loadedWeight: number
  difference: number
  belowBar: boolean
}

// @lat: [[calculators#Attainable Loads]]
export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  unit: WeightUnit,
): BarbellLoad {
  const plates: number[] = []
  let remaining = Math.max(0, (targetWeight - barWeight) / 2)
  const tolerance = 0.0001

  for (const plate of PLATES[unit]) {
    while (remaining >= plate - tolerance) {
      plates.push(plate)
      remaining -= plate
    }
  }
  const loadedWeight =
    barWeight + 2 * plates.reduce((sum, plate) => sum + plate, 0)
  const difference = loadedWeight - targetWeight
  return {
    requestedWeight: targetWeight,
    barWeight,
    plates,
    loadedWeight,
    difference: Math.abs(difference) < tolerance ? 0 : difference,
    belowBar: targetWeight < barWeight - tolerance,
  }
}

// @lat: [[calculators#Warm-up Rounding]]
export function calculateWarmupLoad(
  targetWeight: number,
  percentage: number,
  barWeight: number,
  unit: WeightUnit,
): BarbellLoad {
  const increment = unit === "kg" ? 2.5 : 5
  const requestedWeight =
    Math.round((targetWeight * percentage) / increment) * increment
  return calculatePlates(requestedWeight, barWeight, unit)
}

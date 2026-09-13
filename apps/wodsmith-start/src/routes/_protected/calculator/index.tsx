import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  type BarbellLoad,
  type BarOption,
  calculatePlates,
  calculateWarmupLoad,
  formatWeight,
  getBarWeight,
  MAX_TARGET_WEIGHT_LB,
  weightFromPounds,
  weightToPounds,
} from "@/lib/barbell-calculator"

// --- Constants ---
const WARMUP_PERCENTAGES = [0.4, 0.55, 0.7, 0.8, 0.9]
const WARMUP_PERCENTAGES_KEY = "wodsmith_warmup_percentages"

// --- Search Schema ---
const calculatorSearchSchema = z.object({
  // Weight stays in pounds in URLs so existing bookmarks retain their load.
  weight: z.number().min(0).max(MAX_TARGET_WEIGHT_LB).optional(),
  units: z.enum(["lb", "kg"]).optional(),
  bar: z.union([z.literal(45), z.literal(35)]).optional(),
})

type CalculatorSearch = z.infer<typeof calculatorSearchSchema>

// --- Helper Functions ---
const getPlateColor = (weight: number, isKg: boolean): string => {
  // Standard Olympic Plate Colors
  if (isKg) {
    switch (weight) {
      case 25:
        return "#FF0000" // Red
      case 20:
        return "#0000FF" // Blue
      case 15:
        return "#FFFF00" // Yellow
      case 10:
        return "#00FF00" // Green
      case 5:
        return "#FFFFFF" // White
      case 2.5:
        return "#000000" // Black
      case 1.25:
        return "#808080" // Grey/Chrome
      default:
        return "#7f8c8d" // Default Grey
    }
  }
  // LB Plates - common gym colors
  switch (weight) {
    case 45:
      return "#0000FF" // Blue
    case 35:
      return "#FFFF00" // Yellow
    case 25:
      return "#00FF00" // Green
    case 15:
      return "#FFA500" // Orange
    case 10:
      return "#FFFFFF" // White
    case 5:
      return "#FF0000" // Red
    case 2.5:
      return "#000000" // Black
    default:
      return "#7f8c8d" // Default Grey
  }
}

const getPlateTextColor = (backgroundColor: string | null): string => {
  if (!backgroundColor) return "#000"
  const hex = backgroundColor.replace("#", "")
  const r = Number.parseInt(hex.substring(0, 2), 16)
  const g = Number.parseInt(hex.substring(2, 4), 16)
  const b = Number.parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#FFFFFF"
}

const getPlateDimensions = (
  weight: number,
): { height: number; width: number } => {
  const baseHeight = 100 // px
  const baseWidth = 18 // px
  const minHeight = baseHeight * 0.4
  const minWidth = baseWidth * 0.5

  if (weight >= 45) return { height: baseHeight, width: baseWidth * 1.5 }
  if (weight >= 35) return { height: baseHeight * 0.95, width: baseWidth * 1.4 }
  if (weight >= 25) return { height: baseHeight * 0.9, width: baseWidth * 1.3 }
  if (weight >= 15) return { height: baseHeight * 0.8, width: baseWidth * 1.2 }
  if (weight >= 10) return { height: baseHeight * 0.7, width: baseWidth * 1.1 }
  if (weight >= 5) return { height: baseHeight * 0.6, width: baseWidth }
  if (weight >= 2.5) return { height: baseHeight * 0.5, width: baseWidth * 0.8 }
  if (weight >= 1.25)
    return { height: baseHeight * 0.4, width: baseWidth * 0.7 }
  return { height: minHeight, width: minWidth }
}

// Helper to load warmup percentages from localStorage
const loadWarmupPercentages = (): number[] => {
  if (typeof window === "undefined") return WARMUP_PERCENTAGES
  try {
    const saved = localStorage.getItem(WARMUP_PERCENTAGES_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (
        Array.isArray(parsed) &&
        parsed.every((p) => typeof p === "number" && p >= 0 && p <= 1) &&
        parsed.length === WARMUP_PERCENTAGES.length
      ) {
        return parsed
      }
    }
  } catch {
    // Fall through to default
  }
  return WARMUP_PERCENTAGES
}

// Helper to save warmup percentages to localStorage
const saveWarmupPercentages = (percentages: number[]): void => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(WARMUP_PERCENTAGES_KEY, JSON.stringify(percentages))
  } catch {
    // Ignore storage errors
  }
}

// --- React Components ---

const Plate = ({ weight, isKg }: { weight: number; isKg: boolean }) => {
  const { height, width } = getPlateDimensions(weight)
  const color = getPlateColor(weight, isKg)
  const textColor = getPlateTextColor(color)

  return (
    <div
      className="mx-px flex items-center justify-center border-2 border-black text-center font-bold text-xs"
      style={{
        height: `${height}px`,
        width: `${width}px`,
        backgroundColor: color,
        color: textColor,
      }}
    >
      {weight}
    </div>
  )
}

const BarbellGraphic = ({
  plates,
  isKg,
}: {
  plates: number[]
  isKg: boolean
}) => {
  return (
    <div className="relative mx-auto my-5 flex min-h-[150px] w-full max-w-[30rem] items-center justify-center overflow-x-auto border-3 border-black p-5">
      {/* Left Collar */}
      <div
        className="z-10 mr-0.5 w-2.5 rounded-sm border border-neutral-800 bg-neutral-600"
        style={{
          height: `${getPlateDimensions(isKg ? 2.5 : 5).height * 0.3}px`,
        }}
      />
      <div className="flex flex-row-reverse items-center">
        {plates.map((plate: number, index: number) => (
          <Plate key={`left-${index}-${plate}`} weight={plate} isKg={isKg} />
        ))}
      </div>
      {/* Bar */}
      <div className="relative z-0 h-3 min-w-[50px] max-w-[600px] flex-grow border-neutral-500 border-r-5 border-l-5 bg-neutral-400" />
      <div className="flex items-center">
        {plates.map((plate: number, index: number) => (
          <Plate key={`right-${index}-${plate}`} weight={plate} isKg={isKg} />
        ))}
      </div>
      {/* Right Collar */}
      <div
        className="z-10 ml-0.5 w-2.5 rounded-sm border border-neutral-800 bg-neutral-600"
        style={{
          height: `${getPlateDimensions(isKg ? 2.5 : 5).height * 0.3}px`,
        }}
      />
    </div>
  )
}

const LoadDifference = ({
  load,
  unit,
}: {
  load: BarbellLoad
  unit: string
}) => {
  if (load.difference === 0) return null
  return (
    <p className="my-2 text-sm text-black dark:text-black">
      {load.belowBar
        ? `Target is below the ${formatWeight(load.barWeight)} ${unit} bar. `
        : "Available plates cannot match this target exactly. "}
      {formatWeight(Math.abs(load.difference))} {unit}{" "}
      {load.difference > 0 ? "above" : "below"} requested{" "}
      {formatWeight(load.requestedWeight)} {unit}.
    </p>
  )
}

const WarmupSet = ({
  setNumber,
  load,
  unit,
  isKg,
  percentage,
  onPercentageChange,
}: {
  setNumber: number
  load: BarbellLoad
  unit: string
  isKg: boolean
  percentage: number
  onPercentageChange: (newPercentage: number) => void
}) => (
  <div className="mb-2.5 border-2 border-black p-3.5 ">
    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
      <h4 className="mt-0 border-black border-b pb-1.25 text-black text-lg dark:text-black">
        Set {setNumber}: {load.loadedWeight.toFixed(1)} {unit}
      </h4>
      <div className="flex items-center gap-2">
        <span className="text-neutral-600 text-sm">
          ({(percentage * 100).toFixed(0)}%)
        </span>
        <Input
          type="number"
          value={(percentage * 100).toFixed(0)}
          aria-label={`Percentage for Set ${setNumber}`}
          onChange={(e) => {
            const newPerc = Number.parseInt(e.target.value, 10) / 100
            if (!Number.isNaN(newPerc) && newPerc >= 0 && newPerc <= 1) {
              onPercentageChange(newPerc)
            }
          }}
          min="0"
          max="100"
          step="1"
          className="w-20"
        />
      </div>
    </div>
    <LoadDifference load={load} unit={unit} />
    <p className="mb-1 text-sm">Plates per side:</p>
    <div className="flex flex-wrap items-center gap-1.25">
      {load.plates.length > 0 ? (
        load.plates.map((p: number, i: number) => (
          <span
            key={`warmup-plate-${setNumber}-${i}-${p}`}
            className="rounded-sm border border-black px-2 py-0.5 font-bold text-sm"
            style={{
              backgroundColor: getPlateColor(p, isKg),
              color: getPlateTextColor(getPlateColor(p, isKg)),
            }}
          >
            {p}
          </span>
        ))
      ) : (
        <span className="italic">Just the bar!</span>
      )}
    </div>
  </div>
)

export const Route = createFileRoute("/_protected/calculator/")({
  component: BarbellCalculatorPage,
  beforeLoad: async ({ context }) => {
    // @lat: [[architecture#Route Groups#_protected#Workout tracking guards]]
    if (!context.hasWorkoutTracking) {
      throw redirect({ to: "/" })
    }
  },
  validateSearch: (search: Record<string, unknown>): CalculatorSearch => {
    return calculatorSearchSchema.parse(search)
  },
})

function BarbellCalculatorPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  // Apply defaults for search params
  const targetWeightQuery = search.weight ?? 135
  const units = search.units ?? "lb"
  const barWeightOption = search.bar ?? 45

  // Local state for the input field
  const [inputWeight, setInputWeight] = useState<string>(
    formatWeight(weightFromPounds(targetWeightQuery, units)),
  )

  // State for warmup percentages - initialized from localStorage or defaults
  const [warmupPercentages, setWarmupPercentages] =
    useState<number[]>(WARMUP_PERCENTAGES)

  // Load warmup percentages on mount (client-side only)
  useEffect(() => {
    setWarmupPercentages(loadWarmupPercentages())
  }, [])

  const isKg = units === "kg"
  const actualBarWeight = getBarWeight(barWeightOption, units)
  const targetWeight = weightFromPounds(targetWeightQuery, units)

  const load = useMemo(
    () => calculatePlates(targetWeight, actualBarWeight, units),
    [targetWeight, actualBarWeight, units],
  )

  const warmupSets = useMemo(
    () =>
      warmupPercentages.map((percentage, index) => ({
        setNumber: index + 1,
        load: calculateWarmupLoad(
          targetWeight,
          percentage,
          actualBarWeight,
          units,
        ),
        percentage,
      })),
    [targetWeight, actualBarWeight, units, warmupPercentages],
  )

  const handleWeightSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const newWeight = weightToPounds(Number(inputWeight), units)
    if (
      inputWeight.trim() !== "" &&
      Number.isFinite(newWeight) &&
      newWeight >= 0 &&
      newWeight <= MAX_TARGET_WEIGHT_LB
    ) {
      navigate({
        search: (prev) => ({ ...prev, weight: newWeight }),
      })
    } else {
      setInputWeight(formatWeight(targetWeight))
    }
  }

  const handleUnitsChange = (newUnits: "lb" | "kg") => {
    // Preserve a valid draft when changing units, including before Calculate.
    const draftWeight = weightToPounds(Number(inputWeight), units)
    const weight =
      inputWeight === formatWeight(targetWeight) ||
      inputWeight.trim() === "" ||
      !Number.isFinite(draftWeight) ||
      draftWeight < 0 ||
      draftWeight > MAX_TARGET_WEIGHT_LB
        ? targetWeightQuery
        : draftWeight
    navigate({
      search: (prev) => ({ ...prev, weight, units: newUnits }),
    })
  }

  const handleBarChange = (newBar: BarOption) => {
    navigate({
      search: (prev) => ({ ...prev, bar: newBar }),
    })
  }

  const handlePercentageChange = (setIndex: number, newPercentage: number) => {
    const newPercentages = [...warmupPercentages]
    newPercentages[setIndex] = newPercentage
    setWarmupPercentages(newPercentages)
    saveWarmupPercentages(newPercentages)
  }

  // Update input field if query param changes (e.g. back button)
  useEffect(() => {
    setInputWeight(formatWeight(targetWeight))
  }, [targetWeight])

  return (
    <div className="mx-auto max-w-2xl border-4 border-black bg-white font-mono shadow-[8px_8px_0px_#000]">
      <h1 className="mb-5 border-black border-b-3 pb-2.5 text-center text-4xl text-black tracking-wider dark:text-black">
        BARBELL CALCULATOR
      </h1>

      <form
        onSubmit={handleWeightSubmit}
        className="mb-6 grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3.5 border-3 border-black p-3.5 "
      >
        <div className="flex flex-col">
          <Label htmlFor="weightInput">
            Target weight ({units.toUpperCase()})
          </Label>
          <Input
            id="weightInput"
            type="number"
            value={inputWeight}
            onChange={(e) => setInputWeight(e.target.value)}
            required
            min="0"
            max={weightFromPounds(MAX_TARGET_WEIGHT_LB, units)}
            step="any"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium">Units</legend>
            <div className="flex gap-2.5 border-2 border-black bg-white p-2">
              {(["lb", "kg"] as const).map((unit) => (
                <label
                  key={unit}
                  className="flex cursor-pointer items-center gap-2 border-2 border-black px-2.5 py-1 text-black has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
                >
                  <input
                    type="radio"
                    name="units"
                    value={unit}
                    checked={units === unit}
                    onChange={() => handleUnitsChange(unit)}
                    className="size-4 accent-black"
                  />
                  {unit.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium">Bar</legend>
            <div className="flex gap-2.5 border-2 border-black bg-white p-2">
              {([45, 35] as const).map((bar) => (
                <label
                  key={bar}
                  className="flex cursor-pointer items-center gap-2 border-2 border-black px-2.5 py-1 text-black has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
                >
                  <input
                    type="radio"
                    name="bar"
                    value={bar}
                    checked={barWeightOption === bar}
                    onChange={() => handleBarChange(bar)}
                    className="size-4 accent-black"
                  />
                  {getBarWeight(bar, units)} {units}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <Button type="submit">Calculate</Button>
      </form>

      <div className="mb-5 border-3 border-black p-3.5 text-center font-bold text-4xl text-black dark:text-black">
        <p className="mb-1 text-sm">Loaded weight</p>
        <output aria-label="Loaded weight">
          {load.loadedWeight.toFixed(1)}{" "}
          <small className="ml-1.25 align-middle text-[0.4em]">
            {units.toUpperCase()}
          </small>
        </output>
        <LoadDifference load={load} unit={units} />
        <p className="mt-2 text-sm font-normal">
          {actualBarWeight} {units} bar + plates on both sides
        </p>
      </div>

      <BarbellGraphic plates={load.plates} isKg={isKg} />

      <div className="mt-6 border-3 border-black p-3.5">
        <h3 className="mb-3.5 border-black border-b-2 pb-2 text-center text-black text-xl dark:text-black">
          WARM-UP PROTOCOL
        </h3>
        {warmupSets.map((set) => (
          <WarmupSet
            key={set.setNumber}
            setNumber={set.setNumber}
            load={set.load}
            unit={units}
            isKg={isKg}
            percentage={set.percentage}
            onPercentageChange={(newPerc) =>
              handlePercentageChange(set.setNumber - 1, newPerc)
            }
          />
        ))}
      </div>
      <div className="mt-5 border-neutral-500 border-t pt-2.5 text-center text-neutral-500 text-xs">
        WODsmith - Barbell Calculator
      </div>
    </div>
  )
}

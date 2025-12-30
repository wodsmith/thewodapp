import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// --- Constants ---
const LB_PLATES_FULL = [45, 35, 25, 15, 10, 5, 2.5]
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] // Standard KG plates
const WARMUP_PERCENTAGES = [0.4, 0.55, 0.7, 0.8, 0.9]
const LB_TO_KG = 0.453592
const WARMUP_PERCENTAGES_KEY = "wodsmith_warmup_percentages"

// --- Search Schema ---
const calculatorSearchSchema = z.object({
	weight: z.number().int().min(0).optional(),
	units: z.enum(["lb", "kg"]).optional(),
	bar: z.number().int().optional(),
})

type CalculatorSearch = z.infer<typeof calculatorSearchSchema>

// --- Helper Functions ---
const roundToNearestIncrement = (weight: number, increment: number): number => {
	return Math.round(weight / increment) * increment
}

const calculatePlates = (
	targetWeight: number,
	barWeight: number,
	availablePlates: number[],
): number[] => {
	if (targetWeight <= barWeight) {
		return []
	}
	const weightPerSide = (targetWeight - barWeight) / 2
	const platesOnSide = []
	let remaining = weightPerSide

	// Small tolerance for floating point issues
	const tolerance = 0.0001

	for (const plate of availablePlates) {
		while (remaining >= plate - tolerance) {
			platesOnSide.push(plate)
			remaining -= plate
		}
	}
	return platesOnSide
}

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

const WarmupSet = ({
	setNumber,
	weight,
	plates,
	unit,
	isKg,
	percentage,
	onPercentageChange,
}: {
	setNumber: number
	weight: number
	plates: number[]
	unit: string
	isKg: boolean
	percentage: number
	onPercentageChange: (newPercentage: number) => void
}) => (
	<div className="mb-2.5 border-2 border-black p-3.5 ">
		<div className="mb-2.5 flex items-center justify-between">
			<h4 className="mt-0 border-black border-b pb-1.25 text-black text-lg dark:text-black">
				Set {setNumber}: {weight.toFixed(1)}
				{unit}
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
		<div className="flex flex-wrap items-center gap-1.25">
			{plates.length > 0 ? (
				plates.map((p: number, i: number) => (
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
		targetWeightQuery.toString(),
	)

	// State for warmup percentages - initialized from localStorage or defaults
	const [warmupPercentages, setWarmupPercentages] =
		useState<number[]>(WARMUP_PERCENTAGES)

	// Load warmup percentages on mount (client-side only)
	useEffect(() => {
		setWarmupPercentages(loadWarmupPercentages())
	}, [])

	const isKg = units === "kg"
	const actualBarWeight = isKg
		? roundToNearestIncrement(barWeightOption * LB_TO_KG, 1.25)
		: barWeightOption
	const availablePlates = isKg ? KG_PLATES : LB_PLATES_FULL
	const displayUnit = isKg ? "kg" : "lb"

	const effectiveTargetWeightForCalc = isKg
		? roundToNearestIncrement(targetWeightQuery * LB_TO_KG, 2.5)
		: targetWeightQuery

	const platesPerSide = useMemo(() => {
		return calculatePlates(
			effectiveTargetWeightForCalc,
			actualBarWeight,
			availablePlates,
		)
	}, [effectiveTargetWeightForCalc, actualBarWeight, availablePlates])

	const warmupSets = useMemo(() => {
		const baseTargetLb = targetWeightQuery
		const barWeightLb = barWeightOption

		return warmupPercentages.map((perc, index) => {
			let warmupWeightLb = roundToNearestIncrement(baseTargetLb * perc, 5)
			if (warmupWeightLb < barWeightLb) warmupWeightLb = barWeightLb

			let displayWarmupWeight: number
			let platesForWarmup: number[]
			let barForWarmupCalc: number

			if (isKg) {
				displayWarmupWeight = roundToNearestIncrement(
					warmupWeightLb * LB_TO_KG,
					1.25,
				)
				barForWarmupCalc = roundToNearestIncrement(barWeightLb * LB_TO_KG, 1.25)
				platesForWarmup = calculatePlates(
					displayWarmupWeight,
					barForWarmupCalc,
					KG_PLATES,
				)
			} else {
				displayWarmupWeight = warmupWeightLb
				barForWarmupCalc = barWeightLb
				platesForWarmup = calculatePlates(
					displayWarmupWeight,
					barForWarmupCalc,
					LB_PLATES_FULL,
				)
			}

			return {
				setNumber: index + 1,
				weight: displayWarmupWeight,
				plates: platesForWarmup,
				percentage: perc,
			}
		})
	}, [targetWeightQuery, barWeightOption, isKg, warmupPercentages])

	const handleWeightSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const newWeight = Number.parseInt(inputWeight, 10)
		if (!Number.isNaN(newWeight) && newWeight > 0) {
			navigate({
				search: (prev) => ({ ...prev, weight: newWeight }),
			})
		} else {
			setInputWeight(targetWeightQuery.toString())
		}
	}

	const handleUnitsChange = (newUnits: "lb" | "kg") => {
		navigate({
			search: (prev) => ({ ...prev, units: newUnits }),
		})
	}

	const handleBarChange = (newBar: number) => {
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
		setInputWeight(targetWeightQuery.toString())
	}, [targetWeightQuery])

	return (
		<div className="mx-auto max-w-2xl border-4 border-black bg-white font-mono shadow-[8px_8px_0px_#000]">
			<h1 className="mb-5 border-black border-b-3 pb-2.5 text-center text-4xl text-black tracking-wider dark:text-black">
				BARBELL CALCULATOR
			</h1>

			<form
				onSubmit={handleWeightSubmit}
				className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3.5 border-3 border-black p-3.5 "
			>
				<div className="flex flex-col">
					<Label htmlFor="weightInput">TARGET WEIGHT:</Label>
					<Input
						id="weightInput"
						type="number"
						value={inputWeight}
						onChange={(e) => setInputWeight(e.target.value)}
						required
						min="0"
					/>
				</div>
				<div className="flex flex-row gap-4">
					<div className="flex h-full flex-col">
						<Label htmlFor="units-lb">UNITS:</Label>
						<div className="flex h-full items-center justify-center gap-2.5 rounded-none border-2 border-black bg-white p-2">
							<Label
								className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
									units === "lb" ? "bg-black text-white dark:text-white" : ""
								}`}
								htmlFor="units-lb"
							>
								<Input
									id="units-lb"
									type="radio"
									name="units"
									value="lb"
									checked={units === "lb"}
									onChange={() => handleUnitsChange("lb")}
									className="hidden"
								/>
								LB
							</Label>
							<Label
								className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
									units === "kg" ? "bg-black text-white dark:text-white" : ""
								}`}
								htmlFor="units-kg"
							>
								<Input
									id="units-kg"
									type="radio"
									name="units"
									value="kg"
									checked={units === "kg"}
									onChange={() => handleUnitsChange("kg")}
									className="hidden"
								/>
								KG
							</Label>
						</div>
					</div>

					<div className="flex w-full flex-col">
						<Label htmlFor="bar-45">BAR (LB):</Label>
						<div className="flex gap-2.5 rounded-none border-2 border-black bg-white p-2">
							<Label
								className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
									barWeightOption === 45 ? "bg-black text-black" : ""
								}`}
								htmlFor="bar-45"
							>
								<Input
									id="bar-45"
									type="radio"
									name="bar"
									value={45}
									checked={barWeightOption === 45}
									onChange={() => handleBarChange(45)}
									className="hidden"
								/>
								45 lb
							</Label>
							<Label
								className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
									barWeightOption === 35 ? "bg-black text-black" : ""
								}`}
								htmlFor="bar-35"
							>
								<Input
									id="bar-35"
									type="radio"
									name="bar"
									value={35}
									checked={barWeightOption === 35}
									onChange={() => handleBarChange(35)}
									className="hidden"
								/>
								35 lb
							</Label>
						</div>
					</div>
				</div>

				<Button type="submit">Calculate</Button>
			</form>

			<div className="mb-5 border-3 border-black p-3.5 text-center font-bold text-4xl text-black dark:text-black">
				{effectiveTargetWeightForCalc.toFixed(1)}
				<small className="ml-1.25 align-middle text-[0.4em]">
					{displayUnit.toUpperCase()}
				</small>
			</div>

			<BarbellGraphic plates={platesPerSide} isKg={isKg} />

			<div className="mt-6 border-3 border-black p-3.5">
				<h3 className="mb-3.5 border-black border-b-2 pb-2 text-center text-black text-xl dark:text-black">
					WARM-UP PROTOCOL
				</h3>
				{warmupSets.map((set) => (
					<WarmupSet
						key={set.setNumber}
						setNumber={set.setNumber}
						weight={set.weight}
						plates={set.plates}
						unit={displayUnit}
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

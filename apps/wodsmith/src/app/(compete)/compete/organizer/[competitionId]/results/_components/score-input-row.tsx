"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
	parseScore,
	type ParseResult,
} from "@/utils/score-parser"
import type {
	WorkoutScheme,
	TiebreakScheme,
	SecondaryScheme,
	ScoreStatus,
} from "@/db/schema"
import type { EventScoreEntryAthlete } from "@/server/competition-scores"

// Helper to get placeholder text for secondary scheme input
function getSecondaryPlaceholder(scheme: SecondaryScheme | null): string {
	switch (scheme) {
		case "rounds-reps":
			return "e.g., 5+12"
		case "reps":
			return "e.g., 150"
		case "calories":
			return "e.g., 200"
		case "meters":
			return "e.g., 5000"
		case "load":
			return "e.g., 225"
		case "points":
			return "e.g., 100"
		default:
			return "Enter score..."
	}
}

export interface ScoreEntryData {
	score: string
	scoreStatus: ScoreStatus
	tieBreakScore: string | null
	secondaryScore: string | null
	formattedScore: string
}

interface ScoreInputRowProps {
	athlete: EventScoreEntryAthlete
	workoutScheme: WorkoutScheme
	tiebreakScheme: TiebreakScheme | null
	secondaryScheme: SecondaryScheme | null
	showTiebreak?: boolean
	timeCap?: number
	value?: ScoreEntryData
	isSaving?: boolean
	isSaved?: boolean
	onChange: (data: ScoreEntryData) => void
	onTabNext: () => void
	autoFocus?: boolean
}

export function ScoreInputRow({
	athlete,
	workoutScheme,
	tiebreakScheme,
	secondaryScheme,
	showTiebreak = false,
	timeCap,
	value,
	isSaving,
	isSaved,
	onChange,
	onTabNext,
	autoFocus,
}: ScoreInputRowProps) {
	const [inputValue, setInputValue] = useState(
		value?.score || athlete.existingResult?.wodScore || "",
	)
	const [tieBreakValue, setTieBreakValue] = useState(
		value?.tieBreakScore || athlete.existingResult?.tieBreakScore || "",
	)
	const [secondaryValue, setSecondaryValue] = useState(
		value?.secondaryScore || athlete.existingResult?.secondaryScore || "",
	)
	const [showWarning, setShowWarning] = useState(false)
	const [parseResult, setParseResult] = useState<ParseResult | null>(() => {
		const initialScore = value?.score || athlete.existingResult?.wodScore || ""
		if (initialScore.trim()) {
			return parseScore(initialScore, workoutScheme, timeCap, tiebreakScheme)
		}
		return null
	})

	const scoreInputRef = useRef<HTMLInputElement>(null)
	const tieBreakInputRef = useRef<HTMLInputElement>(null)
	const secondaryInputRef = useRef<HTMLInputElement>(null)

	// Check if this is a time-capped workout and user entered CAP
	const isTimeCapped = workoutScheme === "time-with-cap"
	const isCapped = parseResult?.scoreStatus === "cap" || inputValue.toUpperCase() === "CAP"
	const showSecondaryInput = isTimeCapped && isCapped && secondaryScheme

	// Auto-focus on mount
	useEffect(() => {
		if (autoFocus) {
			scoreInputRef.current?.focus()
		}
	}, [autoFocus])

	// Parse input as user types
	const handleInputChange = (newValue: string) => {
		setInputValue(newValue)

		if (!newValue.trim()) {
			setParseResult(null)
			return
		}

		const result = parseScore(newValue, workoutScheme, timeCap, tiebreakScheme)
		setParseResult(result)

		// Only show blocking warning popup for invalid scores
		// Valid scores with warnings (like time > cap) show inline message only
		if (result.error && !result.isValid) {
			setShowWarning(true)
		}
	}

	// Submit the score
	const submitScore = (force = false) => {
		if (!force && !parseResult?.isValid) return

		const existing = athlete.existingResult
		const newScoreStatus = parseResult?.scoreStatus || "scored"
		const newTieBreak = tieBreakValue || null
		const newSecondary = showSecondaryInput ? secondaryValue || null : null

		// Don't save if nothing has changed
		if (
			existing &&
			inputValue === (existing.wodScore || "") &&
			newScoreStatus === (existing.scoreStatus || "scored") &&
			newTieBreak === (existing.tieBreakScore || null) &&
			newSecondary === (existing.secondaryScore || null)
		) {
			return
		}

		onChange({
			score: inputValue,
			scoreStatus: newScoreStatus,
			tieBreakScore: newTieBreak,
			secondaryScore: newSecondary,
			formattedScore: parseResult?.formatted || inputValue,
		})
	}

	// Handle blur - save when user leaves the field
	const handleBlur = (_field: "score" | "tieBreak" | "secondary") => {
		// Don't save if moving to another field in this row
		setTimeout(() => {
			const activeEl = document.activeElement
			const isMovingToRelatedField =
				activeEl === scoreInputRef.current ||
				activeEl === tieBreakInputRef.current ||
				activeEl === secondaryInputRef.current

			if (!isMovingToRelatedField) {
				submitScore()
			}
		}, 0)
	}

	// Handle keyboard navigation
	const handleKeyDown = (
		e: KeyboardEvent<HTMLInputElement>,
		field: "score" | "tieBreak" | "secondary",
	) => {
		if (e.key === "Tab" && !e.shiftKey) {
			e.preventDefault()

			if (field === "score") {
				// If secondary input needed (CAP entered), go there first
				if (showSecondaryInput && !secondaryValue) {
					secondaryInputRef.current?.focus()
				} else if (showTiebreak && !tieBreakValue) {
					// If tie-break exists and not filled, go there
					tieBreakInputRef.current?.focus()
				} else {
					// Submit and move to next row
					submitScore()
					onTabNext()
				}
			} else if (field === "secondary") {
				// From secondary, go to tiebreak if exists, else next row
				if (showTiebreak && !tieBreakValue) {
					tieBreakInputRef.current?.focus()
				} else {
					submitScore()
					onTabNext()
				}
			} else {
				// From tie-break, submit and move to next row
				submitScore()
				onTabNext()
			}
		}

		if (e.key === "Enter") {
			e.preventDefault()

			if (showWarning) {
				// Dismiss warning and force submit
				setShowWarning(false)
				submitScore(true)
				onTabNext()
			} else if (parseResult?.isValid) {
				submitScore()
				onTabNext()
			}
		}
	}

	// Handle warning confirmation
	const handleConfirmWarning = () => {
		setShowWarning(false)
		submitScore(true) // Force save even if invalid
		onTabNext()
	}

	// Determine status display
	const hasExistingResult = !!athlete.existingResult
	// Invalid scores get blocking warning (yellow)
	const isInvalidWarning = showWarning || (parseResult?.error && !parseResult?.isValid)
	// Valid scores with warnings (like time > cap) get amber styling
	const hasWarning = parseResult?.error && parseResult?.isValid

	return (
		<div
			className={cn(
				"grid items-center gap-3 border-b p-3 transition-colors",
				showTiebreak ? "grid-cols-[60px_1fr_2fr_1fr_100px]" : "grid-cols-[60px_1fr_2fr_100px]",
				isInvalidWarning && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300",
				hasWarning && !isInvalidWarning && "bg-amber-50 dark:bg-amber-950/20 border-amber-300",
				isSaved && !isInvalidWarning && !hasWarning && "bg-green-50 dark:bg-green-950/20",
			)}
		>
			{/* Lane / Index */}
			<div className="text-center font-semibold text-muted-foreground">
				{/* No lanes in MVP - just show dash */}
				-
			</div>

			{/* Athlete Name */}
			<div className="min-w-0">
				<div className="truncate font-medium">
					{athlete.lastName}, {athlete.firstName}
				</div>
				<Badge variant="outline" className="mt-1 text-xs">
					{athlete.divisionLabel}
				</Badge>
			</div>

			{/* Score Input */}
			<div className="space-y-2">
				<div className="relative">
					<Input
						ref={scoreInputRef}
						value={inputValue}
						onChange={(e) => handleInputChange(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "score")}
						onBlur={() => handleBlur("score")}
						placeholder="Enter score..."
						className={cn(
							"h-10 text-base font-mono",
							isInvalidWarning && "border-yellow-400 focus:ring-yellow-400",
							hasWarning && !isInvalidWarning && "border-amber-400 focus:ring-amber-400",
						)}
					/>
					{parseResult?.isValid && !showSecondaryInput && (
						<div className="mt-1 text-xs text-muted-foreground">
							Preview: {parseResult.formatted}
						</div>
					)}
					{parseResult?.error && (
						<div className="mt-1 text-xs text-destructive">
							{parseResult.error}
						</div>
					)}
				</div>

				{/* Secondary Score Input (for time-capped workouts when CAP) */}
				{showSecondaryInput && (
					<div className="relative">
						<Input
							ref={secondaryInputRef}
							value={secondaryValue}
							onChange={(e) => setSecondaryValue(e.target.value)}
							onKeyDown={(e) => handleKeyDown(e, "secondary")}
							onBlur={() => handleBlur("secondary")}
							placeholder={getSecondaryPlaceholder(secondaryScheme)}
							className="h-10 text-base font-mono"
						/>
						<div className="mt-1 text-xs text-muted-foreground">
							Enter {secondaryScheme?.replace("-", " + ")} achieved at cap
						</div>
					</div>
				)}

				{/* Warning Message (only for invalid scores) */}
				{isInvalidWarning && parseResult?.error && (
					<div className="flex items-start gap-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 p-2 text-sm">
						<AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
						<div className="flex-1">
							<p className="font-medium text-yellow-800 dark:text-yellow-200">
								{parseResult.error}
							</p>
							<div className="mt-2 flex gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={handleConfirmWarning}
								>
									Save Anyway
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setShowWarning(false)
										scoreInputRef.current?.focus()
									}}
								>
									Edit
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Tie-Break Input */}
			{showTiebreak && (
				<div>
					<Input
						ref={tieBreakInputRef}
						value={tieBreakValue}
						onChange={(e) => setTieBreakValue(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "tieBreak")}
						onBlur={() => handleBlur("tieBreak")}
						placeholder={
							tiebreakScheme === "time" ? "Time..." : "Reps..."
						}
						className="h-10 text-base font-mono"
					/>
				</div>
			)}

			{/* Status */}
			<div className="text-center">
				{isSaving ? (
					<div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span className="hidden sm:inline">Saving...</span>
					</div>
				) : isSaved || hasExistingResult ? (
					<div className="flex items-center justify-center gap-1.5 text-sm text-green-600">
						<Check className="h-4 w-4" />
						<span className="hidden sm:inline">Saved</span>
					</div>
				) : inputValue ? (
					<span className="text-sm text-muted-foreground">Pending</span>
				) : (
					<span className="text-sm text-muted-foreground">-</span>
				)}
			</div>
		</div>
	)
}

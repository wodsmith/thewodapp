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
	/** Parsed numeric value (seconds for time, reps for AMRAP, etc.) */
	rawValue?: number | null
	// Multi-round support: array of scores when roundsToScore > 1
	roundScores?: Array<{
		score: string
		// For rounds+reps format: [rounds, reps]
		parts?: [string, string]
	}>
}

interface ScoreInputRowProps {
	athlete: EventScoreEntryAthlete
	workoutScheme: WorkoutScheme
	tiebreakScheme: TiebreakScheme | null
	secondaryScheme: SecondaryScheme | null
	showTiebreak?: boolean
	timeCap?: number
	/** Number of rounds to score (default 1) */
	roundsToScore?: number
	/** Reps per round - enables rounds+reps split input */
	repsPerRound?: number | null
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
	roundsToScore = 1,
	repsPerRound,
	value,
	isSaving,
	isSaved,
	onChange,
	onTabNext,
	autoFocus,
}: ScoreInputRowProps) {
	const numRounds = roundsToScore || 1
	const isPassFail = workoutScheme === "pass-fail"
	const isRoundsReps = workoutScheme === "rounds-reps" || !!repsPerRound
	const isTimeCapped = workoutScheme === "time-with-cap"
	const isMultiRound = numRounds > 1

	// Initialize round scores state
	const initializeRoundScores = (): Array<{ score: string; parts?: [string, string]; timeCapped?: boolean }> => {
		if (value?.roundScores && value.roundScores.length === numRounds) {
			return value.roundScores.map((rs) => ({
				score: rs.score,
				parts: rs.parts,
				timeCapped: false,
			}))
		}
		// Use existing sets data for multi-round or single-round rounds+reps
		const existingSets = athlete.existingResult?.sets
		if (existingSets && existingSets.length > 0 && (isMultiRound || isRoundsReps)) {
			return Array(numRounds).fill(null).map((_, index) => {
				const set = existingSets.find((s) => s.setNumber === index + 1)
				if (set) {
					// For rounds+reps format, score contains rounds and reps contains reps
					if (isRoundsReps && set.reps !== null) {
						return {
							score: set.score !== null ? `${set.score}+${set.reps}` : "",
							parts: [
								set.score !== null ? String(set.score) : "",
								set.reps !== null ? String(set.reps) : "",
							] as [string, string],
							timeCapped: false,
						}
					}
					return {
						score: set.score !== null ? String(set.score) : "",
						parts: undefined,
						timeCapped: false,
					}
				}
				return {
					score: "",
					parts: isRoundsReps ? ["", ""] as [string, string] : undefined,
					timeCapped: false,
				}
			})
		}
		// Fallback: Try to parse existing result wodScore as JSON (legacy format)
		const existingScore = athlete.existingResult?.wodScore
		if (existingScore && isMultiRound) {
			try {
				const parsed = JSON.parse(existingScore)
				if (Array.isArray(parsed) && parsed.length === numRounds) {
					return parsed.map((s: string | { score: string; parts?: [string, string] }) => {
						if (typeof s === "string") {
							return { score: s, parts: undefined, timeCapped: false }
						}
						return { score: s.score, parts: s.parts, timeCapped: false }
					})
				}
			} catch {
				// Not JSON, fall through to default
			}
		}
		return Array(numRounds).fill(null).map(() => ({
			score: "",
			parts: isRoundsReps ? ["", ""] as [string, string] : undefined,
			timeCapped: false,
		}))
	}

	const [roundScores, setRoundScores] = useState(initializeRoundScores)
	const [inputValue, setInputValue] = useState(
		value?.score || (isMultiRound ? "" : athlete.existingResult?.wodScore || ""),
	)
	const [tieBreakValue, setTieBreakValue] = useState(
		value?.tieBreakScore || athlete.existingResult?.tieBreakScore || "",
	)
	const [secondaryValue, setSecondaryValue] = useState(
		value?.secondaryScore || athlete.existingResult?.secondaryScore || "",
	)
	const [showWarning, setShowWarning] = useState(false)
	const [parseResult, setParseResult] = useState<ParseResult | null>(() => {
		if (isMultiRound || isPassFail) return null
		const initialScore = value?.score || athlete.existingResult?.wodScore || ""
		if (initialScore.trim()) {
			return parseScore(initialScore, workoutScheme, timeCap, tiebreakScheme)
		}
		return null
	})

	const scoreInputRef = useRef<HTMLInputElement>(null)
	const roundInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
	const tieBreakInputRef = useRef<HTMLInputElement>(null)
	const secondaryInputRef = useRef<HTMLInputElement>(null)

	// Check if CAP was entered (for single-round time-capped workouts)
	const isCapped = parseResult?.scoreStatus === "cap" || inputValue.toUpperCase() === "CAP"
	const showSecondaryInput = isTimeCapped && isCapped && secondaryScheme && !isMultiRound

	// Auto-focus on mount
	useEffect(() => {
		if (autoFocus) {
			if (isMultiRound) {
				roundInputRefs.current.get(0)?.focus()
			} else {
				scoreInputRef.current?.focus()
			}
		}
	}, [autoFocus, isMultiRound])

	// Parse input as user types (for single-round non-pass-fail)
	const handleInputChange = (newValue: string) => {
		setInputValue(newValue)

		if (!newValue.trim()) {
			setParseResult(null)
			return
		}

		const result = parseScore(newValue, workoutScheme, timeCap, tiebreakScheme)
		setParseResult(result)

		if (result.error && !result.isValid) {
			setShowWarning(true)
		}
	}

	// Handle round score change (for multi-round)
	const handleRoundScoreChange = (roundIndex: number, newValue: string, partIndex?: number) => {
		setRoundScores((prev) => {
			const updated = [...prev]
			const currentRound = updated[roundIndex]
			if (!currentRound) return prev

			if (partIndex !== undefined && currentRound.parts) {
				const newParts: [string, string] = [...currentRound.parts]
				newParts[partIndex] = newValue
				// Combine parts into score string
				const newScore = newParts[0] && newParts[1]
					? `${newParts[0]}+${newParts[1]}`
					: newParts[0] || ""
				updated[roundIndex] = { ...currentRound, parts: newParts, score: newScore }
			} else {
				updated[roundIndex] = { ...currentRound, score: newValue }
			}
			return updated
		})
	}

	// Build the final score string for storage
	const buildScoreString = (): string => {
		if (isMultiRound) {
			// Store as JSON array for multi-round
			return JSON.stringify(roundScores.map((rs) => ({
				score: rs.score,
				parts: rs.parts,
			})))
		}
		return inputValue
	}

	// Submit the score
	const submitScore = (force = false) => {
		if (!isMultiRound && !isPassFail && !force && !parseResult?.isValid) return

		const existing = athlete.existingResult
		const finalScore = buildScoreString()
		const newScoreStatus = parseResult?.scoreStatus || "scored"
		const newTieBreak = tieBreakValue || null
		const newSecondary = showSecondaryInput ? secondaryValue || null : null

		// Don't save if nothing has changed (for single-round)
		if (
			!isMultiRound &&
			existing &&
			finalScore === (existing.wodScore || "") &&
			newScoreStatus === (existing.scoreStatus || "scored") &&
			newTieBreak === (existing.tieBreakScore || null) &&
			newSecondary === (existing.secondaryScore || null)
		) {
			return
		}

		onChange({
			score: finalScore,
			scoreStatus: newScoreStatus,
			tieBreakScore: newTieBreak,
			secondaryScore: newSecondary,
			formattedScore: parseResult?.formatted || finalScore,
			rawValue: parseResult?.rawValue,
			roundScores: isMultiRound ? roundScores.map((rs) => ({
				score: rs.score,
				parts: rs.parts,
			})) : undefined,
		})
	}

	// Handle blur - save when user leaves the field
	const handleBlur = (_field: "score" | "tieBreak" | "secondary" | "round") => {
		setTimeout(() => {
			const activeEl = document.activeElement
			const isMovingToRelatedField =
				activeEl === scoreInputRef.current ||
				activeEl === tieBreakInputRef.current ||
				activeEl === secondaryInputRef.current ||
				Array.from(roundInputRefs.current.values()).includes(activeEl as HTMLInputElement)

			if (!isMovingToRelatedField) {
				submitScore()
			}
		}, 0)
	}

	// Handle keyboard navigation
	const handleKeyDown = (
		e: KeyboardEvent<HTMLInputElement>,
		field: "score" | "tieBreak" | "secondary",
		roundIndex?: number,
	) => {
		if (e.key === "Tab" && !e.shiftKey) {
			e.preventDefault()

			if (field === "score") {
				if (isMultiRound && roundIndex !== undefined) {
					// Move to next round input or tie-break or next row
					const nextRoundIndex = roundIndex + 1
					if (nextRoundIndex < numRounds) {
						roundInputRefs.current.get(nextRoundIndex)?.focus()
					} else if (showTiebreak && !tieBreakValue) {
						tieBreakInputRef.current?.focus()
					} else {
						submitScore()
						onTabNext()
					}
				} else {
					// Single round logic
					if (showSecondaryInput && !secondaryValue) {
						secondaryInputRef.current?.focus()
					} else if (showTiebreak && !tieBreakValue) {
						tieBreakInputRef.current?.focus()
					} else {
						submitScore()
						onTabNext()
					}
				}
			} else if (field === "secondary") {
				if (showTiebreak && !tieBreakValue) {
					tieBreakInputRef.current?.focus()
				} else {
					submitScore()
					onTabNext()
				}
			} else {
				submitScore()
				onTabNext()
			}
		}

		if (e.key === "Enter") {
			e.preventDefault()

			if (showWarning) {
				setShowWarning(false)
				submitScore(true)
				onTabNext()
			} else if (isMultiRound || isPassFail || parseResult?.isValid) {
				submitScore()
				onTabNext()
			}
		}
	}

	// Handle warning confirmation
	const handleConfirmWarning = () => {
		setShowWarning(false)
		submitScore(true)
		onTabNext()
	}

	// Determine status display
	const hasExistingResult = !!athlete.existingResult
	// Only show invalid warning styling when explicitly triggered (not persisted after "Save Anyway")
	const isInvalidWarning = showWarning
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
				{/* Pass-Fail Scheme */}
				{isPassFail ? (
					<div className="relative">
						<div className="flex items-center gap-2">
							<Input
								ref={scoreInputRef}
								type="number"
								value={inputValue}
								onChange={(e) => {
									const val = e.target.value
									const numVal = parseInt(val, 10)
									// Validate doesn't exceed total rounds
									if (val !== "" && (Number.isNaN(numVal) || numVal > numRounds || numVal < 0)) {
										return
									}
									setInputValue(val)
								}}
								onKeyDown={(e) => handleKeyDown(e, "score")}
								onBlur={() => handleBlur("score")}
								placeholder={`Rounds passed (max ${numRounds})`}
								min="0"
								max={numRounds}
								className="h-10 text-base font-mono w-40"
							/>
							<span className="text-sm text-muted-foreground">
								/ {numRounds} rounds
							</span>
						</div>
					</div>
				) : isMultiRound ? (
					/* Multi-Round Scoring */
					<div className="space-y-2">
						{roundScores.map((roundScore, roundIndex) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: rounds are fixed order and count
							<div key={`round-${roundIndex}`} className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground w-10 shrink-0">
									R{roundIndex + 1}:
								</span>
								{isRoundsReps && roundScore.parts ? (
									/* Rounds + Reps split input */
									<div className="flex items-center gap-1 flex-1">
										<Input
											ref={(el) => {
												if (el) roundInputRefs.current.set(roundIndex * 2, el)
											}}
											type="number"
											value={roundScore.parts[0]}
											onChange={(e) => handleRoundScoreChange(roundIndex, e.target.value, 0)}
											onKeyDown={(e) => {
												if (e.key === "Tab" && !e.shiftKey) {
													e.preventDefault()
													// Move to reps input
													roundInputRefs.current.get(roundIndex * 2 + 1)?.focus()
												} else if (e.key === "Enter") {
													handleKeyDown(e, "score", roundIndex)
												}
											}}
											onBlur={() => handleBlur("round")}
											placeholder="Rds"
											min="0"
											className="h-8 text-sm font-mono w-16"
										/>
										<span className="text-muted-foreground">+</span>
										<Input
											ref={(el) => {
												if (el) roundInputRefs.current.set(roundIndex * 2 + 1, el)
											}}
											type="number"
											value={roundScore.parts[1]}
											onChange={(e) => handleRoundScoreChange(roundIndex, e.target.value, 1)}
											onKeyDown={(e) => handleKeyDown(e, "score", roundIndex)}
											onBlur={() => handleBlur("round")}
											placeholder={repsPerRound ? `Reps (max ${repsPerRound - 1})` : "Reps"}
											min="0"
											max={repsPerRound ? repsPerRound - 1 : undefined}
											className="h-8 text-sm font-mono w-24"
										/>
									</div>
								) : (
									/* Single score per round */
									<Input
										ref={(el) => {
											if (el) roundInputRefs.current.set(roundIndex, el)
										}}
										value={roundScore.score}
										onChange={(e) => handleRoundScoreChange(roundIndex, e.target.value)}
										onKeyDown={(e) => handleKeyDown(e, "score", roundIndex)}
										onBlur={() => handleBlur("round")}
										placeholder={
											workoutScheme === "time" || workoutScheme === "time-with-cap"
												? "e.g. 3:45"
												: "Score"
										}
										className="h-8 text-sm font-mono flex-1"
									/>
								)}
							</div>
						))}
					</div>
				) : isRoundsReps ? (
					/* Single round with Rounds + Reps split input */
					<div className="flex items-center gap-2">
						<Input
							ref={scoreInputRef}
							type="number"
							value={roundScores[0]?.parts?.[0] || ""}
							onChange={(e) => handleRoundScoreChange(0, e.target.value, 0)}
							onKeyDown={(e) => {
								if (e.key === "Tab" && !e.shiftKey) {
									e.preventDefault()
									roundInputRefs.current.get(1)?.focus()
								} else if (e.key === "Enter") {
									handleKeyDown(e, "score")
								}
							}}
							onBlur={() => handleBlur("score")}
							placeholder="Rounds"
							min="0"
							className="h-10 text-base font-mono w-24"
						/>
						<span className="text-muted-foreground">+</span>
						<Input
							ref={(el) => {
								if (el) roundInputRefs.current.set(1, el)
							}}
							type="number"
							value={roundScores[0]?.parts?.[1] || ""}
							onChange={(e) => handleRoundScoreChange(0, e.target.value, 1)}
							onKeyDown={(e) => handleKeyDown(e, "score")}
							onBlur={() => handleBlur("round")}
							placeholder={repsPerRound ? `Reps (max ${repsPerRound - 1})` : "Reps"}
							min="0"
							max={repsPerRound ? repsPerRound - 1 : undefined}
							className="h-10 text-base font-mono w-32"
						/>
					</div>
				) : (
					/* Default: Single score input */
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
				)}

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
				{(() => {
					// Check if there's any input (for multi-round or single)
					const hasInput = isMultiRound
						? roundScores.some((rs) => rs.score || rs.parts?.some((p) => p))
						: inputValue

					if (isSaving) {
						return (
							<div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								<span className="hidden sm:inline">Saving...</span>
							</div>
						)
					}
					if (isSaved || hasExistingResult) {
						return (
							<div className="flex items-center justify-center gap-1.5 text-sm text-green-600">
								<Check className="h-4 w-4" />
								<span className="hidden sm:inline">Saved</span>
							</div>
						)
					}
					if (hasInput) {
						return <span className="text-sm text-muted-foreground">Pending</span>
					}
					return <span className="text-sm text-muted-foreground">-</span>
				})()}
			</div>
		</div>
	)
}

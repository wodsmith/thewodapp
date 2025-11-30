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
	ScoreStatus,
} from "@/db/schema"
import type { EventScoreEntryAthlete } from "@/server/competition-scores"

export interface ScoreEntryData {
	score: string
	scoreStatus: ScoreStatus
	tieBreakScore: string | null
	formattedScore: string
}

interface ScoreInputRowProps {
	athlete: EventScoreEntryAthlete
	workoutScheme: WorkoutScheme
	tiebreakScheme: TiebreakScheme | null
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
	const [showWarning, setShowWarning] = useState(false)
	const [parseResult, setParseResult] = useState<ParseResult | null>(null)

	const scoreInputRef = useRef<HTMLInputElement>(null)
	const tieBreakInputRef = useRef<HTMLInputElement>(null)

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

		if (result.error) {
			setShowWarning(true)
		}
	}

	// Submit the score
	const submitScore = () => {
		if (!parseResult?.isValid) return

		onChange({
			score: inputValue,
			scoreStatus: parseResult.scoreStatus || "scored",
			tieBreakScore: tieBreakValue || null,
			formattedScore: parseResult.formatted,
		})
	}

	// Handle keyboard navigation
	const handleKeyDown = (
		e: KeyboardEvent<HTMLInputElement>,
		field: "score" | "tieBreak",
	) => {
		if (e.key === "Tab" && !e.shiftKey) {
			e.preventDefault()

			if (field === "score") {
				// If tie-break is needed and not filled, go there first
				if (parseResult?.needsTieBreak && !tieBreakValue) {
					tieBreakInputRef.current?.focus()
				} else {
					// Submit and move to next row
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
				// Dismiss warning and submit
				setShowWarning(false)
				submitScore()
			} else if (parseResult?.isValid) {
				submitScore()
				onTabNext()
			}
		}
	}

	// Handle warning confirmation
	const handleConfirmWarning = () => {
		setShowWarning(false)
		submitScore()
		onTabNext()
	}

	// Determine status display
	const hasExistingResult = !!athlete.existingResult
	const isWarning = showWarning || parseResult?.error

	return (
		<div
			className={cn(
				"grid grid-cols-[60px_1fr_2fr_1fr_100px] items-center gap-3 border-b p-3 transition-colors",
				isWarning && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300",
				isSaved && !isWarning && "bg-green-50 dark:bg-green-950/20",
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
						placeholder="Enter score..."
						className={cn(
							"h-10 text-base font-mono",
							isWarning && "border-yellow-400 focus:ring-yellow-400",
						)}
					/>
					{parseResult?.isValid && (
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

				{/* Warning Message */}
				{showWarning && parseResult?.error && (
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
			<div>
				{parseResult?.needsTieBreak ? (
					<Input
						ref={tieBreakInputRef}
						value={tieBreakValue}
						onChange={(e) => setTieBreakValue(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "tieBreak")}
						placeholder={
							tiebreakScheme === "time" ? "Time..." : "Reps..."
						}
						className="h-10 text-base font-mono"
					/>
				) : (
					<div className="text-center text-muted-foreground">--</div>
				)}
			</div>

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
